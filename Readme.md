# Umbra RoofCare

Subscription-first residential roofing CRM. A HoldCo platform coordinating regional OpCo subsidiaries (licensed contractors) across 13 user roles — from super admins and executives down to setters, inspectors, specialists, and crew members.

**Status:** Phase 5 — Monetization. Stripe-powered subscriptions (4 tiers × 3 billing frequencies with native proration), Stripe Connect per OpCo for job invoicing, an idempotent webhook pipeline, and a full commission engine (CRA enrollment + renewal residuals, sales-manager monthly overrides, specialist job commissions). Builds on Phases 1–4. Later phases add Messaging (6), Reports (7).

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

### 8. Phase 3 — Inspection Engine

After Phase 2 is verified, layer Phase 3 on top:

1. **Migrate.** In Supabase SQL Editor, run
   `supabase/migrations/00000000000004_phase3_inspection_storage.sql`.
   This adds the `inspection_templates` and `decision_engine_rules` tables,
   the `checkpoint_results`/`template_id` columns on `inspections`, the
   `create_inspection_opportunity` RPC (SECURITY DEFINER), and creates
   two private storage buckets — `inspection-photos` and
   `inspection-reports` — with OpCo-scoped RLS anchored on the leading
   UUID segment of each object path.
2. **Seed demo data (optional).** Run `supabase/seed_phase3.sql` to load
   the 20-point default template, the 6 default Decision Engine rules,
   and 6 completed inspections (healthy → critical) backfilled onto the
   first 6 Phase 2 members. The seed replays the Decision Engine
   in SQL so the opportunities table reflects what the app would have
   produced. Safe to re-run; idempotent on template/rule names and
   inspection notes.
3. **Deploy the edge function.** The PDF renderer runs on Deno:
   ```bash
   supabase functions deploy generate-inspection-report \
     --project-ref <YOUR_PROJECT_REF>
   ```
   Or via the dashboard: **Edge Functions → Create function →** paste the
   contents of `supabase/functions/generate-inspection-report/index.tsx`
   and `deno.json`. The function uses the default `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` secrets — no extra env vars.
4. **Verify storage buckets.** In the Supabase dashboard **Storage** tab
   you should see `inspection-photos` and `inspection-reports`, both
   private.
5. **Verify on the live app:**
   - `/inspections` lists the 6 seeded inspections with scores and condition bands.
   - Open one → detail page renders score gauge, category breakdown, findings, photos, and any Decision Engine opportunities.
   - `/inspections/queue` shows your assigned work. Assign an inspection to yourself to exercise the capture flow.
   - `/inspections/new` → pick a member + property + time → **Schedule**.
   - Open the scheduled inspection → **Start capture** → rate 20 checkpoints (photos optional) → **Complete inspection**. The Decision Engine fires on completion and creates opportunities.
   - `/settings/inspection-template` — adjust a weight, click **Save OpCo template**; new inspections get the updated template while existing ones keep their original version.
   - `/settings/decision-engine` — tweak a rule&apos;s JSON conditions, press **Save as OpCo override**.
   - On a completed inspection, press **Generate report** to trigger the edge function; a downloadable PDF appears under the *Report* tab.

**Storage sizing.** Inspection photos are compressed client-side to ≤500 KB each; average inspection is 20–60 photos → ~15 MB per inspection. Reports are ~250 KB each. The Supabase free tier includes 1 GB — enough for roughly 60 complete inspections before you&apos;ll want to upgrade.

**Offline queue (Phase 8).** The mobile capture flow requires online uploads today. Failed uploads surface a retry button. IndexedDB / service-worker queuing ships in Phase 8.

### 9. Phase 4 — Service Delivery

Layer Phase 4 on after Phase 3 is verified:

