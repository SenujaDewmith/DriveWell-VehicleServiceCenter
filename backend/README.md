# DriveWell — Backend

DriveWell is a vehicle service-center management system: customers book wash/detailing
packages online, staff run the job through its lifecycle (Booked → Started → Completed →
Collected), and a manager oversees packages, staff, vehicles, and reports.

This README is written for someone new to the codebase. It covers how the project is put
together, how to run it, how data flows through it, and — most importantly for tomorrow —
**a repeatable pattern for making a live code change on request**, using "add a discount" as
the worked example.

---

## 1. The three applications

This is a monorepo with three independent apps, each with its own `package.json`. There is
no root-level build tool tying them together — you run each one yourself.

| Folder         | What it is                                      | Talks to  | Dev port                                               |
| -------------- | ----------------------------------------------- | --------- | ------------------------------------------------------ |
| `backend/`     | Node.js + Express API + PostgreSQL (via Prisma) | —         | `http://localhost:3000` (see `server.js` / `PORT` env) |
| `admin_fd/`    | Staff/Manager web app (React + Vite)            | `backend` | `http://localhost:5174`                                |
| `customer_fd/` | Customer-facing web app (React + Vite)          | `backend` | `http://localhost:5173`                                |

Both frontends are plain React + Vite + Tailwind + shadcn/radix UI components — no Next.js,
no server-side rendering. They call the backend with `fetch`/axios-style HTTP requests and
rely on browser cookies for auth (explained in section 4).

---

## 2. Tech stack

| Layer            | Technology                                     | Why it matters for you                                                                                                                                                       |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime          | Node.js + Express 5                            | Standard REST API, one route file per resource                                                                                                                               |
| Database         | PostgreSQL                                     | Relational — foreign keys enforce data integrity                                                                                                                             |
| ORM              | Prisma                                         | `prisma/schema.prisma` is the **single source of truth** for every table. You edit the schema, then run a command to sync the database — you never hand-write `CREATE TABLE` |
| Auth             | JWT stored in an HttpOnly cookie               | Not `localStorage`, not an `Authorization: Bearer` header — see section 4                                                                                                    |
| Validation       | Zod                                            | Each writable endpoint has a schema file describing exactly what a valid request body looks like                                                                             |
| Password hashing | bcryptjs                                       | Passwords are never stored in plain text                                                                                                                                     |
| File uploads     | Multer                                         | Package images, avatars, transfer-request documents — saved to disk under `backend/uploads/`, not in the database                                                            |
| Email            | Nodemailer → MailHog (local fake SMTP)         | Real emails aren't sent in dev; MailHog catches them at `http://localhost:8025`                                                                                              |
| Logging          | Winston                                        | Writes to console + `backend/logs/app.log` / `error.log`                                                                                                                     |
| API docs         | Swagger (swagger-jsdoc + swagger-ui-express)   | Auto-generated from JSDoc comments in route files, browsable at `/api-docs`                                                                                                  |
| Testing          | Jest + Supertest (backend), Vitest (frontends) |                                                                                                                                                                              |

---

## 3. Backend folder structure

```
backend/
├── server.js                 # entry point — starts the Express app (app.js) on a port
├── src/
│   ├── app.js                 # wires up middleware + mounts every route file — start here
│   ├── config/
│   │   └── swagger.js         # Swagger/OpenAPI spec config
│   ├── constants/
│   │   └── status.js          # the reservation status lifecycle (Booked/Started/.../Collected) —
│   │                           #   single source of truth so controllers don't each hardcode their own list
│   ├── controllers/           # one file per resource — the actual business logic
│   ├── routes/                # one file per resource — defines URL + method + which middleware
│   │                           #   runs before the controller. Mirrors controllers/ 1:1
│   ├── schemas/                # Zod validation schemas for POST/PUT bodies
│   ├── middlewares/
│   │   ├── auth.middleware.js  # verifyToken (require login), authorizeRoles (require a role),
│   │   │                       #   identifyUser (optional login)
│   │   ├── validate.middleware.js  # runs a Zod schema against req.body, 400s on failure
│   │   ├── upload.middleware.js    # Multer config for package images / avatars / transfer docs
│   │   └── rateLimit.middleware.js # throttles login/register/forgot-password
│   ├── lib/                   # shared helpers (Prisma client instance, phone formatting,
│   │                           #   activity logging, appointment-slot generation, etc.)
│   ├── services/
│   │   └── email.service.js   # every transactional email template lives here
│   └── utils/
│       ├── logger.js           # Winston instance
│       └── resetToken.js       # hashing for password-reset / staff-invite tokens
├── prisma/
│   ├── schema.prisma           # THE database schema — every table, column, and relation
│   ├── seed.js                 # populates a fresh database with demo data (see section 8)
│   └── seed-data/               # CSVs for the vehicle make/model/type catalog
├── uploads/                    # user-uploaded files, served at /uploads/* — NOT in the database
└── tests/                      # Jest + Supertest integration tests
```

