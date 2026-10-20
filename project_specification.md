# Project Specification

## Web-Based Event Management System for Sining Banwa with SMS Notification

**Document type:** Project Specification\
**Project status:** Starting Development (new build, thesis defense prototype)\
**Organization:** Sining Banwa\
**Location:** Albay, Philippines\
**Purpose:** Thesis planning, implementation guidance, and LLM/Vibe Coding reference

## 1. Project Overview

The Web-Based Event Management System for Sining Banwa with SMS Notification is a responsive web application intended to centralize event management, ticket reservations, payment monitoring, attendance tracking, sales reporting, and audience evaluation.

Sining Banwa is an independent arts organization in Albay, Philippines, that conducts theater performances, workshops, and other cultural activities. The system will support online customer reservations and staff-created bookings while complementing existing publicity channels such as social media, meetings, and other communication methods.

### 1.1 Project Nature

The system is a working prototype built to demonstrate the thesis defense. It is deployed on Vercel for demonstration purposes and is not yet intended for live, real-money transactions. Sining Banwa does not have a payment system. Payment is made by sending money to a QR code (a static image) of the admin's account, and payment is verified manually by authorized staff. No payment-provider API is integrated.

## 2. Objectives

1.  Centralize event information and reservation records.
2.  Allow audiences to browse events and reserve seats online.
3.  Allow management to design a separate seating layout and pricing structure for each event.
4.  Support online and admin/manual bookings in one system.
5.  Organize payment submissions and manual payment verification.
6.  Generate unique electronic tickets and validate them during event entry.
7.  Record attendance through ticket scanning.
8.  Send SMS notifications for important reservation and event updates.
9.  Organize sales, recorded expenses, and event reports.
10. Collect and summarize audience feedback.
11. Protect operational and customer information through role-based access control.

## 3. Scope

### 3.1 Included Features

-   Public homepage, event listings, event details, and posters
-   Login and customer registration (with email address)
-   Customer dashboard and profile management
-   Administrator/staff dashboard
-   Event creation and management
-   Visual seating layout designer
-   Event-specific sections, rows, seats, and seat pricing
-   Online reservations and admin/manual bookings
-   Temporary seat locking (5 minutes while booking; held until the admin decides after payment proof is submitted)
-   Payment instructions and proof-of-payment submission
-   Manual payment verification
-   QR ticket shown and downloadable after payment is approved
-   Ticket scanning and validation at the entrance
-   Attendance recording
-   SMS notifications (UniSMS)
-   Account emails through Supabase Auth (sign-up confirmation and password reset)
-   Manual contact with customers by the admin (for example, a CSV export of customer emails)
-   Sales and reservation monitoring
-   Production expense recording
-   Reports and event evaluation
-   Responsive interface for desktop, tablet, and mobile
-   Security and role-based access control

### 3.2 Outside the Initial Scope

Unless separately approved, the initial system will not include a native mobile application, automatic payment verification without a payment-provider integration, automatic reservation or payment emails, integrations with third-party ticketing platforms or POS systems, automatic computation of actor/production staff compensation, or replacement of Sining Banwa's existing publicity activities.

## 4. User Roles and Permissions

### 4.1 Customer / Audience

Customers can view published events, register and log in, manage permitted profile information, view seating layouts and prices, reserve available seats, view reservation and payment statuses, submit payment details and proof when required, access their own QR tickets once approved, view reservation history, receive SMS notifications, and submit eligible event evaluations.

Customers must only access their own account, reservations, payment submissions, tickets, and evaluations.

### 4.2 Administrator / Staff

Authorized administrator/staff users can access the dashboard; create, edit, publish, complete, and cancel events according to permissions; design seating layouts; create sections, rows, and seats; set section and individual seat prices; block seats; manage reservations; create manual bookings; record the staff member who created each manual booking; review and approve or reject payments; monitor tickets and attendance; view sales information and reports; record production expenses and manually entered compensation amounts where required; review evaluations; export customer contact lists; and monitor notifications.

Sensitive operations must be restricted to authorized personnel. If administrator and staff permissions differ, the differences must be documented and enforced.

### 4.3 Venue Personnel

Venue personnel can access a venue dashboard, select assigned events, scan tickets, validate ticket status and event association, record successful check-ins, and view attendance information required for event entry.

Venue personnel must not access payment verification, user administration, or sensitive financial reports unless specifically authorized.

