const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { createVehicle, createReservation } = require("./helpers/booking");

beforeEach(async () => {
  await resetTransactionalTables();
});

async function agentFor(user, portal) {
  const agent = request.agent(app);
  await loginAs(agent, user, portal);
  return agent;
}

async function completedBookingFixture() {
  const pkg = await seedPackage();
  const customer = await createUser("Customer", { full_name: "Sarah Jayasuriya" });
  const vehicle = await createVehicle(customer.user_id);
  const reservation = await createReservation({
    customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Collected",
  });
  return { pkg, customer, vehicle, reservation };
}

async function feedbackFixture({ email, rating = 5, comment = "Great service!" } = {}) {
  const pkg = await seedPackage();
  const customer = await createUser("Customer", email ? { email } : undefined);
  const vehicle = await createVehicle(customer.user_id);
  const reservation = await createReservation({
    customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Collected",
  });
  const agent = await agentFor(customer, "customer");
  const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating, comment });
  return res.body.feedback;
}

describe("POST /api/feedback", () => {
  test("customer submits feedback for a completed booking", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const agent = await agentFor(customer, "customer");
    const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({
      reservation_id: reservation.reservation_id, rating: 5, comment: "Great service!",
    });
    expect(res.status).toBe(201);
    expect(res.body.feedback.rating).toBe(5);
  });

  test("400 when rating is missing or out of range", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const agent = await agentFor(customer, "customer");

    const missing = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id });
    expect(missing.status).toBe(400);

    const tooHigh = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 6 });
    expect(tooHigh.status).toBe(400);

    const tooLow = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 0 });
    expect(tooLow.status).toBe(400);
  });

  test("400 when the booking is not yet collected", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Booked",
    });
    const agent = await agentFor(customer, "customer");
    const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });
    expect(res.status).toBe(400);
  });

  // Regression test for the original bug: a booking that's Completed (service done) but not
  // yet Collected (still needs payment/handover) must still be rejected — only "Collected"
  // is the fully-done state, and this must not silently pass once a fully-collected booking
  // moves on to any future state either.
  test("400 when the booking is Completed but not yet Collected", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed",
    });
    const agent = await agentFor(customer, "customer");
    const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });
    expect(res.status).toBe(400);
  });

  test("403 when submitting feedback for someone else's booking", async () => {
    const { reservation } = await completedBookingFixture();
    const intruder = await createUser("Customer", { email: "feedback-intruder@test.local" });
    const agent = await agentFor(intruder, "customer");
    const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });
    expect(res.status).toBe(403);
  });

  test("400 on duplicate feedback for the same booking", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const agent = await agentFor(customer, "customer");
    await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 4 });

    const res = await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });
    expect(res.status).toBe(400);
  });

  test("403 for a staff role (customer-only endpoint)", async () => {
    const { reservation } = await completedBookingFixture();
    const supervisor = await createUser("Supervisor");
    const agent = await agentFor(supervisor, "staff");
    const res = await agent.post("/api/feedback").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, rating: 5 });
    expect(res.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const res = await request(app).post("/api/feedback").send({ reservation_id: 1, rating: 5 });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/feedback", () => {
  test("customer sees only their own feedback", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const agent = await agentFor(customer, "customer");
    await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });

    const otherCustomer = await createUser("Customer", { email: "other-fb@test.local" });
    const otherAgent = await agentFor(otherCustomer, "customer");
    const otherRes = await otherAgent.get("/api/feedback").set("X-Portal", "customer");
    expect(otherRes.body.feedback).toHaveLength(0);

    const ownRes = await agent.get("/api/feedback").set("X-Portal", "customer");
    expect(ownRes.body.feedback).toHaveLength(1);
  });

  test("manager sees all feedback", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const custAgent = await agentFor(customer, "customer");
    await custAgent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 5 });

    const manager = await createUser("Service Center Manager");
    const managerAgent = await agentFor(manager, "staff");
    const res = await managerAgent.get("/api/feedback").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.feedback).toHaveLength(1);
    expect(res.body.feedback[0].customer_name).toBe("Sarah Jayasuriya");
  });
});

describe("GET /api/feedback/booking/:booking_id", () => {
  test("returns feedback for a booking, 404 when none exists", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const agent = await agentFor(customer, "customer");

    const notFound = await agent.get(`/api/feedback/booking/${reservation.reservation_id}`).set("X-Portal", "customer");
    expect(notFound.status).toBe(404);

    await agent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, rating: 3 });
    const found = await agent.get(`/api/feedback/booking/${reservation.reservation_id}`).set("X-Portal", "customer");
    expect(found.status).toBe(200);
    expect(found.body.feedback.rating).toBe(3);
  });
});