**The pattern to remember**: for any resource (e.g. "packages"), there are exactly four files
that work together, and they're named consistently:

```
routes/packages.routes.js       → defines the URL and which middleware guards it
schemas/packages.schema.js      → defines what a valid request body looks like
controllers/packages.controller.js → the actual logic (talks to the database via Prisma)
prisma/schema.prisma            → the `ServicePackage` model (the table itself)
```

Once you can find these four files for one resource, you can find them for any resource —
the naming is identical everywhere.

---

## 4. How to run everything locally

### One-time setup

```bash
# In backend/, admin_fd/, and customer_fd/ — install dependencies
cd backend && npm install
cd ../admin_fd && npm install
cd ../customer_fd && npm install
```

`backend/.env` needs to exist (copy from a teammate or `.env.test` as a template) with at
least:

```

DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<your database name>"
JWT_SECRET=<any random string>
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM="DriveWell" <no-reply@drivewell.local>
FRONTEND_URL=http://localhost:5173
STAFF_FRONTEND_URL=http://localhost:5174
```

`DATABASE_URL` is the only variable Prisma (and therefore the whole live app) actually
reads — `DB_NAME`/`DB_USER`/etc. exist only for the dead legacy script in `src/migrations/`,
but keep them in sync anyway to avoid confusing yourself later.

### Every time you start working

```bash
# 1. Start Postgres (however you normally do — service, Docker, etc.)

# 2. (optional but recommended for the viva) Start MailHog so invite/reset emails don't
#    silently fail — backend still works without it, emails just get logged as failed
cd backend && npm run mailhog:start     # UI at http://localhost:8025

# 3. Start the backend
cd backend && npm run dev               # nodemon — restarts on file changes

# 4. Start the staff/manager app
cd admin_fd && npm run dev              # http://localhost:5174

# 5. Start the customer app
cd customer_fd && npm run dev           # http://localhost:5173
```

Open `http://localhost:3000/api-docs` any time to browse and try every API endpoint
interactively (Swagger UI) — genuinely useful if the panel asks you to demonstrate an
endpoint you just added.

### Setting up a brand-new database from scratch

This is the exact sequence used to build `Drivewell_DB` — the same steps apply to any fresh
database:

```bash
cd backend

# 1. Create the empty database (only needs doing once; use pgAdmin, psql, or any GUI)
#    CREATE DATABASE "Drivewell_DB";

# 2. Point DATABASE_URL (in .env) at it, then create every table from the schema:
npx prisma db push

# 3. Populate it with the demo/starter data (see section 8):
npm run db:seed
```

`npm run dev` / `npm start` never run the seed automatically — you always trigger it
explicitly, and it's safe to re-run any time (it skips anything that already exists instead
of duplicating it).

---

## 5. Database architecture

Prisma's schema (`prisma/schema.prisma`) is the full picture; here's the map of how the
pieces relate. Names in `snake_case` are actual column/table names.

```
roles ──< users >── customers (1:1, only if role = Customer)
                └── staff     (1:1, only if role is Manager/Supervisor/Cashier/Service Staff)

vehicle_types ──< vehicle_makes ──< vehicle_models
       └──────────────< vehicles >── users (customer_id, previous_customer_id)

users(customer) ──< reservations >── vehicles
                          │             └── vehicle_makes/models/types (via vehicle)
                          ├── service_packages
                          ├── service_records ──< service_staff_assignments >── users(staff)
                          │         └──< service_record_items >── charge_catalog_items
                          ├── invoices ──< invoice_items >── charge_catalog_items
                          └── feedback

vehicle_transfer_requests ── vehicles, users(requester/reviewer)
working_config, blocked_times   (business hours / holidays — not tied to bookings)
activity_log                     (audit trail — every important action, who did it, when)
```

### Key design decisions worth understanding (a panel loves these)

- **One `users` table for everyone.** A row's `role_id` (see section 6) decides whether it
  also has a `customers` row or a `staff` row (never both). Login, password reset, and
  account status all live on `users` regardless of role.