## 5. Functional Requirements

### FR-01: Authentication and Access Control

-   Users must log in before accessing protected features.
-   Customer registration must validate required information, including a valid email address.
-   Passwords are managed by Supabase Auth, which stores them securely.
-   Sign-up confirmation and password reset emails are sent by Supabase Auth.
-   Server-side authorization must protect every restricted operation.
-   Inactive or unauthorized accounts must not access protected features.
-   Users must be able to log out securely.

### FR-02: Event Management

-   Authorized users must be able to create and edit events.
-   Event fields should include title, description, poster, date, time, venue, status, creator, and relevant timestamps.
-   Events should support draft, published, completed, and cancelled statuses.
-   Only published events should appear in public listings.
-   Event cancellation or deletion must not silently damage historical transactions.

### FR-03: Visual Seat Layout Designer

-   Management must be able to create a separate seating layout for each event.
-   Management must be able to create and manage sections, rows, and individual seats.
-   Each seat must have a unique label within its event.
-   Visual seat positions must be saved and reloaded from the database.
-   Management must be able to assign a default price to a section and override individual seat prices.
-   Management must be able to block seats.
-   Saved layouts must persist after the page is refreshed.
-   Existing booked or sold seats must be protected when editing a layout.
-   Management must be able to preview the layout before customer bookings are accepted.

### FR-04: Seat Availability and Pricing

-   Customers must see each seat's current availability and price.
-   The seat map must update live by polling the server every few seconds, so customers see newly locked or booked seats without refreshing the page.
-   The server must calculate booking totals using database prices.
-   Prices submitted by the browser must not be trusted.
-   A reservation may contain multiple seats.
-   The price charged for each seat must be stored as a historical snapshot.
-   Seat status must remain consistent across reservation, payment, cancellation, and expiration workflows.

Seat states: `available`, `locked`, `reserved`, `sold`, and `blocked`. The final transition rules must be defined and tested.

### FR-05: Reservation Management

-   Customers must be able to reserve one or more available seats.
-   Selected seats are temporarily locked for five minutes by default; the duration should be configurable.
-   If the customer clicks "I've paid" before the lock expires, the seats remain held until the admin approves or rejects the payment, even if the five minutes have passed.
-   Expired locks (for seats with no submitted payment proof) must be released by a reliable server-side process: whenever seat availability is read or a reservation is attempted, and optionally by a scheduled cleanup.
-   The system must prevent duplicate or conflicting reservations.
-   Reservations must distinguish online bookings from admin/manual bookings.
-   Manual bookings must record the staff member who created them.
-   Reservation statuses: pending, awaiting payment, payment verification, confirmed, rejected, cancelled, and expired.
-   Reservation totals must be calculated and validated on the server.

### FR-06: Payment Handling

-   Display organization-approved payment instructions and the static payment QR code image of the admin's account.
-   Provide an "I've paid" button that asks the customer for a payment reference number and a screenshot of the payment.
-   When the customer submits "I've paid," the reservation moves to payment verification and the admin dashboard shows it in a list of payments waiting for review.
-   Allow authorized staff to approve or reject submitted payments.
-   Record payment amount, status, submission time, verification time, and verifying user.
-   Displaying a QR code must not be treated as proof of payment.
-   Without a real payment-provider API, payment verification remains manual.
-   Pending or rejected payments must not be counted as collected revenue.
-   Rejected payments may be resubmitted by the customer, and the seats stay held during resubmission.

### FR-07: QR Ticket

-   Generate a unique ticket identifier for each eligible ticket.
-   Issue tickets only after the payment is approved by the admin.
-   Show the QR code on the customer's ticket page after approval, with a prompt to screenshot it or click a download button to save it as an image.
-   The QR code holds only the server-validated ticket identifier.
-   Do not embed sensitive personal or payment information directly in ticket codes.
-   Provide a print-friendly ticket view where practical.
-   Tickets are not sent by email.

The final policy (one ticket per reservation or one ticket per reserved seat) must be decided before implementation.

### FR-08: Ticket Validation and Attendance

-   Authorized personnel must be able to scan a ticket QR code or enter a ticket identifier.
-   The system must check ticket validity, event association, cancellation status, and prior use.
-   Successful check-in must record the ticket, event, time, and responsible user.
-   Repeated scans must not create duplicate successful check-ins.
-   Invalid, cancelled, already-used, or wrong-event tickets must be clearly identified.
-   Venue personnel must only access information needed for event entry.

