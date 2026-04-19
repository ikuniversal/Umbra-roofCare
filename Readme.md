# Umbra RoofCare

Subscription-first residential roofing CRM. A HoldCo platform coordinating regional OpCo subsidiaries (licensed contractors) across 13 user roles — from super admins and executives down to setters, inspectors, specialists, and crew members.

**Status:** Phase 2 — Member Lifecycle. Builds on the Phase 1 foundation with Members, Properties, Territories, Canvass Leads, and Appointments. Later phases add Inspections, Opportunities, Jobs, Commissions, Messaging, and Reports.

---

## Tech stack

- Next.js 15 (App Router) · TypeScript (strict)
- Tailwind CSS · shadcn/ui primitives · Lucide icons
- Supabase (Auth + Postgres) via `@supabase/ssr`
- TanStack Query · React Hook Form · Zod
- Fraunces (serif display), Inter (sans body), IBM Plex Mono (labels) via `next/font`

## Palette

| Token | Hex |
| --- | --- |
| `brand-primary` | `#1F2937` |
| `brand-accent` | `#D97706` |
| `brand-bg` | `#FAF7F0` |
| `brand-card` | `#FFFFFF` |
| `brand-muted` | `#6B6358` |
| `brand-faint` | `#9A9184` |
| `brand-border` | `#E4DDC9` |
| `brand-border-strong` | `#C9BFA5` |
| `brand-success` | `#3A6E42` |
| `brand-warn` | `#A06428` |
| `brand-error` | `#9B2C2C` |

---

## Local setup

### 1. Clone and install

```bash
git clone <repo>
cd Umbra-roofCare
npm install
```

### 2. Create a Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project.
2. Grab these three values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon (public) key
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (keep secret)

### 3. Configure environment

```bash
cp .env.local.example .env.local
# fill in the values from step 2
```

`.env.local` is git-ignored; never commit it.

### 4. Run the database migration

The full schema lives at `supabase/migrations/00000000000001_initial_schema.sql`. Run it manually in the Supabase SQL editor:

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/00000000000001_initial_schema.sql`.
3. Click **Run**. This creates every table, index, RLS policy, the `handle_new_user` trigger, and the `current_opco_id`, `has_role`, `is_super_admin` helper functions.

Then seed the HoldCo and two pilot OpCos:

1. Open **SQL Editor** → **New query**.
2. Paste the contents of `supabase/seed.sql`.
3. Click **Run**.

You should now see three organizations: `umbra-holdco`, `umbra-dfw`, `umbra-phx`.

### 5. Create the first super admin

No public signup exists — the first super admin is provisioned by hand:

1. In the Supabase dashboard, go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password. Check **Auto Confirm User**.
3. The `handle_new_user` trigger will auto-create a matching `profiles` row.
4. Open **SQL Editor** and run (replacing the email):

   ```sql
   -- 1. Attach the profile to the HoldCo
   update profiles
   set opco_id = (select id from organizations where slug = 'umbra-holdco')
   where email = 'you@yourdomain.com';

   -- 2. Grant super_admin
   insert into user_roles (user_id, role, opco_id, granted_by)
   select p.id, 'super_admin', p.opco_id, p.id
   from profiles p
   where p.email = 'you@yourdomain.com';
   ```

5. You can now sign in at `/login` with those credentials.

### 6. Run the app

```bash
npm run dev
```

Visit <http://localhost:3000>. You'll be redirected to `/login`. Sign in with the super admin account and you'll land on `/dashboard`.

### 7. Phase 2 — Member Lifecycle

After the Phase 1 super admin is working, layer Phase 2 on top:

1. **Migrate.** In Supabase SQL Editor, run
   `supabase/migrations/00000000000003_phase2_territories_zip.sql`. This
   adds the `zip_codes text[]` column plus a GIN index on `territories`.
2. **Seed demo data (optional).** Run `supabase/seed_phase2.sql` to load
   ~15 members, properties, 6 territories, 20 canvass leads, and 12
   appointments split across Umbra DFW and Umbra Phoenix. Safe to re-run.
3. **Google Maps API key.** Create a project in
   [Google Cloud Console](https://console.cloud.google.com/), enable
   **Places API (New)** and **Geocoding API**, set up billing, and
   create an API key restricted to your domain(s). Put it in:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=…
   ```
   If the variable is unset the address inputs gracefully fall back to
   plain text — handy for dev, not ideal for canvass teams.
4. **Redeploy.** On Vercel, add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to the
   project's environment settings and trigger a new deploy so the
   client-side bundle picks it up.
5. **Verify.** Sign in and try:
   - `/members` — search, filter, paginate, open a member detail card.
   - `/members/new` — autocomplete an address, create a member.
   - `/canvass/territories` — create a territory with a zip-code list.
   - `/canvass` — update a lead status, add a note, convert to member.
   - `/appointments` — switch between List and Week views, book from
     `/appointments/new`, and watch activity land on the member card.