1. **Migrate.** Run `supabase/migrations/00000000000005_phase4_service_delivery.sql` in the Supabase SQL Editor. It ALTERs the Phase 1 `opportunities`, `jobs`, and `crews` placeholders, adds `quotes` / `quote_line_items` / `crew_members` / `crew_availability`, and installs four SQL helpers: `generate_quote_number`, `recalculate_quote_totals` (trigger-driven), `accept_quote`, and an updated `create_inspection_opportunity`.
2. **Seed.** Run `supabase/seed_phase4.sql`. Creates 6 crews (3 per pilot OpCo) with M-F + Sat working hours, backfills the 5 Phase 3 opportunities across pipeline stages, inserts 3 quotes with line items, and 12 jobs spanning every status. Idempotent.
3. **Deploy the quote PDF edge function:**

   ```bash
   supabase functions deploy generate-quote-pdf --project-ref <PROJECT_REF>
   ```

   Or paste `supabase/functions/generate-quote-pdf/index.tsx` and `deno.json` into the dashboard's edge function editor. Reuses the `inspection-reports` bucket.
4. **Verify on the live app:**
   - `/opportunities` renders the kanban with cards across prospecting / quoted / scheduled. Drag a card between columns — it persists on refresh.
   - Drill into an opportunity → **New quote** → fills the line-item editor. Edit a row, click **Update**; totals recompute from the trigger.
   - On a sent quote, **Accept quote** calls the `accept_quote` RPC, creates a job (routes you to `/jobs/[id]`), and advances the opportunity to `scheduled`.
   - `/quotes` lists every quote with status filters.
   - `/jobs` shows 12 jobs; open one → tabs for Overview · Scope · Schedule · Photos · Completion · Activity.
   - `/jobs/[id]/complete` is the mobile-first completion flow — camera + notes + canvas signature. Signature uploads into the `inspection-photos` bucket.
   - `/crews` lists 6 crews. Each detail page edits members + weekly availability + time off.
   - `/schedule` is the operational dashboard: crew rows × day columns for the current week. Drag unscheduled jobs from the sidebar onto a crew-day cell → persisted via `scheduleJob` server action. Prev/next week + reset.

**RBAC reminders.** Inspectors, CRAs, and CSMs can see opportunities but only managers / sales_managers / specialists can quote. Only opco_gm / sales_manager can accept a quote (triggers the opportunity → job RPC). Crew members can only complete jobs they're rostered on.

### 10. Phase 5 — Monetization

Layer Phase 5 on after Phase 4 is verified:

1. **Migrate.** SQL Editor → run
   `supabase/migrations/00000000000006_phase5_monetization.sql`. It drops
   the Phase 1 placeholder `subscriptions` and `commissions` tables
   (which are empty by design — the migration raises if rows exist),
   recreates them per the Phase 5 spec, and adds `subscription_plans`,
   `subscription_events`, `invoices`, `opco_stripe_accounts`, plus the
   SQL helpers `compute_frequency_price`, `create_cra_enrollment_commission`,
   `create_cra_renewal_residual`, `compute_sales_manager_overrides`, and
   a `jobs → specialist_job` commission trigger on job completion.

2. **Seed.** Run `supabase/seed_phase5.sql`. Verify counts with:

   ```sql
   select 'subscription_plans', count(*) from subscription_plans
   union all select 'subscriptions', count(*) from subscriptions
   union all select 'invoices', count(*) from invoices
   union all select 'commissions', count(*) from commissions;
   ```

   Expect 4 plans, 4 subscriptions, 8 invoices, 7–9 commissions
   (depending on how many seeded jobs have a completed status + a
   specialist on file — the seed caps the specialist commissions at 2).

3. **Stripe env vars.** Set in Vercel:
   - `STRIPE_SECRET_KEY` (test mode `sk_test_…`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode `pk_test_…`)
   - `STRIPE_WEBHOOK_SECRET` (set after step 5)

4. **Initialize Stripe products.** Log in as super admin →
   `/settings/stripe` → **Initialize Stripe products**. One Stripe
   Product per tier + 3 Prices (annual / monthly / quarterly) are
   created and linked back to `subscription_plans`.

5. **Register the webhook.** Stripe Dashboard → Developers → Webhooks →
   Add endpoint. URL: `https://umbra-roof-care.vercel.app/api/webhooks/stripe`.
   Events: `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.created|updated|deleted`,
   `customer.subscription.trial_will_end`, `charge.refunded`,
   `account.updated`. Copy the signing secret into Vercel as
   `STRIPE_WEBHOOK_SECRET` and redeploy.