### FR-09: SMS and Account Email

SMS notifications (UniSMS) should cover payment verification or rejection, reservation updates, and day-before event reminders.

Account emails (sign-up confirmation and password reset) are sent by Supabase Auth.

Requirements:

-   Record SMS attempts and results.
-   Distinguish provider acceptance from confirmed delivery when supported.
-   Log failures and handle retries appropriately.
-   Store SMS credentials securely; never expose them in frontend code.
-   Use a scheduled job (Vercel Cron) for reminders.
-   Avoid duplicate reminders.
-   Test actual SMS delivery with approved test numbers before claiming the integration is operational.

### FR-10: Sales and Expense Monitoring

-   Allow authorized users to review ticket sales and reservations.
-   Distinguish online bookings from admin/manual bookings.
-   Distinguish reservation value, verified payments, pending payments, rejected payments, and recorded expenses.
-   Allow authorized users to record production expenses.
-   Compensation amounts may be entered manually when required.
-   Automatic compensation calculation is outside the initial scope unless separately approved.

### FR-11: Reports and Dashboard

Reports should include reservations by event, booking source, payment statuses and verified payment totals, ticket sales, attendance, seat availability, event evaluation summaries, production expenses, and event-level financial summaries.

Where practical, reports should support event and date-range filters. Dashboard totals must agree with the underlying records.

### FR-12: Event Evaluation

-   Eligible customers must be able to rate completed events and leave optional comments.
-   Validate ratings and prevent duplicate evaluations according to the approved rules.
-   Authorized users must be able to review evaluation summaries.
-   Protect customer information from unauthorized access.

### FR-13: Event Marketing and View Monitoring

-   Public pages must display published events and relevant information.
-   Event details should include posters, descriptions, schedules, venues, and reservation links.
-   The system may track event listing views.
-   The website complements existing publicity channels rather than replacing them.

## 6. Main Workflows

### 6.1 Event Setup

1.  Authorized user creates an event.
2.  Management creates sections, rows, and seats.
3.  Management assigns section prices and individual seat price overrides.
4.  Management reviews and saves the layout.
5.  The event is published when ready for public viewing and booking.

### 6.2 Online Reservation

1.  Customer selects a published event.
2.  Customer views the seating layout and prices.
3.  Customer selects available seats.
4.  The system validates availability and temporarily locks the seats for five minutes.
5.  The system calculates the total using database prices.
6.  Customer pays to the admin's QR code and clicks "I've paid," submitting a reference number and screenshot. The seats stay held.
7.  The admin checks the payment in their own app and approves or rejects it in the dashboard.
8.  If approved, the reservation is confirmed, the seats are sold, and the customer's QR ticket is shown and can be downloaded.
9.  If rejected, the customer is notified and may resubmit.
10. SMS notifications are sent through UniSMS (added in the notifications phase).

### 6.3 Admin / Manual Booking

1.  Staff finds an existing customer or enters required customer information.
2.  Staff selects the event and available seats.
3.  The system validates availability and calculates the total.
4.  The system records the booking source and staff creator.
5.  Payment and confirmation follow the actual transaction.
6.  The booking is included in reservation, ticket, attendance, and reporting workflows.

### 6.4 Event-Day Entry

1.  Venue personnel selects the event.
2.  Personnel scans the customer's QR code or enters a ticket identifier.
3.  The system validates the ticket.
4.  If valid and unused, attendance is recorded.
5.  If invalid or already used, the system displays the reason and does not record a second successful check-in.

### 6.5 Evaluation and Reporting

1.  The event is completed.
2.  Eligible customers submit evaluations.
3.  The system summarizes ratings and comments.
4.  Authorized management reviews sales, payments, expenses, attendance, and evaluations.

## 7. Proposed Database Structure

These are logical entities. The exact schema, data types, and relationships must be designed and reviewed before implementation.

