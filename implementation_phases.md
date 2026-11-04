# Implementation Phases
## Web-Based Event Management System for Sining Banwa with SMS Notification

This document divides the project into manageable development phases for a **new build**. Complete and test each phase before moving to the next.

**Technology stack (see Project Specification, Section 9):** Next.js (App Router) with JavaScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage, Row Level Security), the `qrcode` and `html5-qrcode` npm packages, UniSMS for SMS (added in Phase 10), and polling for live seat updates. Local development uses VS Code, Node.js, and the Supabase CLI. Deployment uses Vercel for the application and Supabase cloud for data.

**Project nature:** This is a prototype for the thesis defense, deployed on Vercel for demonstration. There is no payment system. Customers pay to the admin's static QR code image, click "I've paid" with a reference number and screenshot, and staff approve or reject payments manually. Account emails come only from Supabase Auth.

## Phase 1: Project Setup and Authentication
**Goal:** Prepare a clean, organized project foundation with working login.

- Install Node.js (LTS), VS Code, and the Supabase CLI, and confirm that Node.js runs locally.
- Create a Next.js project with the App Router and Tailwind CSS.
- Create a Supabase project and connect the app to it.
- Create the folder structure, for example: `app/` (pages and routes), `app/api/` (server endpoints), `components/` (reusable UI), `lib/` (Supabase client and helpers), `supabase/migrations/` (numbered SQL migration files), and `public/` (static files).
- Create a `.env.local` file for Supabase URL and keys, keep it out of version control, and add a `.env.example` file with placeholder values.
- Use the Supabase anon key in the browser and the service key only on the server.
- Configure Supabase Auth: email and password sign-in, and sign-up confirmation and password reset emails.
- Add login, logout, and a central server-side session check.
- Initialize Git for version control.
- Create a basic page layout (header, footer, navigation) with Tailwind CSS.

**Completion check:** The project runs locally, connects to Supabase, a user can sign up, confirm email, log in, and log out, and the project is committed to Git.

## Phase 2: Event Database and Management
**Goal:** Let authorized staff manage Sining Banwa events and let the public browse published events.

- Add a numbered, additive SQL migration for event records, including title, description, venue, Philippine-local start date/time, optional poster filename, status, creator, and timestamps.
- Each event also has a run (start date and number of days) and showtimes. Each date plus time is a separate showing with its own seats or ticket count. The event start used for sorting is the earliest showing.
- Support `draft`, `published`, `completed`, and `cancelled` statuses. Only published events appear in public listings and details; retain records by changing status instead of hard-deleting.
- Allow administrator and staff accounts to create, edit, publish, complete, and cancel events. Customer and venue roles must not manage events.
- Enable Row Level Security on the events table so public users can read only published events.
- Validate event fields on the server, and render output safely in React.
- Support optional JPG, PNG, or WebP posters up to 5 MiB, stored in a private Supabase Storage bucket under generated filenames. Serve posters through a route that checks publication state or event-manager authorization, using short-lived signed URLs.
- Add public event listing and detail pages and link them from the homepage and navigation.
- Keep seat layouts, reservations, manual bookings, payments, tickets, notifications, attendance, expenses, reports, and evaluations for their later phases.

**Completion check:** The migration applies without altering existing account data; admin/staff can manage events; only published events and their posters are public; invalid uploads and unauthorized requests are rejected.

## Phase 3: User Accounts and Access Control
**Goal:** Make sure each user can access only the pages and actions allowed for their role.

- Support customer, administrator/staff, and venue personnel roles, stored in a `profiles` table linked to Supabase Auth users.
- Implement customer registration (with a required email address) and login for all roles.
- Block inactive accounts.
- Protect restricted pages and actions with one central role-check function used by every route and server action.
- Add RLS policies so that customers can read and update only their own profile rows.
- Add basic profile management.

**Completion check:** Role checks work on every protected page and action, and inactive or unauthorized users are rejected.

## Phase 4: Public Website and Customer Accounts
**Goal:** Present published events to the public and let signed-in users manage their own account details.

- Show published events on the homepage and keep the public event listing and detail pages.
- Let every signed-in user update their own name and optional phone number, and change their password only after the current password is verified.
- Keep email and role read-only on the profile page so customers cannot change their access level.
- Update the customer dashboard so it links to published events and profile management.
- Add a customer contact list export for admins (CSV of name, email, and phone) to support manual messages.
- Do not add reservations, payments, tickets, or notifications in this phase.

