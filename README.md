# Sining Banwa event system

Thesis prototype for Sining Banwa. Phase 1 sets up the Next.js app and Supabase Auth. Phase 2 adds event records and public event pages.

## What Phase 1 includes

- Next.js App Router, JavaScript, and Tailwind CSS
- Login, sign-up, email confirmation, password reset, and logout
- One server-side session check used by the protected account page
- Supabase URL and keys in `.env.local`

## What Phase 2 includes

- An events table and a small `event_managers` table
- Draft, published, completed, and cancelled statuses
- Public pages for published events only
- Staff pages to create, edit, and change status
- Optional private posters, shown through a checked route

Seats, reservations, payments, tickets, and SMS are later phases.

## What Phase 3 includes

- A `profiles` table with roles: customer, administrator, staff, venue
- Customer sign-up with a required full name; new accounts are always customers
- Inactive accounts cannot log in
- One central role check (`requireRole` in [lib/auth.js](lib/auth.js)) used by every protected page and action
- Row Level Security: users read and edit only their own profile; administrators can manage all
- An administrator-only Users page

## What Phase 4 includes

- Published events on the homepage, plus the existing public event pages
- A signed-in dashboard that links to events and profile management
- Name and optional phone updates; email and role stay read-only
- Password change only after the current password is checked
- An administrator CSV download of customer name, email, and phone
- No new database migration, and no reservations, payments, tickets, or SMS

## What Phase 5 includes

- A seat layout for each event: sections, rows, and clickable seat boxes
- Section default prices and optional per-seat prices, in Philippine pesos
- Seat colors for available, awaiting payment, paid, on hold, and blocked
- The same saved layout on the staff designer and the public event page
- A database function that refuses to change a reserved, sold, or on-hold seat
- A poster preview page with Back and Close, so the picture is not a dead end
- No reservations, seat holds, payments, tickets, or SMS

## What Phase 6 includes

- Customers can select one or more available seats on a published event
- A five-minute hold, stored in the database, not chosen by the browser
- The total is calculated from saved seat prices inside a Postgres function
- Expired holds are released when seats are read, when a new hold is attempted, or by opening `/api/reservations/release`
- The public seat map polls every few seconds, so other people see holds without refreshing
- A customer page shows the reservation status, snapshot prices, and stored total
- No payment proof, staff booking, tickets, or SMS

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
2. Go to **Project Settings → Data API** and copy the project URL. Use only `https://your-project-ref.supabase.co`. Do not include `/rest/v1` or any other path.
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

The browser uses the anon key. The service role key is only read by [lib/supabase/admin.js](lib/supabase/admin.js). It is not used to create accounts, because that would skip the confirmation email. In Phase 2 it is used only on the server, after an access check, to store a poster and create a short-lived link to it.

## Database

Phase 1 does not add a table. Phase 2 adds [supabase/migrations/20261021120000_create_events.sql](supabase/migrations/20261021120000_create_events.sql). That file does not change existing accounts.

Run it in the Supabase SQL editor: open **SQL Editor**, paste the file, and click **Run**. If the project is already linked, you can instead run `supabase db push` from this folder.

The migration does not make your account a manager. (If you run the Phase 3 migration afterwards, existing managers are carried over automatically.) After it succeeds, run this once and replace the email with the account you use to log in:

```sql
insert into public.event_managers (user_id, role)
select id, 'administrator'
from auth.users
where email = 'you@example.com';
```

A customer account is not an administrator or staff, so it cannot create or edit events. There is no delete button. Cancelling an event only changes its status.

### Phase 3 database (run after Phase 2)

Run [supabase/migrations/20261022120000_create_profiles.sql](supabase/migrations/20261022120000_create_profiles.sql) the same way. It is a new file, so the Phase 2 file stays as it was. It creates `public.profiles`, gives every existing account a profile, and copies your Phase 2 managers over (they become administrators). The `event_managers` table is no longer used, but it is kept.

To make another account an administrator or staff, either use the **Users** page as an administrator, or run this once:

```sql
update public.profiles
set role = 'administrator'
where email = 'you@example.com';
```

Use `staff`, `venue`, or `customer` instead of `administrator` for other roles.

### Phase 5 database (run after Phase 3)

Run [supabase/migrations/20261023120000_create_seat_layouts.sql](supabase/migrations/20261023120000_create_seat_layouts.sql) in the Supabase **SQL Editor**: paste the whole file and click **Run**. It only adds seat tables and `save_event_layout`. It does not change events or accounts. Do not run it twice.

