# DriveWell — Viva Demo Data Plan & Story

**Purpose**: This is a planning document only — nothing here has been entered into the
system. It names every account, vehicle, package, and booking you should create by hand
(via the real UI) so the viva demo flows as one coherent story instead of disconnected
button-clicks. Pair it with `docs/VIVA_TEST_CHECKLIST.md`, which tells you *what to click*;
this document tells you *who/what to click it with* and *in what order*, so the whole thing
reads as a narrative to the panel.

Viva date: **Sunday, 9 August 2026**. "Day 0" below means Saturday 8 August (today) — the
prep day. "Live" means done in front of the panel on the 9th.

---

## ⚠️ Read this before anything else

1. **Working days — already fine, checked live.** I initially assumed the seed script's
   Mon–Fri default applied, which would have blocked Sunday bookings — that was wrong. The
   live `WorkingConfig` has already been set to **all 7 days** (`working_days: "0,1,2,3,4,5,6"`),
   08:00–18:00, so Sunday 9 August is a valid working day and live booking creation/
   reschedule will work with no changes needed. Two things to keep in mind from the same
   config: there's a daily lunch-break block 12:00–13:00 (avoid demoing a booking slot that
   lands inside it), and one unrelated one-off holiday block already set on 2026-07-16
   (irrelevant to viva day, just don't be confused if you spot it while showing Blocked
   Times).
2. **Seed first.** `cd backend && npm run db:seed` gives you the 5 roles, the full vehicle
   catalog, default business hours, and the one seeded account: Manager —
   `manager@drivewell.lk` / `Manager@123`. You do not need to (and should not) create
   another manager account — this is "the one manager" the brief asked for.
3. **MailHog must be running** (`npm run mailhog:start` in `backend/`, UI at
   `localhost:8025`). Every account below is created with a **pending** status and a
   password-invite email — you set the actual password by clicking the link in that email.
   Keep a MailHog tab open throughout; it's also proof-of-life for booking/status emails.
4. **Passwords are deliberately uniform** across each group (all demo customers share one
   password, all staff share another) purely so you don't fumble typing 20 different
   passwords live. Real deployments obviously wouldn't do this.