**Completion check:** A guest can browse published events from the homepage. A signed-in customer can update their profile, and an incorrect current password does not change the password. No new database migration is required.

## Phase 5: Visual Seat Layout Designer
**Goal:** Let management design each show as either a seated layout or general admission, and show how many places remain.

- Create and manage seating sections, rows, and seats for seated events.
- Set a price and a tier label for each section or row. Example: row 1 is VIP at 300 pesos, and row 2 is VIP at 250 pesos. Tiers are VIP, Semi-VIP, and Regular.
- Color seats by tier. Regular is green, Semi-VIP is blue, and VIP has its own separate color. The seat map and the legend use the same colors and labels for management and customers.
- Place sections, rows, and seats by dragging them on the canvas. Save those positions so the layout reloads exactly as designed. A seated event cannot be published until that layout is saved. If it is missing, say so instead of calling the show Full.
- Mark seats as available, blocked, reserved, or sold as appropriate.
- Provide a preview of the layout before bookings are accepted.
- When creating an event, choose seated or general admission. A seated event uses the seat map. A general admission event has no seat map. The admin sets a capacity and one ticket price, and customers reserve a number of tickets instead of specific seats.
- For every show, the admin sets the total audience capacity. Management and customers can see how many seats or tickets remain. When none remain, the show is marked Full and customers cannot reserve it. Seated remaining comes from available seats on the map. General admission remaining is capacity minus reserved tickets.
- Display the saved layout consistently to management and customers. Only seated events show the seat map.
- Prevent changes that would move or delete booked or sold seats, using a Postgres function so the check and the change happen in one transaction.
- Provide an accessible close control and a Back option when previewing an event poster so users can return without getting stuck on the image.

**Completion check:** Management can drag a layout into place, set a different price and tier per row, reopen it, and see the same positions, colors, and prices. A general admission event has no seat map. Both event types show remaining places, and a full show cannot be reserved.

## Phase 6: Online Reservations and Seat Holds
**Goal:** Allow customers to reserve available seats without double-booking.

- Display available events, seating layouts, and prices. The customer chooses a showing (date and time) first. A general admission showing skips the seat map and asks for a ticket count. The booking clock uses that showing's start time.
- Allow customers to select one or more seats on a seated event, or a number of tickets on a general admission event. A full show cannot be reserved.
- Calculate the total on the server using the selected seats' database prices; never trust prices sent by the browser.
- Temporarily lock selected seats for five minutes (configurable) using a Postgres function that runs `SELECT ... FOR UPDATE` inside a transaction, plus a unique constraint to block duplicates.
- Release expired locks (for seats with no submitted payment proof) whenever seat availability is read or a reservation is attempted, with an optional scheduled cleanup.
- Update the seat map live by polling the server every few seconds.
- Create a reservation with its reservation items in one transaction.
- Show reservation status and details to the customer.
- Accept online bookings only from 8:00 AM to 8:00 PM, using Asia/Manila time.
- Close online booking 3 hours before the show starts. The close time is the earlier of 8:00 PM and 3 hours before the start.
- Keep a hold in place after payment proof is recorded, until an administrator decides. The "I've paid" button itself is Phase 8. The same clock will gate that later payment submission.

**Completion check:** Multiple seats can be reserved together, totals are correct, expired locks are released, the seat map updates for other users without refreshing, and the same seat cannot be booked twice. A booking outside 8:00 AM to 8:00 PM, or inside the 3-hour cutoff, is rejected by the server.

## Phase 7: Admin and Manual Booking
**Goal:** Allow authorized staff to book tickets on behalf of customers, including walk-in sales.

- Add a booking screen in the admin/staff area. The staff member selects the event, then one showing.
- For a seated show, the staff member selects specific seats. For general admission, the staff member enters a ticket count. There is no seat map for general admission.
- Pick an existing customer account, or enter the customer's name and contact details when the person has no account.
- Mark the seats or tickets sold immediately. Do not use the five-minute hold, and do not ask for a payment screenshot.
- Record the source as `admin` or `walk_in`, and store the staff member who created the booking.
- Update the remaining count, seat map, and Full status for other users through the existing poll. Do not add a live socket.
- Do not apply the 8:00 AM to 8:00 PM window or the 3-hour online cutoff to admin or walk-in bookings.
- Use the same Postgres locking rule as online booking: `SELECT ... FOR UPDATE` inside a transaction, so two staff members cannot sell the same seat.
- Make these bookings visible in the show's reservation records. The total comes from database prices, not from the browser.