- **The vehicle catalog is hierarchical**: `vehicle_types` (Car, SUV, EV, ...) → `vehicle_makes`
  (Toyota, Honda, ...) → `vehicle_models` (Corolla, Vitz, ...). A customer can also submit a
  make/model that _isn't_ in the catalog yet (`custom_make`/`custom_model` on `vehicles`,
  `model_id` left `NULL`) — the manager later resolves it into a real catalog entry. This is
  the "pending catalog review" flow you'll see in the admin app.
- **Snapshot fields.** Several tables store a _name_ alongside a _foreign key_
  (`service_records.supervisor_name`, `invoices.cashier_name`, etc.). The FK can go `NULL`
  if that staff account is later deleted, but the snapshot keeps historical records readable.
  This is a deliberate pattern, not duplication — reuse it if a modification asks you to
  record "who did X" permanently.
- **Reservation status is a single source of truth.** `src/constants/status.js` defines the
  six lifecycle states and which transitions are legal (`Booked → Started → Completed →
Collected`, with `Cancelled`/`No-show` as terminal exits from `Booked`). Any controller
  that touches booking status imports from here instead of re-declaring its own list.
- **Soft delete for packages** (`is_active`), **hard delete for staff** (actually removed —
  their name lives on in snapshot fields instead).
- **Uploaded images live on disk, not in Postgres.** `service_packages.image_url` /
  `customers.avatar_url` / `staff.avatar_url` just store a path like
  `/uploads/packages/pkg-....jpg`; the actual file sits under `backend/uploads/`. This is why
  a fresh database still shows package photos immediately — the files are already there on
  disk, only the database row pointing at them was missing.

---

## 6. Authentication & roles

### How login works

1. User submits email/password to `POST /api/auth/login` (customer portal) or
   `POST /api/auth/staff/login` (staff portal).
2. Backend checks the password with `bcrypt.compare`, checks `account_status` is `"active"`
   (not `"pending"` — see staff invite flow below), and checks the account's role is allowed
   through _that_ portal.
3. Backend signs a JWT (`{ user_id, email, role_id }`) and sets it as an **HttpOnly cookie**
   — `customer_token` for the customer portal, `staff_token` for the staff portal. Two
   separate cookie names so a customer and a staff session can coexist in the same browser.
4. Every subsequent request automatically includes that cookie (the browser does this, not
   your JS code). The frontend also sends an `X-Portal: customer` or `X-Portal: staff` header
   so the backend knows which cookie to check if both happen to be present.
5. `verifyToken` middleware (in `auth.middleware.js`) reads the cookie, verifies the JWT
   signature, and attaches `req.user = { user_id, email, role_id }` for the controller to use.

**This means auth is never a header you attach manually** — if you're testing with `curl` or
Postman, you need cookie jar support, or just use the Swagger UI at `/api-docs`, which handles
cookies for you automatically once you've logged in through it.

### Roles

| `role_id` | Role name              | Portal                   | What they can do (high level)                                                  |
| --------- | ---------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| 1         | Service Center Manager | Staff (`admin_fd`)       | Everything: packages, users, vehicle catalog, reports, override booking status |
| 2         | Supervisor             | Staff (`admin_fd`)       | Run the service lifecycle (start/complete jobs), assign staff, quality checks  |
| 3         | Cashier                | Staff (`admin_fd`)       | Generate invoices, mark payments                                               |
| 4         | Service Staff          | Staff (`admin_fd`)       | View their own assigned jobs, log performance                                  |
| 5         | Customer               | Customer (`customer_fd`) | Book services, manage own vehicles, view own invoices/history                  |

These IDs are hardcoded (`ROLE_MAP` in `auth.middleware.js`, matching the order roles are
seeded in `prisma/seed.js`) — don't reorder the `roles` array in the seed script, or the IDs
will shift and break every `authorizeRoles(...)` check in the codebase.

### Route protection pattern

Every protected route composes small middleware pieces in the route file:

```js
const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];
router.post("/", managerOnly, validate(packageSchema), createPackage);
```

Read that left-to-right: _must be logged in_ → _must be a Manager_ → _body must pass this Zod
schema_ → _then run the controller_. If you're asked to restrict a new endpoint to a specific
role, this is the line you write.

### Staff accounts vs. customer accounts — different creation flow

- **Customers self-register** (`POST /api/auth/register` — name, email, password only).
  Account is `active` immediately.