| Table / Entity        | Purpose                                                                  |
|-----------------------|--------------------------------------------------------------------------|
| `profiles`            | Account details linked to Supabase Auth users, roles, and account status  |
| `events`              | Event information, schedule, venue, poster, status, and creator          |
| `event_sections`      | Event-specific seating sections and default prices                       |
| `event_seats`         | Individual seats, section membership, labels, prices, positions, and availability |
| `reservations`        | Booking, customer, status, total amount, source, and creator             |
| `reservation_items`   | Seats included in a reservation and historical price per seat            |
| `payments`            | Payment submissions, amounts, references, proof, status, and verification details |
| `tickets`             | Unique ticket identifiers, status, and issuance details                  |
| `attendance`          | Check-in records and responsible personnel                               |
| `evaluations`         | Customer ratings and comments for events                                 |
| `production_expenses` | Event expenses and manually recorded compensation entries where applicable |
| `notifications`       | SMS messages, recipients, related records, and sending results           |

Database requirements:

-   Use primary keys and appropriate foreign keys.
-   Support multiple seats per reservation.
-   Preserve the price charged for each seat at booking time.
-   Ensure seats belong to an event and may belong to a section.
-   Enforce ticket identifier uniqueness.
-   Prevent duplicate successful attendance for the same ticket.
-   Preserve historical transaction consistency when event details change.
-   Keep database changes organized as documented, repeatable SQL migration files.

## 8. Non-Functional Requirements

### Usability

-   Interfaces should be understandable to customers, staff, and venue personnel.
-   Common tasks should require as few steps as practical.
-   Error and validation messages should be clear.
-   The seating designer must be practical for real event layouts.

### Responsiveness

-   Public pages and dashboards must adapt to desktop, tablet, and mobile screens.
-   Ticket scanning should work on supported devices with camera permission, with manual code entry as a fallback.

### Reliability and Data Integrity

-   Reservation and seat availability changes must remain consistent.
-   Concurrent booking attempts must not result in two confirmed reservations for the same seat.
-   SMS failures must not corrupt reservations.
-   Use database transactions (through Postgres functions where needed) for multi-step changes.
-   Document backups and recovery procedures.

### Security

-   Use Supabase Auth for passwords and sessions, parameterized queries, and server-side validation.
-   Enable Row Level Security (RLS) on every table that holds customer, payment, or staff data, and enforce role-based authorization on every protected operation.
-   Restrict customers to their own records.
-   Validate uploaded file types, sizes, and access permissions.
-   Protect payment proof and sensitive records using private storage buckets and signed URLs.
-   Keep API keys and secrets out of public-facing code (service keys and SMS credentials stay on the server only).
-   Set secure HTTP headers in the Next.js configuration.
-   Log important administrative actions where appropriate.

### Maintainability

-   Keep server code, components, styles, and scripts organized.
-   Use clear naming conventions and avoid unnecessary duplication.
-   Document migrations and environment configuration.
-   Test each module before implementing the next.

## 9. Selected Technology Stack

The technology stack for the new build has been selected. All development must use this stack.

| Layer | Selection |
|-------|-----------|
| Framework | Next.js (App Router), with pages and server code in one project |
| Language | JavaScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL), with SQL migration files, Row Level Security, and Postgres functions for seat locking and reservation transactions (`SELECT ... FOR UPDATE` inside a function) |
| Authentication and account email | Supabase Auth (passwords, sessions, sign-up confirmation, and password reset emails) |
| File storage | Supabase Storage with private buckets for posters and payment proof, accessed through signed URLs |
| Seat designer | SVG rendered with React components |
| QR code creation | The `qrcode` npm package |
| QR code scanning | The `html5-qrcode` npm package, with manual code entry as a fallback |
| SMS | UniSMS REST API, called from the server (added in the notifications phase) |
| Live seat updates | Polling the server every few seconds |
| Scheduled tasks | Vercel Cron Jobs for day-before reminders and optional cleanup of expired holds |
| Hosting | Vercel for the Next.js application; Supabase cloud for the database, auth, and storage |
| Local development | VS Code, Node.js, the Supabase CLI, and a local Supabase instance (Docker) as an offline backup |

Selection notes:

-   Providers and libraries must be evaluated and tested before they are relied upon.
-   UniSMS delivery claims must be verified with real test numbers before the integration is treated as operational.
-   Payment proof images must be validated for type and size, and protected from unauthorized access.
-   Vercel's free plan limits (including cron frequency) must be checked before relying on scheduled jobs.

## 10. Development Phases