---

## Verifying the foundation

Once signed in as a super admin:

- **/dashboard** — shows your name, organization, and roles.
- **/settings/profile** — update your name and phone.
- **/settings/organizations** — create a new OpCo, edit an existing one.
- **/settings/users** — invite a user, assign them to any OpCo, grant any roles. A temporary password is displayed after invitation — hand it off privately.
- **/settings/teams** — list of teams (management UI lands later; rows can be created via Supabase for now).
- **/members** — search/filter/paginate homeowners; create a new member with Google Places autocomplete; tabbed detail view (Overview · Properties · Appointments · Notes · Activity · Future).
- **/canvass** — setter dashboard with "My leads" and unassigned queues, status cards, and per-territory counts.
- **/canvass/territories** — OpCo GMs define territories by zip-code clusters and see per-territory lead rosters.
- **/canvass/leads/[id]** — full lead timeline, status control, note trail, and "Convert to member" flow.
- **/appointments** — dual-mode view (List + Week calendar); filter by type and status; detail view with status transitions.
- **/inspections, /opportunities, /jobs, /commissions, /messages, /reports** — placeholder pages marked with their target phase.

To verify multi-tenant isolation, invite an `opco_gm` in one OpCo, sign in as them, and confirm they only see users attached to their OpCo.

---

## Project layout

```
app/
  (auth)/login/               public sign-in
  (app)/                      protected shell (sidebar + topbar)
    dashboard/
    members/ canvass/ appointments/ inspections/
    opportunities/ jobs/ commissions/ messages/ reports/
    settings/
      profile/ organizations/ users/ teams/
  api/users/invite/           admin-only invite endpoint
components/
  ui/                         shadcn-style primitives
  nav/                        sidebar, topbar, nav-items
  brand/                      Umbra wordmark and roof mark
lib/
  supabase/                   browser, server, admin clients + middleware
  auth.ts                     getSession / requireSession / requireRole
  rbac.ts                     role definitions and guards
  types.ts                    shared DB types
supabase/
  migrations/                 initial_schema.sql, phase2_territories_zip.sql
  seed.sql, seed_phase2.sql
```

## Scripts

```bash
npm run dev          # start dev server (http://localhost:3000)
npm run build        # production build
npm run start        # run production build
npm run type-check   # strict TypeScript check
npm run lint         # next lint
```

---

## Architecture notes

### Multi-tenant isolation

Every tenant table carries `opco_id`. RLS policies use two helper functions:

- `current_opco_id()` — the caller's OpCo (read from `profiles`).
- `is_super_admin()` — true for `super_admin`, `executive`, and `corp_dev`.

The default tenant pattern is `opco_id = current_opco_id() OR is_super_admin()`. Payments, inspection findings, job line items, crew assignments, and team members chain through their parent's OpCo.

### Auth flow

1. The only public route is `/login`. Signup is not exposed.
2. `middleware.ts` wraps every non-public route. It uses `@supabase/ssr` to refresh the session on each request and redirects unauthenticated visitors to `/login?next=<path>`.
3. `handle_new_user` auto-creates the `profiles` row for any `auth.users` insert.
4. A newly created user with no `opco_id` and no roles sees a "contact your administrator" banner on `/dashboard`.

### Inviting users (Phase 1)

`POST /api/users/invite` is the admin-only endpoint the Users settings page calls. It:

1. Verifies the caller has `super_admin` or `opco_gm`.
2. Uses the service_role client (`supabaseAdmin.auth.admin.createUser`) to create an auth user with a generated temporary password and `email_confirm: true`.
3. Upserts the `profiles` row with the selected `opco_id`.
4. Inserts `user_roles` entries for each selected role, scoped to that OpCo.
5. Returns the temporary password to the admin, who relays it to the user privately.

Email-based invites ship in Phase 6 alongside the Messages module.

---

## Deployment (Vercel)

1. Import the repo in Vercel.
2. Add the four environment variables from `.env.local.example` to the project's environment settings.
3. Deploy. No additional build configuration is required.

---

## Phase boundaries

| Phase | Scope |
| ----- | ----- |
| 1 | Foundation — schema, RLS, auth, RBAC, shell, org + user settings |
| 2 | Members, Properties, Territories (zip-code), Canvass Leads, Appointments *(this release)* |
| 3 | Scored Inspections, Findings, Photo manifests |
| 4 | Opportunities, Jobs, Line items, Crews |
| 5 | Subscriptions, Payments, Commissions, Pay periods (Stripe) |
| 6 | Messages, Templates, Email/SMS delivery (Resend + Twilio) |
| 7 | Reports, Dashboards, Analytics |
| 8 | Integrations (QuickBooks, partner APIs) |
| 9 | Mobile app polish + AI copilots |

Do not ship anything from Phase ≥2 without explicit scope approval.