- **Staff are created by a Manager** (`POST /api/users/staff` roughly — see
  `users.controller.js: createStaff`). The manager never sets a password: a random
  placeholder hash is created, `account_status` is set to `"pending"`, and an invite email is
  sent with a "set your password" link. The account only becomes `active` once that link is
  used (`resetPassword` in `auth.controller.js` flips `pending` → `active` the moment a
  password is set — the same endpoint serves both "forgot password" and "first-time setup").

The demo staff/customers seeded for the viva (section 8) skip this — they're inserted
directly as `active` with a known password, so you don't depend on MailHog working live.

---

## 7. Request/API flow — how a request actually gets handled

Every write endpoint follows the same pipeline. Here's the real one for
**creating a service package**, `POST /api/packages`:

```
1. Browser (admin_fd) sends POST /api/packages with cookie + JSON body
        ↓
2. app.js has already run global middleware: CORS check, express.json() (parses
   the body), cookieParser() (parses cookies)
        ↓
3. routes/packages.routes.js matches the URL + method, runs:
     verifyToken        → decodes the JWT cookie, sets req.user, or 401s
     authorizeRoles(...) → checks req.user.role_id is allowed, or 403s
     validate(packageSchema) → runs Zod against req.body:
                                 wrong shape/type/missing field → 400, stops here
                                 valid → req.body is replaced with the cleaned/coerced data
        ↓
4. controllers/packages.controller.js: createPackage(req, res) runs
        ↓
5. Talks to the database via Prisma: prisma.servicePackage.create({ data: ... })
        ↓
6. Responds with JSON: res.status(201).json({ message: ..., package: pkg })
```

Every other endpoint in the codebase is this same shape — the only things that change per
endpoint are which middleware runs and what the controller does with Prisma.

### API surface map

All routes are mounted under `/api` in `app.js`. One row per route file:

| Base path                    | Route file                  | Covers                                                          |
| ---------------------------- | --------------------------- | --------------------------------------------------------------- |
| `/api/auth`                  | `auth.routes.js`            | register, login (both portals), logout, forgot/reset password   |
| `/api/profile`               | `profile.routes.js`         | logged-in user's own profile + avatar                           |
| `/api/vehicles`              | `vehicles.routes.js`        | customer's own vehicles, add/detach, transfer requests          |
| `/api/packages`              | `packages.routes.js`        | service package CRUD, image upload, feature/activate toggle     |
| `/api/config`                | `config.routes.js`          | business hours, blocked times                                   |
| `/api/bookings`              | `bookings.routes.js`        | reservations — create, list, cancel, reschedule, status changes |
| `/api/service-records`       | `service-records.routes.js` | supervisor's start/complete-job workflow                        |
| `/api/invoices`              | `invoices.routes.js`        | cashier invoice generation + payment status                     |
| `/api/charge-catalog`        | `charge-catalog.routes.js`  | manager's reusable "extra charge" price list                    |
| `/api/feedback`              | `feedback.routes.js`        | customer ratings/comments                                       |
| `/api/reports`               | `reports.routes.js`         | revenue/volume/staff-performance dashboards                     |
| `/api/users`                 | `users.routes.js`           | manager creating/editing/deleting staff + customer accounts     |
| `/api/staff`                 | `staff.routes.js`           | staff-specific views (my jobs, my performance)                  |
| `/api/admin/vehicles`        | `vehicle-admin.routes.js`   | manager's transfer-request review/approve                       |
| `/api/admin/vehicle-catalog` | `vehicle-catalog.routes.js` | manager resolving pending custom makes/models                   |

Full request/response shapes for every one of these are in Swagger UI (`/api-docs`) — that's
genuinely the fastest way to answer "what does this endpoint expect/return" live.

---

## 8. Demo / seed data (what `npm run db:seed` gives you)

Running the seed against a fresh, empty database (after `npx prisma db push`) creates:

- **Vehicle catalog**: 11 vehicle types, 29 makes, ~387 models (from `prisma/seed-data/*.csv`)
- **5 roles**, working hours (currently all 7 days, 08:00–18:00, with a 12:00–13:00 lunch
  block), and 1 manager account
- **6 service packages**, each with a real photo already sitting in `backend/uploads/`
- **13 staff accounts** (2 Supervisors, 1 Cashier, 10 Service Staff) — active immediately
- **10 customers**, each with one vehicle already added

### Login credentials