describe("GET /api/feedback/public", () => {
  test("only shows manager-featured feedback, as first-name + last-initial", async () => {
    const pkg = await seedPackage();

    const goodCustomer = await createUser("Customer", { full_name: "Sarah Jayasuriya" });
    const goodVehicle = await createVehicle(goodCustomer.user_id);
    const goodReservation = await createReservation({ customerId: goodCustomer.user_id, vehicleId: goodVehicle.vehicle_id, packageId: pkg.package_id, status: "Collected" });
    const goodAgent = await agentFor(goodCustomer, "customer");
    const goodFeedback = await goodAgent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: goodReservation.reservation_id, rating: 5, comment: "Excellent work!" }).then((r) => r.body.feedback);

    const poorCustomer = await createUser("Customer", { full_name: "Poor Rater", email: "poor@test.local" });
    const poorVehicle = await createVehicle(poorCustomer.user_id);
    const poorReservation = await createReservation({ customerId: poorCustomer.user_id, vehicleId: poorVehicle.vehicle_id, packageId: pkg.package_id, status: "Collected" });
    const poorAgent = await agentFor(poorCustomer, "customer");
    await poorAgent.post("/api/feedback").set("X-Portal", "customer").send({ reservation_id: poorReservation.reservation_id, rating: 5, comment: "Also great, but not featured" });

    // Neither shows up until a manager features one — a high rating alone is not enough.
    const beforeRes = await request(app).get("/api/feedback/public");
    expect(beforeRes.body.testimonials).toHaveLength(0);

    const manager = await createUser("Service Center Manager", { email: "manager-public-test@test.local" });
    const managerAgent = request.agent(app);
    await loginAs(managerAgent, manager, "staff");
    await managerAgent.patch(`/api/feedback/${goodFeedback.feedback_id}/feature`).set("X-Portal", "staff");

    const res = await request(app).get("/api/feedback/public");
    expect(res.status).toBe(200);
    expect(res.body.testimonials).toHaveLength(1);
    expect(res.body.testimonials[0].display_name).toBe("Sarah J.");
    expect(res.body.testimonials[0].comment).toBe("Excellent work!");
  });
});

describe("PATCH /api/feedback/:id/feature and /unfeature", () => {
  test("manager features feedback for the landing page", async () => {
    const feedback = await feedbackFixture({ email: "feature-1@test.local" });
    const manager = await createUser("Service Center Manager", { email: "manager-feature-1@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/feedback/${feedback.feedback_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.feedback.is_featured).toBe(true);
  });

  test("manager unfeatures feedback", async () => {
    const feedback = await feedbackFixture({ email: "feature-2@test.local" });
    const manager = await createUser("Service Center Manager", { email: "manager-feature-2@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    await agent.patch(`/api/feedback/${feedback.feedback_id}/feature`).set("X-Portal", "staff");
    const res = await agent.patch(`/api/feedback/${feedback.feedback_id}/unfeature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.feedback.is_featured).toBe(false);
  });

  // is_featured is a manager-curated "pick", not derived from ratings —
  // capped at MAX_FEATURED_FEEDBACK (4) landing-page slots.
  test("refuses to feature a 5th testimonial once 4 are already featured", async () => {
    const manager = await createUser("Service Center Manager", { email: "manager-feature-cap@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    for (let i = 0; i < 4; i++) {
      const fb = await feedbackFixture({ email: `feature-cap-${i}@test.local` });
      await agent.patch(`/api/feedback/${fb.feedback_id}/feature`).set("X-Portal", "staff");
    }
    const fifth = await feedbackFixture({ email: "feature-cap-4@test.local" });

    const res = await agent.patch(`/api/feedback/${fifth.feedback_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already have 4/i);
  });

  test("re-featuring an already-featured testimonial does not hit the cap", async () => {
    const manager = await createUser("Service Center Manager", { email: "manager-feature-refeat@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    let alreadyFeatured;
    for (let i = 0; i < 4; i++) {
      const fb = await feedbackFixture({ email: `feature-refeat-${i}@test.local` });
      await agent.patch(`/api/feedback/${fb.feedback_id}/feature`).set("X-Portal", "staff");
      if (i === 0) alreadyFeatured = fb;
    }

    const res = await agent.patch(`/api/feedback/${alreadyFeatured.feedback_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("rejects non-manager", async () => {
    const feedback = await feedbackFixture({ email: "feature-3@test.local" });
    const supervisor = await createUser("Supervisor", { email: "supervisor-feature@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.patch(`/api/feedback/${feedback.feedback_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const feedback = await feedbackFixture({ email: "feature-4@test.local" });
    const res = await request(app).patch(`/api/feedback/${feedback.feedback_id}/feature`);
    expect(res.status).toBe(401);
  });

  test("refuses to feature feedback with no comment", async () => {
    const feedback = await feedbackFixture({ email: "feature-nocomment@test.local", comment: "" });
    const manager = await createUser("Service Center Manager", { email: "manager-feature-nocomment@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/feedback/${feedback.feedback_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
  });
});
