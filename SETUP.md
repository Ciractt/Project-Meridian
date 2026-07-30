# Local setup

Two things need credentials: Duffel (flight search) and Supabase (accounts).
Neither is needed to run the app — the search page and the account pages each
tell you what's missing instead of crashing.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then fill in `.env.local` and **restart the dev server**. Next.js reads env
vars at boot; editing the file while it's running does nothing.

---

## Duffel

Dashboard → API keys → create a **test** token. It starts `duffel_test_`.

```bash
DUFFEL_API_TOKEN=duffel_test_...
```

Sandbox content is thin and comes from airlines' own test systems, so some
routes return nothing. `LHR → JFK` reliably returns Duffel Airways offers.
Prices and schedules there are not realistic — don't tune anything against
them.

---

## Supabase

Pick one. Hosted is quicker to get going; local is better once migrations
start piling up. You can do hosted now and add local later — the migration
files work with both.

### Option A — Hosted project (no Docker, ~5 minutes)

1. Create a project at supabase.com. Save the database password it gives you.
2. **Run the migration.** Dashboard → SQL Editor → New query → paste the whole
   of `supabase/migrations/0001_profiles_and_roles.sql` → Run.
3. **Get the keys.** Settings → API Keys.
   - Projects created from November 2025 onward have a **Publishable key**
     (`sb_publishable_...`) and no anon key. Use that.
   - Older projects show an **anon** key under the Legacy API Keys tab. Also
     fine.
   - Do **not** copy a secret / `service_role` key. It bypasses row-level
     security entirely and must never be in a `NEXT_PUBLIC_` variable.
4. Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

5. **Turn off email confirmation for development.** Authentication →
   Sign In / Providers → Email → disable "Confirm email". Otherwise sign-up
   sends a real email through Supabase's built-in sender, which is rate-limited
   to a handful per hour and explicitly not for production. Leave it on when
   you go live, with your own SMTP provider behind it.

6. **Run the remaining migrations** the same way, in order:
   `0002_search_cache.sql`, `0003_orders.sql`, `0004_payments.sql`,
   `0005_order_documents_flag.sql`, `0006_ancillaries.sql`,
   `0007_promotions.sql`, `0008_route_prices.sql`, then
   `0009_webhooks_and_pending_orders.sql`.

7. **Add the secret key.** Settings → API Keys → Secret keys (or the
   `service_role` key under Legacy API Keys). This one bypasses row-level
   security, so it is server-only and must never appear in a `NEXT_PUBLIC_`
   variable:

```bash
SUPABASE_SECRET_KEY=sb_secret_...
```

   Without it the app still works — the search cache is simply bypassed and
   every search goes to Duffel. `/admin` will tell you so.

8. Make yourself an admin. SQL Editor:

```sql
update public.user_roles set role = 'admin'
where user_id = (select id from auth.users where email = 'you@example.com');
```

### Option B — Local stack (needs Docker)

Mirrors production exactly — same Postgres version, same RLS engine — and
costs nothing per experiment.

```bash
brew install supabase/tap/supabase   # or: npm i -D supabase
supabase init                        # writes supabase/config.toml
supabase start                       # first run pulls ~1GB of images
```

Docker Desktop must already be running, or you get a confusing error about the
Docker daemon.

`supabase start` prints the URLs and keys for the local stack. Typically:

| Service       | URL                     |
| ------------- | ----------------------- |
| API           | `http://localhost:54321` |
| Postgres      | `localhost:54322`        |
| Studio        | `http://localhost:54323` |
| Mail catcher  | `http://localhost:54324` |

Use the printed values rather than these, in case your ports differ. Then:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key it printed>
```

The local stack still calls it an `anon key`; the app accepts either variable
name.

Apply migrations:

```bash
supabase db reset   # recreates the database and runs supabase/migrations/*
```

Confirmation emails go to the local mail catcher instead of the internet, so
you can leave email confirmation on and click the link there.

Make yourself an admin via Studio's SQL editor, using the same `update`
statement as Option A.

### Going from local to hosted, later

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push       # applies migrations the remote hasn't seen yet
```

`db push` tracks what it has applied in a `supabase_migrations` table, so it's
safe to re-run.

---

## Sanity check

1. `npm run dev`, then `/sign-up` → create an account.
2. `/account` should greet you. If it bounces to `/sign-in`, email confirmation
   is still on and the account isn't confirmed.
3. Run the `update user_roles` statement, reload — an **Admin** link appears in
   the header.
4. `/admin` should load. Sign out and visit `/admin` directly: it should
   redirect, not flash the page first.

That last check is the one worth doing. The gate is a server-side layout, so an
unauthorised user should never receive the markup at all.

---

## Webhooks

Duffel needs somewhere to send events. Without this, orders that come back
`202 Accepted` are never resolved and airline schedule changes go unnoticed.

1. Deploy, or expose your dev server: `npx untun@latest tunnel http://localhost:3000`
2. Duffel Dashboard → Webhooks → add `https://<your-host>/api/webhooks/duffel`
3. Subscribe to `order.created`, `order.creation_failed`,
   `order.airline_initiated_change_detected` and `payment.created`
4. Copy the signing secret into `DUFFEL_WEBHOOK_SECRET` and restart

Test it with the ping endpoint from the dashboard. A successful ping returns
`{"received":true}`; a second identical delivery returns
`{"received":true,"duplicate":true}`, which is the idempotency check working.

The endpoint rejects unsigned and mis-signed requests with a 400 and logs the
reason. If it returns 500 with "not configured", the secret is missing.