| Account                               | Email pattern                     | Password       |
| ------------------------------------- | --------------------------------- | -------------- |
| Manager                               | `manager@drivewell.lk`            | `Manager@123`  |
| Supervisors / Cashier / Service Staff | `firstname.lastname@drivewell.lk` | `Staff@123`    |
| Customers                             | `firstname.lastname@gmail.com`    | `Customer@123` |

(Full name/email list is in `prisma/seed.js` — search for `staffRoster` / `customerRoster`.)

### The 6 seeded packages

| Name                   | Duration | Price (LKR) | Capacity | Featured |
| ---------------------- | -------- | ----------- | -------- | -------- |
| Express Wash & Vacuum  | 60 min   | 5,000       | 4        | ✅       |
| Full Service Wash      | 180 min  | 15,500      | 3        |          |
| Premium Detailing      | 240 min  | 20,000      | 2        |          |
| Ceramic Coating        | 240 min  | 35,000      | 2        | ✅       |
| Specialty Care Package | 240 min  | 13,000      | 3        |          |
| EV Care Package        | 90 min   | 8,000       | 3        |          |

`seed.js` is idempotent — re-running it never duplicates data, it just fills in anything
missing. That's what makes "every fresh database ends up in this exact state" true.

---

## 9. The pattern for making a live modification (worked example: discounts)

When the panel asks for a change tomorrow, resist the urge to improvise — **follow the same
four-file trail every time**, in this order. Below is a full worked example for a realistic
ask: _"add a discount to service packages."_

> Note: there's already a _cashier-entered_ flat `discount` on invoices (see
> `invoices.controller.js`) — that's a manual, per-invoice discount typed in at checkout time.
> A **package-level percentage discount** (e.g. "Ceramic Coating is 15% off") is a genuinely
> different feature, which is why it's a good example — you'll extend `service_packages`,
> not touch `invoices` at all.

### Step 1 — Decide the shape of the change

Package-level promotional discount: add `discount_percent` (0–100, optional) to
`service_packages`, and compute a `discounted_price` wherever the price is shown.

### Step 2 — Edit the database schema

`backend/prisma/schema.prisma`, inside `model ServicePackage`:

```prisma
model ServicePackage {
  package_id         Int      @id @default(autoincrement())
  name               String   @db.VarChar(150)
  package_code       String?  @unique @db.VarChar(20)
  description        String?
  estimated_duration Int      @default(60)
  price              Decimal  @db.Decimal(10, 2)
  discount_percent   Int?     @db.SmallInt   // ← new field: 0-100, null = no discount
  image_url          String?  @db.VarChar(500)
  max_capacity       Int      @default(3)
  is_active          Boolean  @default(true)
  is_featured        Boolean  @default(false)
  created_at         DateTime @default(now())

  reservations Reservation[]

  @@map("service_packages")
}
```

Then apply it to the actual database (this is the step that turns the schema edit into a real
column — do this every time you touch `schema.prisma`):

```bash
cd backend
npx prisma db push
```

### Step 3 — Update the validation schema

`backend/src/schemas/packages.schema.js`:

```js
const packageSchema = z.object({
  // ...existing fields unchanged...
  discount_percent: z
    .number({ invalid_type_error: "Discount must be a number" })
    .int()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%")
    .optional()
    .nullable(),
});
```

### Step 4 — Update the controller

`backend/src/controllers/packages.controller.js` — `createPackage` and `updatePackage`
already destructure known fields from `req.body` and pass them straight to Prisma. Add the
new field to both:

```js
const createPackage = async (req, res) => {
  const { name, package_code, description, estimated_duration, price, max_capacity, discount_percent } = req.body;
  try {
    const pkg = await prisma.servicePackage.create({
      data: { name, package_code, description, estimated_duration, price, max_capacity, discount_percent },
    });
    // ...unchanged...
```

If you also want the _computed_ discounted price returned by the API (rather than making
every frontend component do the math), add it to the response instead of storing it:

```js
const withDiscountedPrice = (pkg) => ({
  ...pkg,
  discounted_price: pkg.discount_percent
    ? +(pkg.price * (1 - pkg.discount_percent / 100)).toFixed(2)
    : pkg.price,
});
```

...and wrap `listPackages`/`getPackage`'s response with it.

### Step 5 — Route file

Nothing to change here in this example — `POST /` and `PUT /:id` already run
`validate(packageSchema)` before the controller, so the new field is automatically validated
once step 3 is done. **You only touch the route file if you're adding a brand-new endpoint**
(new URL/method), not when you're adding a field to an existing one.

