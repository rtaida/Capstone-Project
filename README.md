# Capra Fitness — Gym Management System

A React + PHP + Microsoft SQL Server gym management system for administrators, trainers, and members.

## Main modules
- Member registration, approval, profile and QR code
- Trainer management and trainer sessions
- Session catalog and pricing with active/inactive types
- Member session booking and termination
- QR check-in / attendance
- Walk-in clients
- Payment confirmation and revenue tracking
- Overdue billing records
- Notifications
- Monthly reports and structured PDF export
- Password reset by email OTP

## Database
1. Create/import the `GymDB` SQL Server database.
2. Run `gym-backend/database_complete.sql`.
3. Run `gym-backend/database_notifications_recipient_migration.sql`.
4. Run `gym-backend/database_walk_in_migration.sql`.
5. Run `gym-backend/database_fix_2026_09_14.sql`.

The `.bacpac` currently used by the project contains the live table structure used by the repair migration.

### Creating a sanitized local demo database

Never commit a `.bacpac` or `.bak` file. Database backups may contain member,
staff, payment, password-reset, and audit data. The root `.gitignore` excludes
these backup formats.

For a demo copy, import the backup into a separate SQL Server database named
`GymDBDemo`; do not import over `GymDB`. Then select `GymDBDemo` in SQL Server
Management Studio or `sqlcmd` and run
`gym-backend/sanitize_demo_database.sql`. The script refuses to run unless the
selected database is exactly `GymDBDemo`. It replaces account contact details
with reserved example addresses, disables existing account passwords, removes
profile/QR references, and clears reset tokens, notifications, rate limits, and
audit records. The original `GymDB` is not changed.

Existing demo accounts cannot log in after sanitization. Create a separate
demo administrator through a controlled local process before using the demo;
do not reuse live account credentials.

## Configuration
Set environment variables before running the backend when possible:
- `CAPRA_DB_SERVER`
- `CAPRA_DB_NAME`
- `CAPRA_AUTH_SECRET`
- `CAPRA_SMTP_USERNAME`
- `CAPRA_SMTP_PASSWORD`
- `CAPRA_SMTP_FROM_EMAIL`
- `CAPRA_SMTP_FROM_NAME`

For local XAMPP + SQL Server development, the backend falls back to `localhost\SQLEXPRESS` / `GymDB`.

## Frontend
Create a `.env` file in `gym-frontend`:

```env
VITE_API_URL=http://localhost/Capstone%20Project/gym-backend/api
```

Then run:

```bash
npm install
npm run build
```

## Cloudflare Pages (free frontend hosting)
The React/Vite frontend can be deployed to Cloudflare Pages and served on a free
`<project>.pages.dev` address. To deploy it:

1. Import this repository in Cloudflare Pages.
2. Set the project root directory to `gym-frontend`.
3. Set the build command to `npm run build` and the build output directory to
   `dist`.
4. Add the Pages environment variable `VITE_API_URL`, set to the public HTTPS
   URL of the backend API ending in `/api` (for example,
   `https://api.example.com/api`), then deploy.

The Pages site only hosts the static frontend. This project’s backend uses PHP
and Microsoft SQL Server with the ODBC Driver 18, so it cannot run on Cloudflare
Pages as-is. Keep the backend on a server that supports those requirements,
make it publicly reachable over HTTPS, and configure it to accept requests from
the Pages site. Its uploads must also remain accessible from that public
backend URL. Configure `VITE_API_URL` in Pages rather than committing a
production `.env` file. A sample is available in `gym-frontend/.env.example`.

## Vercel (frontend hosting)
The React/Vite frontend can also be deployed to Vercel. The Vercel configuration
in `gym-frontend/vercel.json` routes frontend paths to the SPA entry point so
direct navigation and page refreshes work with React Router.

1. Push this project to a Git provider supported by Vercel.
2. Import the repository into Vercel and set **Root Directory** to
   `gym-frontend`.
3. Use **Build Command** `npm run build` and **Output Directory** `dist`.
   Vercel should detect Vite automatically.
4. Add the environment variable `VITE_API_URL` with the public HTTPS API base
   URL ending in `/api` (for example, `https://api.example.com/api`) for the
   Production, Preview, and Development environments as needed.
5. Deploy, then configure the backend to allow requests from the deployed
   Vercel domain. Redeploy the frontend whenever `VITE_API_URL` changes because
   Vite embeds this value in the build.

This deploys only the frontend. The PHP backend and Microsoft SQL Server remain
separate and must be hosted on infrastructure that supports PHP, the SQL Server
ODBC driver, database connectivity, email configuration, and persistent storage
for profile, QR code, and session uploads. The backend must be reachable over
HTTPS; local XAMPP URLs are not accessible to Vercel visitors. Do not put
database credentials or other backend secrets in Vercel's `VITE_*` variables,
as those values are exposed to browser clients.

### Supabase PostgreSQL migration (in progress)

The PostgreSQL schema foundation is in
`supabase/migrations/20261021220000_initial_schema.sql`. It creates a clean
schema only; it does not import records from the local SQL Server database.
Review and run this migration in the Supabase SQL Editor before enabling the
frontend's Supabase authentication.

Set `VITE_SUPABASE_URL` and the Supabase **publishable/anon** key as Vercel
environment variables, then redeploy. Never put a Supabase service-role key in
a `VITE_*` variable or frontend source. Once the migration and configuration
are in place, `/admin-setup` provides a one-time first-admin account setup for
`ramosjaredonarse07@gmail.com`; the administrator chooses a private password of at least 14
characters. The database function only permits that email to claim the first
admin role, and refuses to grant the role after one has already been claimed.

This is only a schema and authentication foundation. The dashboards still call
the PHP endpoints in `gym-backend/api`, which use SQL Server syntax and have
not yet been replaced by Supabase Edge Functions. Do not treat this deployment
as a fully migrated or functional online system until those API workflows have
been ported and tested.