**Completion check:** Staff can sell seats or tickets immediately, the record shows the source and the staff creator, and a second sale of the same seat is rejected. Online time limits do not block this screen.

## Phase 8: Payment Submission and Verification
**Goal:** Track payments and prevent unverified payments from being treated as completed sales.

- Let management upload and display the admin's static payment QR code image and payment instructions.
- Provide an "I've paid" button that asks the customer for a payment reference number and a screenshot.
- When "I've paid" is submitted, keep the seats held until the admin approves or rejects the payment, even if the original five-minute hold has passed.
- Move the reservation to payment verification and show it in the admin dashboard's list of payments waiting for review, with a count badge.
- Validate screenshot file type and size, store it in a private Supabase Storage bucket, and allow only the owner and authorized staff to view it through signed URLs.
- Let authorized staff approve or reject submitted payments from the dashboard.
- Allow the customer to resubmit after rejection, with seats held during resubmission.
- Track pending, verified, and rejected payment statuses.
- Record payment amount, method, reference, submission time, verification time, and verifying staff member.
- Show the customer a "Payment confirmed" message on their reservation page after approval, and a "Payment rejected" message with a resubmit option after rejection.
- Do not claim automatic payment verification; no payment-provider integration is included.
- Run `supabase/migrations/20261104120000_showings_and_payments.sql` once in the Supabase SQL Editor. It adds showings and payment tables. It does not drop tables.

**Completion check:** Seats stay held after "I've paid" until a decision; staff can approve or reject a payment; the customer sees the result on their reservation page; reports distinguish pending payments from verified payments.

## Phase 9: QR Ticket Display, Download, and Entrance Scanning
**Goal:** Show a downloadable QR ticket after approval and let staff validate it at the entrance.

- Decide whether tickets are issued per reservation or per reserved seat.
- Generate a unique ticket identifier after payment approval. The QR code (created with the `qrcode` package) holds only the ticket identifier.
- Show the QR code on the customer's ticket page only after approval, with a prompt to screenshot it or click a download button to save it as an image.
- Provide a print-friendly ticket view where practical.
- Build the venue scanning page using the `html5-qrcode` package, with manual code entry as a fallback. Camera access requires HTTPS, which Vercel provides.
- Validate ticket status and event details when scanned, through a server route.
- Record successful entry with the date, time, and venue personnel account.
- Reject invalid, cancelled, wrong-event, or previously used tickets.
- Prevent duplicate scans from recording a second entry, using a unique constraint on attendance records per ticket.
- Do not send tickets by email.

**Completion check:** A ticket QR code appears only after approval, can be downloaded, can be scanned once at the entrance, and a second scan is rejected.

## Phase 10: SMS Notifications (UniSMS) and Reminders
**Goal:** Send SMS updates to customers for payment decisions, reservation changes, and event reminders.

- Connect UniSMS by calling its REST API from the server. Keep the UniSMS credentials only in server-side environment variables.
- Send SMS for payment approval and rejection, reservation updates, and day-before event reminders.
- Store notification type, recipient, status, provider response, and timestamps.
- Handle provider errors, avoid reporting failed messages as sent, and make sure SMS failures never break a reservation.
- Create a reminder route that Vercel Cron calls once a day to send day-before reminders, avoiding duplicates. A manual trigger is available for the demo.
- Verify UniSMS delivery with approved test numbers, and mark any untested message type as unverified.

**Completion check:** Test SMS messages are sent through UniSMS, their results are recorded accurately, and failed messages are not reported as sent.

## Phase 11: Attendance, Reports, Expenses, and Evaluation
**Goal:** Help Sining Banwa monitor event performance.

- Show attendance from validated ticket scans.
- Provide sales, reservation, payment, and attendance reports, using SQL views or Postgres functions for totals.
- Filter reports by event and date where useful.
- Separate online bookings from staff-created bookings.
- Count verified payments separately from pending or rejected payments.
- Allow authorized staff to record production expenses and manually entered compensation amounts.
- Provide an event evaluation form for completed events, prevent duplicate evaluations with a unique constraint, and summarize submitted feedback.