### Step 6 — Frontend: admin (create/edit form)

In `admin_fd/src/routes/dashboard/packages.jsx`, the edit/create form builds a `payload`
object it POSTs/PUTs (see the existing `package_code` handling around line 280 for the exact
pattern) — add a `discount_percent` input the same way any other numeric field
(`estimated_duration`, `price`) is already wired up in that file, and include it in the
payload.

### Step 7 — Frontend: customer display

Wherever `customer_fd` renders a package price, show `discounted_price` (with the original
`price` struck through) when `discount_percent` is set.

### Step 8 — Verify

- Restart the backend if `nodemon` didn't already pick up the change.
- Try it in Swagger UI (`/api-docs` → Packages → PUT `/api/packages/{id}`) before touching
  the frontend at all — this isolates "is my backend change correct" from "is my frontend
  wired up correctly."
- Then confirm in the actual admin/customer UI.

### Generalizing this for _any_ live-modification request

No matter what the panel asks for, the same eight steps apply — you're just changing _what_
at each step:

1. **What table does this belong to?** → find/add the field in `prisma/schema.prisma`
2. `npx prisma db push` — sync the database
3. **What's a valid value?** → update (or add) the Zod schema in `src/schemas/`
4. **What logic does this need?** → update the controller in `src/controllers/`
5. **Is this a new URL, or an existing one?** → only touch `src/routes/` for genuinely new
   endpoints; existing ones already validate/authorize whatever you added in steps 3–4
6. **Does the manager need to set this?** → wire the admin_fd form
7. **Does the customer need to see this?** → wire the customer_fd display
8. **Verify via Swagger UI first, then the real UI**

If the ask is a whole new _resource_ (not just a field) — e.g. "add a loyalty points system"
— the same four-file pattern from section 3 applies, you're just creating all four files
instead of editing existing ones, plus adding one line in `app.js` to mount the new route
(`app.use("/api/loyalty", loyaltyRoutes)`).

---

## 10. Testing

```bash
# Backend — Jest + Supertest integration tests, against a real (throwaway) test database
cd backend
npm run test:db:start     # spins up a disposable Postgres in Docker
npm test
npm run test:db:stop

# Frontends — Vitest + Testing Library
cd admin_fd && npm test
cd customer_fd && npm test
```

`NODE_ENV=test` disables rate limiting (see `rateLimit.middleware.js`) so test suites don't
trip the login-attempt limiter.

---

## 11. Common gotchas

- **`package_code` is required and pattern-checked** (`^DWP-[A-Z0-9-]{1,16}$`) by
  `packages.schema.js` whenever you create/edit a package through the API. All 6 seeded
  packages already have one (`DWP-001`–`DWP-006`) so editing them in the admin UI works
  out of the box.
- **Auth is cookie-based, not header-based.** If you're testing an endpoint with `curl` or a
  raw `fetch`, you need to carry cookies (`credentials: "include"` in fetch, or a cookie jar
  in curl/Postman) — a bare `Authorization: Bearer <token>` header does nothing here.
- **`npx prisma db push` is required after every `schema.prisma` edit.** The schema file
  alone changes nothing in the database until you run it.
- **Restart the backend after editing `.env`.** Environment variables are only read once, at
  process startup (`nodemon` restarts on code changes, but a `.env` edit alone doesn't
  trigger a filesystem change nodemon watches by default in every setup — restart manually if
  unsure).
- **Uploaded images live on disk** (`backend/uploads/`), independent of which database is
  active. Switching `DATABASE_URL` to a different database doesn't lose existing images, and
  a fresh database can point `image_url` at files that already exist on disk (exactly what
  the 6 seeded packages do).
- **CORS**: in development, any `http://localhost:<port>` origin is allowed automatically
  (see `app.js`) — you don't need to add new frontend ports to a list while developing.

---

## 12. Quick command cheat-sheet

```bash
# Start everything (3 separate terminals)
cd backend && npm run dev
cd admin_fd && npm run dev
cd customer_fd && npm run dev

# Fresh database, start to finish
npx prisma db push        # create tables from schema.prisma
npm run db:seed           # populate demo data

# After changing prisma/schema.prisma
npx prisma db push

# Regenerate the Prisma client (usually automatic, but if imports look stale)
npx prisma generate

# Browse/try the API
http://localhost:3000/api-docs

# See what MailHog caught (invite/reset/booking emails)
http://localhost:8025
```