6. **Onboard each OpCo's Connect account.** `/settings/stripe` →
   under **Connect accounts**, press *Create Connect account* for each
   OpCo, then *Send onboarding link* so the GM can finish KYC in
   Stripe's hosted flow. Job invoices route through these accounts.

7. **Verify on the live app:**
   - `/members/{seeded-member-id}/subscription` — shows the active
     subscription, next renewal, payment method management, change
     plan, cancellation flow.
   - `/invoices` — 8 seeded invoices filterable by status/kind.
   - `/commissions` — role-aware ledger. OpCo GMs see the full OpCo
     roster; CRAs only see their own.
   - `/commissions/review` — approve pending commissions in batch.
   - `/commissions/payroll` — compute monthly sales-manager overrides
     via the `compute_sales_manager_overrides` RPC, mark the approved
     batch paid, export a CSV.
   - `/settings/subscription-plans` — read-only operator view of the
     4 tiers and their Stripe linkage.

8. **Test webhook delivery.** Stripe Dashboard → Webhooks → your
   endpoint → *Send test webhook* → `invoice.paid`. Confirm a row
   appears in the `subscription_events` table with `processed_at` set.

**What's deliberately stubbed until Phase 6.**
- No email is sent when a quote/invoice is generated — the Send button
  only updates status.
- Trial-end reminders don't fire yet; the webhook handler records the
  event but doesn't notify.

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
- **/inspections** — scored inspection list, filterable by status / range / inspector; click through to the detail view with tabs (Overview · Checkpoints · Findings · Photos · Score · Report · Activity).
- **/inspections/queue** — inspector&apos;s personal queue: in-progress, today, this week, unassigned.
- **/inspections/new** — schedule an inspection against a member + property + time.
- **/inspections/[id]/capture** — mobile-first capture flow: 20-checkpoint progress bar, pass/warn/fail pads, camera uploader, review + complete.
- **/settings/inspection-template** — edit the 20-point template per OpCo (versioned; existing inspections keep their version).
- **/settings/decision-engine** — edit or override the JSON conditions and actions the engine evaluates on completion.
- **/opportunities, /jobs, /commissions, /messages, /reports** — placeholder pages marked with their target phase.

To verify multi-tenant isolation, invite an `opco_gm` in one OpCo, sign in as them, and confirm they only see users attached to their OpCo.

---

## Project layout

```
app/
  (auth)/login/                  public sign-in
  (app)/                         protected shell (sidebar + topbar)
    dashboard/
    members/ canvass/ appointments/
    inspections/                 list, queue, new, detail, capture flow
    opportunities/ jobs/ commissions/ messages/ reports/
    settings/
      profile/ organizations/ users/ teams/
      inspection-template/       Phase 3 editor
      decision-engine/           Phase 3 rule editor
  api/users/invite/              admin-only invite endpoint
components/
  ui/                            shadcn-style primitives
  nav/                           sidebar, topbar, nav-items
  brand/                         Umbra wordmark and roof mark
  inspections/                   ScoreDisplay, PhotoUploader, FindingsList, PhotoGrid, badges
lib/
  supabase/                      browser, server, admin clients + middleware
  auth.ts                        getSession / requireSession / requireRole
  rbac.ts                        role definitions and guards
  types.ts                       shared DB types
  activity.ts                    activity_log writer
  decision-engine.ts             Phase 3 rule evaluation + opportunity creation
  inspections/
    template.ts                  default 20-point template + helpers
    scoring.ts                   weighted 1-100 scoring + bands/actions
    actions.ts                   server actions (schedule/rate/photo/finding/complete/replay)
supabase/
  migrations/                    initial_schema / rls_helpers / territories_zip / phase3_inspection_storage
  functions/
    generate-inspection-report/  Deno edge function rendering the PDF
  seed.sql, seed_phase2.sql, seed_phase3.sql
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
