# Cloud setup — Supabase

Grynd runs fully offline by default. To turn on cloud sign-in and multi-device
sync, point the app at a Supabase project. Nothing in the codebase changes
between "cloud on" and "cloud off" — the presence of the two env vars is
what flips it.

## 1. Create a Supabase project

1. Go to https://app.supabase.com and create a new project (free tier is
   fine).
2. Once the project is provisioned, open **Project Settings → API** and note
   the **Project URL** and the **anon public** key.

**Never** copy the `service_role` key into the app. That key bypasses row-level
security and must only be used from server-side code.

## 2. Enable providers

Under **Authentication → Providers**:

- **Anonymous Sign-Ins** — enable. The app calls `signInAnonymously()` on
  first launch so users can log workouts before signing in.
- **Email** — enable "Email OTP" (not magic link). The app uses the 6-digit
  code flow because deep-linking a magic link back into an installed iOS
  PWA is unreliable.

No OAuth provider is needed: email is the only sign-in method the app
offers. If you ever add Apple or Google, note that App Store guidelines
require offering Sign in with Apple once you offer any other third-party
sign-in — which is part of why the app stays on email alone.

### Adding phone sign-in later

The code side mirrors email almost exactly (`updateUser({ phone })` +
`verifyOtp({ type: 'phone_change' })`). The prerequisite is not free:
Supabase phone auth requires an external SMS provider (Twilio, MessageBird,
Vonage or Textlocal) configured under **Authentication → Providers →
Phone**, billed per message plus a monthly number rental. Set that up first
if you want it.

Under **Authentication → URL Configuration**:

- **Site URL**: your production web URL (e.g. `https://grynd.app`).
- **Redirect URLs**: add the deep-link scheme `workout-logger://auth-callback`
  and any local dev URLs (`http://localhost:8081`, Vercel preview domains).

## 3. Run the migrations

Two migration files live under `supabase/migrations/`:

- `001_initial.sql` — one table per persisted store (`splits`, `exercises`,
  `sessions`, `cycles`, `prefs`, `weight_entries`), row-level security on
  each, and policies scoping reads and writes to `auth.uid()`. Anonymous
  users get their own RLS-scoped island.
- `002_delete_user.sql` — a `delete_user()` RPC that lets a signed-in user
  self-serve delete their own account. The Settings → Danger zone →
  Delete account button calls this. Without it, "Delete account" fails
  with an "unknown function" error and the user has to email support.

Apply both through the Supabase SQL Editor (paste, run) or via the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 4. Point the app at the project

Copy the two values from step 1 into a local `.env` file (never commit it):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

For Vercel deployments, add the same two variables under **Project Settings
→ Environment Variables**. `EXPO_PUBLIC_*` names are inlined at build time,
so a rebuild is required after changing them.

If the vars are missing, the app runs without Supabase: `authStore.status`
resolves to `'unconfigured'`, the Settings sign-in row shows "Cloud sync
unavailable", and every sync call is a no-op. This is the default for CI
and local unit tests.

## 5. Verify

- Launch the app. The Account row in Settings should show "Not signed in"
  (anonymous session created silently).
- Open Supabase → **Authentication → Users**. A new row with `is_anonymous
  = true` should appear.
- Tap **Sign in** and complete the email OTP flow. The same user row
  should now have your email populated (identity linked, UID unchanged).

## Cost expectations

Supabase's free tier (500 MB DB, 2 GB egress/month, 50k monthly active
users) comfortably supports ~1000 active users. Beyond that, Supabase Pro
is $25/month plus usage. Nothing in the current data model needs Pro
features.
