# DriveWell — Viva Demo & Manual Test Checklist

Use this as both a pre-viva QA pass and a live demo script. It's organized around the booking
lifecycle (`Booked → Started → In Progress → Completed → Ready for Pickup`, plus `Cancelled` /
`No-show`), since that's the spine of the whole system, with each role's features grouped
around the point in that lifecycle where they act.

Automated coverage backing this up: 377 backend integration tests (`backend/tests`, run with
`npm test` inside `backend/`) plus frontend component tests in `customer_fd` and `admin_fd`.
This checklist is for what those tests can't show a panel — the actual UI working end to end.

## 0. Before the demo

- [ ] Postgres running, dev DB seeded: `cd backend && npm run db:seed` (creates roles, vehicle
      catalog, business hours, and the default manager `manager@drivewell.lk` / `Manager@123`)
- [ ] MailHog running (`npm run mailhog:start` in `backend/`) — open `http://localhost:8025` in
      a spare tab to show real emails landing live during the demo (welcome, booking
      confirmation, cancellation, status updates)
- [ ] Backend running: `cd backend && npm run dev` — confirm `http://localhost:3000/api-docs`
      loads (Swagger UI is a good fallback if a panel member asks "what does the API look like")
- [ ] `customer_fd` running: `npm run dev` (check its configured port)
- [ ] `admin_fd` running: `npm run dev` (check its configured port)
- [ ] Have at least one Supervisor, one Cashier, and one Service Staff account ready (create via
      Manager → Users if not already seeded)
- [ ] Know today's date and which weekdays are open — bookings can only be made on configured
      working days, within business hours, and same-day bookings close a configured number of
      minutes before closing. Pick a booking date/time a few days out for the demo to sidestep
      same-day edge cases entirely.

## 1. Customer journey (customer_fd)

- [ ] **Register** a new account (name, email, password meeting the strength policy: 8+ chars,
      upper, lower, number, special character) → welcome email appears in MailHog
- [ ] **Login** with the new account
- [ ] **Login rejection**: try logging into the customer portal with a staff account's
      credentials → should be rejected as "this portal is for customers only"
- [ ] **Add a vehicle** — once via the catalog (pick an existing make/model/type) and once with a
      custom make/model not in the catalog (demonstrates the "pending catalog review" flow a
      manager resolves later)
- [ ] **Edit** and **detach** a vehicle; confirm a vehicle with an active/upcoming booking can't
      be detached
- [ ] **Restore** a detached vehicle
- [ ] **Look up a plate** that's actively owned by someone else, and **submit a transfer
      request** with logbook + NIC photos (any two small images work)
- [ ] **Browse services** — package list, pricing, descriptions
- [ ] **Book a service**: pick a package, pick a date on the calendar (confirm fully-booked /
      closed days render differently from available ones), pick a time slot, accept Terms &
      Conditions, confirm → booking confirmation email in MailHog
- [ ] **View bookings list** and a booking's detail page (status, vehicle, package)
- [ ] **Cancel a booking** made far enough in the future; separately confirm a booking within 24
      hours of its slot **cannot** be self-cancelled (error message explains why)
- [ ] **Feedback**: after a booking reaches Completed (see Supervisor section below), submit a
      1–5 star rating + comment; confirm a second submission for the same booking is rejected
      (one review per booking)
- [ ] **Invoices**: after a Cashier generates one (see below), confirm the customer can view it
      but does not see the supervisor's internal remarks/work notes (staff-only)
- [ ] **Public landing page**: testimonials section shows only 4★+ reviews with a comment,
      displayed as first name + last initial (no full names/PII)
- [ ] **Logout**

## 2. Manager journey (admin_fd, staff portal)

- [ ] **Staff login** — confirm a customer account is rejected here too (portal separation is
      symmetric)
- [ ] **Packages**: create a new package, edit price/duration/capacity, feature it on the landing
      page, deactivate one (confirm it disappears from the customer-facing list but a manager can
      still see/reactivate it — soft delete, not a hard delete)
- [ ] **Business hours & blocked times**: view/update working days and hours; add a one-off
      blocked time (e.g. a holiday) and confirm it removes availability on that date for
      customers