**Completion check:** Report totals match the underlying records, and attendance and evaluation data are saved correctly.

## Phase 12: Dashboard, Security, and Interface Improvements
**Goal:** Improve usability and protect the application.

- Display useful summaries on the dashboard, such as upcoming events, reservations, verified sales, and attendance.
- Make pages responsive on desktop, tablet, and mobile screens using Tailwind responsive classes.
- Add clear success, error, empty-state, and confirmation messages.
- Validate and sanitize user input, and use parameterized queries everywhere.
- Review and test Row Level Security policies on every table.
- Apply role checks to all protected actions and server routes.
- Set secure HTTP headers in the Next.js configuration.
- Prevent uploaded files from running as code and keep them in private storage buckets.
- Avoid exposing service keys, SMS credentials, or sensitive information in public pages.
- Check session handling and error logging, and log important administrative actions.

**Completion check:** Main workflows are usable on different screen sizes, and security checks are in place.

## Phase 13: Testing and User Acceptance
**Goal:** Confirm that the system meets the requirements before the defense.

- Test each feature individually and test complete workflows.
- Test incorrect login, inactive accounts, and unauthorized access, including RLS policies.
- Test sign-up confirmation and password reset emails from Supabase Auth.
- Test seat pricing, multiple-seat reservations, expired locks, and simultaneous booking attempts.
- Test payment approval, rejection, and resubmission, including seats held after "I've paid."
- Test QR ticket issuance only after approval, QR download, and duplicate scans.
- Test SMS success and failure handling; mark any untested integration as unverified.
- Test reports against known sample data.
- Ask intended users, such as staff and audience representatives, to try the system and provide feedback.
- Record the expected result, actual result, and pass/fail status of each test.
- Fix issues and repeat the relevant tests.

**Completion check:** The required test cases pass, known issues are documented, and intended users approve the core workflows.

## Phase 14: Vercel Deployment, Backup, and Documentation
**Goal:** Deploy the demo and prepare it for the defense.

- Deploy the Next.js application on Vercel, and confirm Node.js version, environment variables, HTTPS, Vercel Cron support, and outbound access to UniSMS.
- Configure the production Supabase project and application settings; keep keys in Vercel environment variables and the local `.env.local` file only.
- Apply all SQL migrations to the production Supabase database in order, and record which migrations were applied.
- Configure Supabase Auth email templates for sign-up confirmation and password reset.
- Load demo data (events, seat layouts, and sample accounts) for the presentation.
- Set up a backup and recovery procedure: Supabase database exports and a copy of the private storage files.
- Keep an offline copy of the working demo (a local Supabase instance on a laptop) in case internet access fails during the defense.
- Create user instructions for administrators, staff, customers, and venue personnel.
- Document installation, configuration, known limitations, and maintenance procedures.
- Verify the deployed system using test accounts before the defense, and confirm the Supabase project has not paused.

**Completion check:** The deployed application works, backups can be restored, the offline copy runs, and the required documentation is available.

---

## Development Rules for AI-Assisted Coding

1. Work on only one phase at a time.
2. Use only the technology stack listed above; ask before adding another framework or service.
3. Build from the current phase's requirements and inspect the existing files and database before changing them.
4. Explain which files will be added or changed before making major changes.
5. Keep server code, components, Tailwind styles, and client code organized where practical.
6. Provide SQL changes as separate numbered migration files in `supabase/migrations/` and explain exactly where to run them (Supabase SQL Editor or the Supabase CLI).
7. Back up the database before migrations that modify existing structures or data, and never drop or recreate tables that contain data without approval.
8. Do not use placeholder integrations as if they were real SMS services, and do not claim payment verification beyond the manual process.
9. Explain changes in simple language suitable for a BSIT student.
10. After each phase, give clear testing steps and wait for confirmation before proceeding.
11. If an error occurs, troubleshoot the current phase before adding new features.

## Suggested Priority

Build in this order: project setup and authentication → events → access control → public website → seat designer → reservations and holds → manual bookings → payments → QR tickets and entrance scanning → SMS and reminders → reports and evaluation → security and interface improvements → testing → Vercel deployment.

**Important:** SMS delivery depends on UniSMS and the credentials configured for the project. It must be tested rather than assumed to work. Payment verification remains manual because the system only displays a static QR code image.