5. **Existing dev/test data is left in place.** The live DB already has 32 customers, 25
   vehicles, and several staff accounts that are clearly automated-test fixtures ("John
   Doe", "test1", `TEST-9999` plates, etc.), plus 52 bookings across every status. This plan
   deliberately does not clean any of it up — the new named accounts/vehicles/plates below
   were checked against the existing data and don't collide with it, so they can simply be
   added alongside. If a panel member happens to scroll a long Customers/Vehicles/Users list
   during the demo, that's the tradeoff — steer screen-shares toward filtered/searched views
   (e.g. search by name/plate) rather than the raw unfiltered list where practical.

| Group | Login portal | Password (all accounts in group) |
|---|---|---|
| Manager (seeded) | Staff — `/api/auth/staff/login` | `Manager@123` (already set by seed) |
| Supervisors, Cashier, Service Staff | Staff — `/api/auth/staff/login` | `Staff@123` (set yourself via the MailHog invite link after creating each account) |
| Customers | Customer — `/api/auth/login` | `Customer@123` (chosen at self-registration) |

---

## 1. Staff Roster

Staff are **not** self-registered — a Manager creates each account (Users → Create Staff:
email, full name, role, phone), which lands as `pending` with an invite email. Create all
"Day 0" staff before the viva; the 5 "Live" ones are created in front of the panel
(Act 2 below) to demonstrate that exact flow.

### Manager (already exists — seeded)
| Name | Email | Role |
|---|---|---|
| Service Manager | manager@drivewell.lk | Service Center Manager |

### Supervisors — create Day 0 (2)
| Name | Email | Phone | Story role |
|---|---|---|---|
| Suranga Athukorala | suranga.athukorala@drivewell.lk | +94771001001 | Primary supervisor — runs the live full-lifecycle job (Act 3) and the pre-completed job used for the feedback/reports demo |
| Menaka Wijetunge | menaka.wijetunge@drivewell.lk | +94771001002 | Secondary supervisor — logs in briefly to show role-boundary checks (read-only customer view) |

### Cashier — create Day 0 (1)
| Name | Email | Phone |
|---|---|---|
| Chamika Ranasinghe | chamika.ranasinghe@drivewell.lk | +94771001003 |

### Service Staff — create Day 0 (10)
| Name | Email | Phone |
|---|---|---|
| Isuru Bandaranaike | isuru.bandaranaike@drivewell.lk | +94771001011 |
| Dinesh Rajapaksha | dinesh.rajapaksha@drivewell.lk | +94771001012 |
| Shalini Herath | shalini.herath@drivewell.lk | +94771001013 |
| Roshan Peiris | roshan.peiris@drivewell.lk | +94771001014 |
| Nadeesha Gamage | nadeesha.gamage@drivewell.lk | +94771001015 |
| Thilina Wijesinghe | thilina.wijesinghe@drivewell.lk | +94771001016 |
| Ishara Ekanayake | ishara.ekanayake@drivewell.lk | +94771001017 |
| Sachini Liyanage | sachini.liyanage@drivewell.lk | +94771001018 |
| Lahiru Amarasinghe | lahiru.amarasinghe@drivewell.lk | +94771001019 |
| Manoj Kodithuwakku | manoj.kodithuwakku@drivewell.lk | +94771001020 |

*(Isuru, Dinesh and Shalini are the three assigned to Tharushi de Silva's pre-completed job
below — this is what gives Isuru a populated "My Performance" screen without waiting.)*

### Service Staff — create LIVE during viva (5)
| Name | Email | Phone |
|---|---|---|
| Dulani Jayawardena | dulani.jayawardena@drivewell.lk | +94771001021 |
| Anusha Wijeratne | anusha.wijeratne@drivewell.lk | +94771001022 |
| Gayan Bandara | gayan.bandara@drivewell.lk | +94771001023 |
| Vindya Fonseka | vindya.fonseka@drivewell.lk | +94771001024 |
| Sameera Wickremaratne | sameera.wickremaratne@drivewell.lk | +94771001025 |

---

## 2. Customer Roster

Customers self-register (`name`, `email`, `password` only — no phone at registration; phone
is captured per-booking as `contact_phone`, the field added in the most recent commit, and
is a good thing to point out live).

### Pre-registered Day 0 (10)
| # | Name | Email | Story role |
|---|---|---|---|
| 1 | Kasun Perera | kasun.perera@gmail.com | Multi-vehicle customer; owns a second vehicle with a custom (non-catalog) make, resolved by the Manager |
| 2 | Nimali Fernando | nimali.fernando@gmail.com | Owns the vehicle that gets **transferred away** live |
| 3 | Chathura Jayasinghe | chathura.jayasinghe@gmail.com | Requests transfer of Nimali's vehicle live |
| 4 | Dilani Wickramasinghe | dilani.wickramasinghe@gmail.com | "Golden path" customer — the full Booked→Collected lifecycle is demoed on her booking |
| 5 | Sanduni Rathnayake | sanduni.rathnayake@gmail.com | Cancels a booking successfully (>24h out) |
| 6 | Buddhika Gunawardena | buddhika.gunawardena@gmail.com | Tries to cancel a booking <24h out — correctly blocked |
| 7 | Tharushi de Silva | tharushi.desilva@gmail.com | Has a fully Collected + Paid + reviewed booking pre-loaded — feeds Invoices, Feedback, Reports, Staff Performance without live waiting |
| 8 | Nuwan Dissanayake | nuwan.dissanayake@gmail.com | Has a prior Collected booking used for the live "Book Again" (rebook) demo |
| 9 | Amaya Senanayake | amaya.senanayake@gmail.com | Has a future Booked reservation used for the live Reschedule demo |
| 10 | Kavindu Weerasinghe | kavindu.weerasinghe@gmail.com | Adds a vehicle then **detaches** it Day 0, leaving it unclaimed — claimed live by a new customer |

### Registered LIVE during viva (5)
| # | Name | Email | Story role |
|---|---|---|---|
| 11 | Dilshan Herath | dilshan.herath@gmail.com | Registers live, then claims Kavindu's now-unclaimed vehicle by plate |
| 12 | Kavitha Thevar | kavitha.thevar@gmail.com | Registers live, adds a catalog vehicle, books a service (straightforward path) |
| 13 | Arun Kanagasabai | arun.kanagasabai@gmail.com | Registers live, adds a vehicle with a make **not** in the catalog — Manager resolves it |
| 14 | Fathima Rizvi | fathima.rizvi@gmail.com | Registers live, books a service — that booking is later force-marked **No-show** by the Manager |
| 15 | Nadeeka Samarasinghe | nadeeka.samarasinghe@gmail.com | Registers live, adds a vehicle, then — as the closing beat — books one of the brand-new packages the Manager just created minutes earlier |

---

## 3. Service Packages

**Real current state** (checked directly against the live DB, not the seed script): there
are already **10** packages, all cosmetic wash/detailing — no mechanical services at all.
Several overlap heavily (two ~LKR 20,000 detail packages, two entry-level washes, one vague
"Max Detailing" that looks like a stray test entry). **Note on "bays"**: this codebase has
no literal bay/lane entity — the closest concept is each package's `max_capacity`, i.e. how
many bookings of *that package* can run in the same time window shop-wide. Present it to the
panel as "concurrent service capacity," not a numbered bay.

### Merge plan — 10 existing → 5 final (edit/deactivate Day 0)
| Final package | Built from (package_id) | Description | Duration | Price (LKR) | Capacity | Action |
|---|---|---|---|---|---|---|
| **Express Wash & Vacuum** | Edit #11 *(was "Basic Wash & Vacuum")* | Exterior wash, tire dressing, interior vacuum, and window cleaning (interior & exterior) — a fast, complete wash | 60 min | 5,000 | 4 | Edit; deactivate #10 "Express Wash" (folded in) |
| **Full Service Wash** | Keep #12, unchanged | Everything in Express Wash & Vacuum, plus interior wipe-down, engine bay rinse, undercarriage wash, and air freshener | 180 min | 15,500 | 3 | No change |
| **Premium Detailing** | Edit #13 | Clay bar treatment, machine polish, wax coat, leather conditioning, headlight restoration, engine bay clean, and tyre dressing | 240 min | 20,000 | 2 | Edit; deactivate #6 "Luxury Detailing Package" and #19 "Max Detailing" (both folded in / retired) |
| **Ceramic Coating** | Keep #17, unchanged | Paint correction, multi-layer ceramic coating, gloss & hydrophobic finish, long-term paint protection | 240 min | 35,000 | 2 | No change |
| **Specialty Care Package** | Edit #14 *(was "Interior Deep Clean")* | Seat & carpet shampoo, dashboard/console detailing, odor treatment, engine bay degreasing, undercarriage rust-proofing rinse, plus EV-safe exterior wash with charging-port-safe water handling for electric vehicles | 240 min | 13,000 | 3 | Edit; deactivate #15 "Engine Bay & Undercarriage Care" and #18 "EV Care Package" (both folded in) |

After this merge, only #11 (Express Wash & Vacuum) and #17 (Ceramic Coating) remain
`is_featured` — 2 of the max 5, which deliberately leaves headroom to feature new packages
live in Act 2 without first having to unfeature anything.

### Created LIVE during viva (3) — Act 2, Manager → Packages
All 10 existing packages are cosmetic wash/detailing — there is currently no mechanical
service at all. The 3 new ones fill that real gap rather than overlapping the merged 5,
which is a good talking point on its own ("today we're expanding DriveWell beyond
detailing"):

| # | Name | Description | Duration | Price (LKR) | Capacity |
|---|---|---|---|---|---|
| 6 | Standard Service | Engine oil change, oil filter replacement, fluid top-up, and multi-point inspection | 120 min | 7,500 | 3 |
| 7 | Battery & Electrical Check | Battery health test, alternator check, and full electrical diagnostic (lights, wipers, horn) | 45 min | 3,000 | 4 |
| 8 | Tyre & Brake Care | Tyre rotation, wheel alignment check, brake pad inspection, and brake fluid top-up | 90 min | 5,500 | 3 |

Feature Standard Service and Tyre & Brake Care live (brings featured count to 4/5).
Deactivate-then-reactivate **Express Wash & Vacuum** live to demonstrate soft delete.

---

## 4. Vehicles (customer-wise)

All makes/models below are confirmed to exist in the actual seeded catalog
(`backend/prisma/seed-data/makes.csv` / `models.csv`), so "Add Vehicle → pick from catalog"
will work exactly as listed — no guessing needed live.

### Before viva
| Customer | Vehicle | Plate | Type | Notes |
|---|---|---|---|---|
| Kasun Perera | Toyota Vitz, 2019 | CAB-4521 | Car | Primary vehicle |
| Kasun Perera | Custom make "Morris", model "Minor", 1975 | CAA-0099 | Car | **Not in catalog** — stays "pending catalog review" until Manager resolves it live |
| Nimali Fernando | Suzuki Wagon R, 2020 | CAJ-2210 | Car | Gets transferred to Chathura live — keep it free of bookings so the transfer isn't blocked |
| Chathura Jayasinghe | Honda Fit, 2018 | CAP-6634 | Car | His own vehicle |
| Dilani Wickramasinghe | Toyota Corolla, 2021 | CAT-8890 | Car | Golden-path lifecycle vehicle |
| Sanduni Rathnayake | Honda Vezel, 2019 | CAR-1123 | SUV | Cancel-succeeds demo |
| Buddhika Gunawardena | Nissan X-Trail, 2020 | CAW-4456 | SUV | Cancel-blocked (<24h) demo |
| Tharushi de Silva | Toyota Aqua, 2019 | CAG-7789 | Car | Pre-completed lifecycle |
| Nuwan Dissanayake | Toyota Prius, 2018 | CAK-3345 | Car | Rebook-source vehicle |
| Amaya Senanayake | Suzuki Alto, 2021 | CAF-5567 | Car | Reschedule demo |
| Kavindu Weerasinghe | Suzuki Swift, 2017 | CAM-9912 | Car | Add it, then **detach** it Day 0 → becomes unclaimed |

### Added/claimed LIVE during viva
| Customer | Vehicle | Plate | Notes |
|---|---|---|---|
| Dilshan Herath | (claims Kavindu's Swift) | CAM-9912 | "Claim Vehicle by plate" flow — no new vehicle created |
| Kavitha Thevar | Nissan Leaf, 2022 | CBA-1102 | Straightforward catalog add (bonus: EV talking point) |
| Arun Kanagasabai | Custom make "BYD", model "Atto 3", 2023 | CBB-3317 | Not in catalog — Manager resolves it live |
| Fathima Rizvi | Mitsubishi Montero, 2016 | CBC-5541 | SUV |
| Nadeeka Samarasinghe | Toyota Hiace, 2015 | CBE-7723 | Van |

---

## 5. Pre-loaded booking states (create Day 0)

Run these through the real system Day 0 so they're sitting in the right status when the
panel arrives — you do **not** want to be waiting through a full service lifecycle live for
every scenario. Pick service dates that fall on real working weekdays before the 9th.

All 5 packages referenced below are from the merged set in §3 and already exist Day 0 — the
3 new mechanical packages don't exist until Act 2, so nothing pre-loaded uses them.

| Booking | Customer / Vehicle / Package | Target status Day 0 | What it's for live |
|---|---|---|---|
| BK-1 | Tharushi de Silva / Toyota Aqua / Premium Detailing | **Collected**, invoice **Paid**, 5★ feedback left ("Amazing detail work, my car looks brand new!") — assign Isuru, Dinesh, Shalini as service staff | Invoices, Feedback, Reports, Staff Performance — all populated instantly |
| BK-2 | Nuwan Dissanayake / Toyota Prius / Full Service Wash | **Collected**, Paid, no feedback | Source booking for the live "Book Again" demo |
| BK-3 | Amaya Senanayake / Suzuki Alto / Express Wash & Vacuum | **Booked**, dated ~5 days after the viva | Live Reschedule demo |
| BK-4 | Buddhika Gunawardena / Nissan X-Trail / Specialty Care Package | **Booked**, dated <24h after the viva start time | Live "cancel blocked" demo |
| BK-5 | Sanduni Rathnayake / Honda Vezel / Ceramic Coating | **Booked**, dated well beyond 24h out | Live "cancel succeeds" demo |
| — | Dilani Wickramasinghe / Toyota Corolla / Full Service Wash | **Booked**, dated on the viva day itself, outside 12:00–13:00 (lunch block) | Left `Booked` on purpose — this is the one you take through Started→Completed→Paid→Collected live in Act 3 |

Leave Nimali's Wagon R and Kasun's second vehicle with **no bookings at all** — an
unresolved booking blocks both detach and transfer.

---

## 6. The live run-of-show

Mirrors `VIVA_TEST_CHECKLIST.md`'s section order (Customer → Manager → Supervisor → Cashier
→ Service Staff) but with concrete names slotted in, so it plays as one continuous story
instead of five disconnected checklists.

### Act 1 — Customer side (customer_fd), ~10–12 min
1. **Portal separation**: try logging into customer_fd with Chamika's (Cashier) credentials
   → rejected. One-line proof the two portals are enforced server-side.
2. **Register Dilshan Herath** live → show the welcome email land in MailHog → log in →
   **claim** Kavindu's now-unclaimed Swift (plate `CAM-9912`) → browse the 5 merged
   packages → book **Express Wash & Vacuum** a few days out, entering a `contact_phone` (call
   out that this field is independent of the profile phone — the feature from the most
   recent commit).
3. **Register Kavitha Thevar** → add her Nissan Leaf via the catalog → book **Specialty Care
   Package** (nice callback: its description explicitly calls out EV-safe charging-port
   handling, which pairs naturally with her EV).
4. **Register Arun Kanagasabai** → add his vehicle with custom make "BYD" / model "Atto 3"
   → point out it's flagged pending catalog review (no booking needed yet).
5. **Register Fathima Rizvi** → add her Montero → book **Premium Detailing** (this booking
   gets force-marked No-show by the Manager in Act 2 — don't cancel it yourself).
6. **Chathura Jayasinghe logs in** (pre-existing) → looks up plate `CAJ-2210` (Nimali's
   Wagon R, owned by someone else) → submits a **transfer request** with any two small
   images as the registration-book photo and NIC photo.
7. **Sanduni Rathnayake** cancels BK-5 (>24h out) → succeeds. **Buddhika Gunawardena**
   attempts to cancel BK-4 (<24h out) → blocked with a clear message.
8. **Nuwan Dissanayake** uses **Book Again** on his Collected BK-2 to create a fresh booking,
   editing the date.
9. Show the public landing page's testimonials section (first name + last initial only,
   4★+ with a comment — this is where BK-1's review surfaces).

### Act 2 — Manager side (admin_fd), ~10–12 min
1. Log in as Service Manager.
2. **Packages**: create the 3 new packages (§3) live; feature two; deactivate then
   reactivate Quick Wash & Vacuum to show soft delete.
3. **Charge catalog**: create "Brake Pad Replacement" (LKR 4,500) and "Wiper Blade
   Replacement" (LKR 1,200) — Suranga uses these in Act 3.
4. **Vehicle catalog**: resolve Kasun's pending "Morris Minor" and Arun's pending "BYD Atto
   3" into real catalog entries.
5. **Vehicle transfers**: open Chathura's pending request, review the two uploaded photos,
   **approve** → ownership of the Wagon R moves from Nimali to Chathura live.
6. **Users**: create the 5 live Service Staff (§1); open MailHog, click one invite link live,
   set `Staff@123` to prove the loop end-to-end.
7. **Override status**: force Fathima's Premium Detailing booking to **No-show** — the
   manager-only escape hatch.
8. **All Bookings / Reports**: pull up Revenue, Volume, Staff Performance, and the Activity
   Log — all now populated by everything done in Acts 1–2 plus BK-1/BK-2 from Day 0.
9. **Closing beat**: switch back to customer_fd as **Nadeeka Samarasinghe** (register her,
   add her Hiace) and book **Standard Service** — one of the packages created two minutes
   ago in step 2 — a clean "what the Manager just created is instantly live for customers"
   moment.

### Act 3 — Supervisor → Cashier → Service Staff, ~10 min
One continuous lifecycle on **Dilani Wickramasinghe's** Full Service Wash booking:
1. **Suranga (Supervisor)** logs in → **Start Service** on Dilani's booking (Booked→Started)
   → adds remarks → ticks "has oil change," enters current/next odometer (try an invalid
   next-reading first to show the validation) → assigns 3 staff with work notes (try a 4th
   to show the cap, and a duplicate to show that block) → adds one charge-catalog item
   (Brake Pad Replacement) and one free-text item ("rear wiper streaking") → tries advancing
   to Completed before ticking Quality Check → blocked → ticks it → **Completed** succeeds,
   status email fires.
2. **Chamika (Cashier)** logs in → opens the invoice draft for Dilani's now-Completed
   booking → confirms base price + Suranga's items are pre-filled → generates the invoice
   with a small discount → **marks it Paid** → "Payment Received" email fires.
3. Back to **Suranga** → Ready for Release table now shows Dilani's booking Paid → **Release
   Vehicle** → status becomes **Collected**, collection + feedback-prompt email fires.
4. **A Service Staff member** (one of the 3 assigned) logs in → **My Services** shows only
   their own assigned jobs → **My Performance** now reflects this job.
5. Switch back to customer_fd as **Dilani** → leave feedback on the now-Collected booking →
   view the invoice (note she does *not* see Suranga's internal remarks).

### If you're short on time — cut in this order
1. Drop Nadeeka Samarasinghe's closing-beat booking (§Act 2 step 9).
2. Drop the reject-a-transfer-request variant (never included above — approve-only is
   already in the plan).
3. Drop Arun Kanagasabai's whole flow (custom vehicle + catalog resolution) — Kasun's
   Morris Minor already covers that scenario once.
4. Keep Act 3 (the full lifecycle) no matter what — it's the single scenario that touches
   every role.

---

## 7. Quick lookup — all logins

| Name | Email | Password | Role |
|---|---|---|---|
| Service Manager | manager@drivewell.lk | Manager@123 | Manager |
| Suranga Athukorala | suranga.athukorala@drivewell.lk | Staff@123 | Supervisor |
| Menaka Wijetunge | menaka.wijetunge@drivewell.lk | Staff@123 | Supervisor |
| Chamika Ranasinghe | chamika.ranasinghe@drivewell.lk | Staff@123 | Cashier |
| Isuru Bandaranaike | isuru.bandaranaike@drivewell.lk | Staff@123 | Service Staff |
| (+ 9 more service staff, §1) | …@drivewell.lk | Staff@123 | Service Staff |
| Kasun Perera → Nadeeka Samarasinghe (15 total, §2) | firstname.lastname@gmail.com | Customer@123 | Customer |

All staff emails follow `firstname.lastname@drivewell.lk`; all customer emails follow
`firstname.lastname@gmail.com` — you can reconstruct any login from the roster tables above
without needing to memorize 33 individual rows.
