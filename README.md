# Sining Banwa event system

Thesis prototype for Sining Banwa. Phase 1 sets up the Next.js app and Supabase Auth.

## What this phase includes

- Next.js App Router, JavaScript, and Tailwind CSS
- Login, sign-up, email confirmation, password reset, and logout
- One server-side session check used by the protected account page
- Supabase URL and keys in `.env.local`

Roles, events, seats, payments, tickets, and SMS are later phases.

## 1. Install the tools

Node.js LTS and the Supabase CLI should already be installed. Check them:

```powershell
node -v
npm.cmd -v
supabase --version
```

If PowerShell blocks `npm`, use `npm.cmd` instead. That is a Windows script-policy limit, not an app error.

## 2. Connect your existing Supabase project

1. Open [Supabase](https://supabase.com/dashboard) and select your project.
2. Go to **Project Settings → Data API** and copy the project URL.
3. Go to **Project Settings → API Keys**. Copy the `anon` key and the `service_role` key.
4. Paste them into `.env.local`. Do not commit that file and do not paste the keys into chat.
5. Restart the dev server after saving the file.

In **Authentication → Sign In / Providers**, keep Email enabled and turn on **Confirm email**.

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

In **Authentication → Email Templates**, point the links at this app.

Confirm signup:

```html
<h2>Confirm your Sining Banwa account</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm email</a></p>
```

Reset password:

```html
<h2>Reset your Sining Banwa password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
```

## 3. Run the app

```powershell
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000).

Check the connection without printing secrets:

```powershell
curl.exe http://localhost:3000/api/health
```

A working connection returns `"ok": true`. The response never includes the keys.

## 4. Test authentication

1. Sign up with a real email you can open.
2. Open the confirmation link, then log in.
3. Open Account. You should see your email.
4. Log out. Opening `/account` should send you back to login.
5. Use Forgot password, open the email link, and set a new password.
6. Log in with the new password.

## Key rule

The browser uses the anon key. The service role key is only read by [lib/supabase/admin.js](lib/supabase/admin.js), and Phase 1 does not use it to create accounts. Creating accounts with that key would skip the confirmation email.

## Database

Phase 1 does not add a table. SQL files for later phases go in [supabase/migrations](supabase/migrations).
