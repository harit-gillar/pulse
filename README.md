# Pulse — Google Health dashboard

Apple-style personal health dashboard. Next.js 16 + Tailwind v4 + Framer Motion + Recharts, wired to the **Google Health API** via **Supabase Auth** (Google provider) and deployable to **Vercel**.

Without any env vars set, the dashboard renders against mock data so the UI is buildable cold.

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

`/` is the landing. `/dashboard` shows the demo (mock) view. Once Supabase is configured (below), the landing's "Continue with Google" button kicks off OAuth; the dashboard then fades real data in over the mock baseline.

## Setup checklist

### 1. Supabase project
- Create a project at supabase.com.
- Copy the project URL and `anon` key into `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ```
- In the SQL editor, paste and run [`supabase/schema.sql`](./supabase/schema.sql).

### 2. Google Cloud Console
- Enable the **Google Health API** (`health.googleapis.com`).
- OAuth consent screen: **Testing** mode. Add your own email under **Test users**.
- Create an **OAuth 2.0 Client ID**, type **Web application**.
  - Authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
- On the **Data Access** page, add these scopes:
  - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
  - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
  - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
  - `https://www.googleapis.com/auth/googlehealth.profile.readonly`

### 3. Supabase → Google provider
- Authentication → Providers → **Google**: enable; paste the Client ID + Secret from step 2; in **Additional Scopes**, paste the four scope URLs space-separated.

### 4. Vercel deploy
- Push to a new GitHub repo.
- Import it in Vercel. Set the two env vars from step 1.
- Add the Vercel preview/production URL to the Google OAuth client's **Authorised JavaScript origins**.

## Architecture

- `app/page.tsx` — landing + `Continue with Google` button (`supabase.auth.signInWithOAuth`)
- `app/auth/callback/route.ts` — Supabase OAuth code exchange
- `app/api/dashboard/route.ts` — server route; reads `daily_snapshots` cache or fetches Google Health and writes it back
- `lib/google-health.ts` — typed wrapper for `health.googleapis.com/v4/users/me/dataTypes/.../dataPoints`
- `lib/supabase/{client,server}.ts` — Supabase SDK wrappers, safe to import when env vars are unset
- `proxy.ts` — Next.js 16 proxy (renamed from middleware) that refreshes the Supabase session cookie

## Caveats

- Google OAuth in **Testing** mode issues refresh tokens that expire after 7 days. Personal use is fine; production needs Google's app verification.
- The Health API's exact field names for HRV / resting heart rate aren't fully documented yet — `lib/google-health.ts` normalises best-effort and falls through to zeros when fields are absent.
- HRV trend / sleep performance composite scores aren't shipped by Google; v1 leaves those at 0 in the live view (mock data shows realistic placeholder values).