- [ ] **Charge catalog**: create/edit/deactivate a standard extra-charge item (e.g. "Brake Pad
      Replacement") — this is what Supervisors pick from later and what Cashiers price against
- [ ] **Vehicle catalog**: add a make/model/type; resolve a customer's pending custom
      make/model submission (from step 1) into a real catalog entry
- [ ] **Vehicle transfers**: review a pending transfer request's documents, approve one
      (ownership actually moves) and reject another (with a reason)
- [ ] **Users**: create a Supervisor, Cashier, and Service Staff account; toggle an account's
      active/inactive status and confirm a deactivated account can no longer log in
- [ ] **Override a booking's status** directly (e.g. force to `No-show`) — manager-only escape
      hatch
- [ ] **Reports**:
  - [ ] Revenue — total/paid/unpaid, by package, by date
  - [ ] Volume — bookings by status, by package, by date
  - [ ] Staff performance — jobs completed and average rating per Service Staff member
  - [ ] Activity log — a running feed of key actions (booking created, status changes, payments,
        etc.) — good to pull up live since it's populated by everything else you just did in this
        demo

## 3. Supervisor journey (admin_fd, staff portal)

- [ ] Log in as a Supervisor
- [ ] **Start a service** for a `Booked` reservation — moves it to `Started`
- [ ] Add remarks; mark **has oil change** and enter current/next-service odometer readings
      (confirm it rejects a next-reading that isn't greater than the current one)
- [ ] **Assign up to 3 staff members** to the job, with a work note each; confirm a 4th
      assignment is blocked and a duplicate staff member can't be assigned twice
- [ ] **Add a service item** — once picked from the charge catalog, once as a free-text note
      (e.g. "rear brake pads worn") — these carry no price yet, that's the Cashier's call
- [ ] Advance status **Started → In Progress**
- [ ] Try advancing to **Completed before the quality check is ticked** — should be blocked with
      a clear message
- [ ] Tick **quality check**, then advance to **Completed** — should succeed and trigger a
      status-update email to the customer
- [ ] Confirm the record is now locked: editing remarks/odometer/assignments/items after
      Completed is rejected (finalized record)

## 4. Cashier journey (admin_fd, staff portal)

- [ ] Log in as a Cashier
- [ ] Open the **invoice draft** for the Completed booking above — confirm it shows the
      package's base price and the Supervisor's structured items with suggested prices from the
      charge catalog
- [ ] **Generate the invoice**: base amount + itemized additional charges + a discount → confirm
      the total is computed correctly (base + additional − discount)
- [ ] Confirm invoice generation is blocked for a booking that isn't Completed/Ready for Pickup
- [ ] **Mark the invoice Paid** with a payment method
- [ ] Confirm a second invoice can't be generated for the same booking

## 5. Service Staff journey (admin_fd, staff portal)

- [ ] Log in as the Service Staff member assigned above
- [ ] **My Services** — confirm it only shows jobs this staff member is actually assigned to (not
      every job in the system)
- [ ] **My Performance** — confirm it reflects the completed job and any feedback rating left on
      it

## 6. Cross-cutting spot checks (fast, worth doing right before the panel arrives)

- [ ] Every staff-only page rejects a customer session, and every manager-only page rejects a
      non-manager staff session (try hitting one directly while logged in as a Supervisor —
      should be denied, not silently show manager data)
- [ ] Logging out actually ends the session (back button / reload doesn't restore access)
- [ ] A customer can never see another customer's bookings, invoices, or vehicles
- [ ] Uploading a non-image file to an avatar/document upload field is rejected

## 7. If something breaks live

- Check the backend terminal for a stack trace first — most business-rule errors return a clear
  `message` in the response body, which the panel will see directly in the UI as a toast/error.
- MailHog (`localhost:8025`) confirms whether an action that's supposed to send an email actually
  fired — useful if a panel member asks "did that really send a notification?"
- `http://localhost:3000/api-docs` (Swagger UI) is a safe fallback to demonstrate an endpoint
  directly if the frontend hits an unrelated snag.