1.  Phase 1 --- Project Setup and Authentication
2.  Phase 2 --- Event Management
3.  Phase 3 --- User Accounts and Access Control
4.  Phase 4 --- Public Website and Customer Accounts
5.  Phase 5 --- Visual Seat Layout Designer
6.  Phase 6 --- Online Reservations and Seat Holds
7.  Phase 7 --- Admin and Manual Booking
8.  Phase 8 --- Payment Submission and Verification
9.  Phase 9 --- QR Ticket Display, Download, and Entrance Scanning
10. Phase 10 --- SMS Notifications (UniSMS) and Reminders
11. Phase 11 --- Attendance, Reports, Expenses, and Evaluation
12. Phase 12 --- Dashboard, Security, and Interface Improvements
13. Phase 13 --- Testing and User Acceptance
14. Phase 14 --- Vercel Deployment, Backup, and Documentation

Each phase must include scope and dependency review, implementation, testing, a list of files changed, database migration notes, and approval before the next phase begins.

## 11. Testing and Acceptance Criteria

Testing must cover:

-   Login, logout, account status, and role permissions
-   Sign-up confirmation and password reset emails from Supabase Auth
-   Event creation, editing, publishing, and cancellation
-   Seating layout creation, editing, saving, and reloading
-   Section prices and individual seat price overrides
-   Online and manual reservations
-   Five-minute seat locking and expiration, and holds kept after "I've paid"
-   Prevention of duplicate seat bookings
-   Payment submission, admin approval, rejection, and resubmission
-   QR ticket issuance only after payment approval
-   Valid, invalid, cancelled, wrong-event, and already-used ticket scans
-   Attendance recording and duplicate check-in prevention
-   SMS provider responses and reminder scheduling
-   Report calculations against known test records
-   Evaluation eligibility and duplicate-submission prevention
-   Responsive display and access restrictions
-   Row Level Security policies blocking unauthorized reads and writes
-   Database integrity, backup, and recovery procedures

For each test, record expected result, actual result, and pass/fail status. Any untested external integration must be identified as unverified.

## 12. Deployment Considerations

-   Deploy the Next.js application on Vercel and set environment variables in the Vercel project settings.
-   Verify Vercel Cron support for day-before SMS reminders and hold cleanup.
-   Confirm HTTPS, Supabase project access, storage bucket privacy, and outbound API access to UniSMS.
-   Configure secrets through environment variables (a `.env.local` file kept out of version control, and the Vercel dashboard).
-   Apply SQL migrations carefully to the Supabase database and back up existing records before each change.
-   Configure Supabase Auth email templates for sign-up confirmation and password reset.
-   Ensure uploaded files are stored only in private buckets.
-   Prepare a backup and recovery plan, including Supabase database exports.
-   Keep an offline copy of the working demo (a local Supabase instance on a laptop) in case internet access fails during the defense.
-   Do not assume the Supabase free tier supports every required feature or that the project will not pause before the defense.

## 13. Decisions to Finalize

Already decided: the technology stack (Section 9), manual payment verification using a static QR image (Section 1.1), email limited to Supabase Auth account messages, QR tickets shown after payment approval, and seats held after "I've paid" until the admin decides.

1.  Whether tickets are issued per reservation or per reserved seat.
2.  Whether administrator and staff permissions differ.
3.  How rejected payments are resubmitted and how many times.
4.  Whether layouts can be changed after seats have been booked.
5.  Which roles may view financial reports and record expenses.
6.  Which Supabase plan will be used (free or paid) and how the offline demo will be run.
7.  How customers are notified of rejected payments if SMS is not yet available.

## 14. Instructions for AI-Assisted Development

Any LLM or Vibe Coding tool used for this project must:

-   Build the system from scratch, following the phases in this specification.
-   Use only the technology stack in Section 9 (Next.js, Tailwind CSS, Supabase, the listed npm packages, and UniSMS for SMS); ask before adding another framework or service.
-   Inspect the current project files and database before making changes in each phase.
-   Never assume a feature works unless it has been tested.
-   Never drop or recreate tables that contain data without approval and a safe migration plan.
-   Implement only the requested phase.
-   Explain changes in simple language suitable for a BSIT student.
-   Keep server code, components, styles, and scripts separated and organized.
-   Provide setup and testing instructions.
-   Stop and wait for approval before beginning the next phase.
-   Never claim real SMS delivery, payment verification, or ticket validation without actual testing.
-   Preserve working features and existing data as the project grows.

------------------------------------------------------------------------

**End of Project Specification**