If you marked a seat reserved or sold while testing and need to undo that before real bookings exist, run this once and replace the title and label:

```sql
update public.event_seats
set status = 'available',
    price_override = null
where label = 'A1'
  and event_id = (select id from public.events where title = 'Your event title');
```

## 6. Test Phase 3

1. Sign up with a new email. The form now asks for a full name. Confirm the email, then log in.
2. Open **Dashboard**. It shows your role. Profile editing moved to **Profile** in Phase 4.
3. As a customer, open `/events/manage` and `/admin/users`. Both must send you to Account with a message.
4. Log in as an administrator. The header shows **Manage events** and **Users**.
5. In **Users**, change a customer to Staff. Log in as that staff account: **Manage events** works, **Users** does not.
6. In **Users**, untick **Active** for a customer and save. That customer cannot log in and sees an "inactive" message.
7. An administrator cannot change their own row on the Users page.

## 7. Test Phase 4

No new SQL. Phase 3 already stores the phone number.

1. Log out and open [http://localhost:3000](http://localhost:3000). Published events appear. A draft must not.
2. Open an event from the homepage without logging in.
3. Log in as a customer. The dashboard links to published events and **Profile**.
4. Save a new name and an optional phone. Email and role are text, not boxes you can edit.
5. Try to change the password with the wrong current password. Log out and log in with the old password. It must still work.
6. Change the password with the correct current password. Log in with the new one.
7. As a customer, open `/admin/customers/export`. It must refuse you.
8. As an administrator, open **Users** and click **Download customer contacts**. The file has `name`, `email`, and `phone` for customer accounts only.

## 9. Test Phase 6

1. Run `supabase/migrations/20261025120000_create_reservations.sql` once in the Supabase SQL Editor, after the Phase 5 file. Paste the whole file and click Run. Do not run it twice, and do not drop tables. `supabase db push` also works if the project is linked.
2. After that, run `supabase/migrations/20261026120000_seat_tiers_and_admission.sql` once the same way. This adds seat tiers, saved drag positions, seated or general admission, and audience capacity. It does not drop tables. Do not run it twice.
2. To change the hold length, run `update public.reservation_settings set hold_minutes = 5 where id = 1;` in the SQL Editor. New holds use the new number. Old holds keep the time they were given.
3. Publish an event that has at least two available seats with different prices.
4. Log in as a customer. Open the event, then **Choose seats**. Select both seats and click **Hold these seats**.
5. Open **Reservations**. The total must equal the two saved seat prices, not a number you typed.
6. Open the same event in another browser without refreshing after the first hold. Within a few seconds those seats turn purple and cannot be held again.
7. Wait for the hold to end, or set `hold_minutes` to 1 before creating a new hold. The seats become available again and the reservation shows **Expired**.
8. Cancel a new hold before it ends. The seats become available without waiting.
9. A blocked, reserved, or sold seat must not be selectable. A customer must not open event management. Payment is not on this page.

## 8. Test Phase 5

1. Run the Phase 5 SQL file in the Supabase SQL Editor, then refresh the app.
2. Log in as an administrator or staff member. Open **Manage events**, then **Seats**.
3. Add two sections with different default prices. Click empty boxes to add seats. Set one seat's own price, block one seat, and mark one seat reserved.
4. Click **Save layout**, then refresh. The labels, places, and prices must match what you saved.
5. Click **Preview layout**. It must show the same colors and prices, with no booking button.
6. Try to delete or rename the reserved seat and save again. The save must be rejected, and the old layout must stay.
7. Publish the event. Log out and open the public event page. The same layout and prices must be visible. A draft event's seats must not be.
8. Log in as a customer and open `/events/manage`. It must be refused.
9. Open **View poster**. Use **Back** and **Close**. Both must leave the picture. Opening the poster address directly in the browser must not dump you on the storage image with no way back.

## 5. Test events

1. Open [http://localhost:3000/events](http://localhost:3000/events) while logged out. Draft events must not appear.
2. Log in with the manager account and open **Manage events**.
3. Create a draft. Confirm it is missing from the public list.
4. Publish it. Confirm a guest can open the event page.
5. Upload a JPG, PNG, or WebP poster under 5 MiB. Confirm the image loads.
6. Try a larger file or a non-image file. Both must be rejected.
7. Log in as a normal customer and open `/events/manage`. It must say event management is closed.
8. Cancel the event. The row stays in Manage events, and the public page no longer shows it.
