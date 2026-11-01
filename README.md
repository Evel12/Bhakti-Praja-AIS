# Bhakti Praja AIS

Academic administration system for **SMK Bhakti Praja Batang**, NPSN **20322714**. Laravel 12 / Sanctum API with a React 19 / Vite frontend.

Features include administrator authentication, users and roles, academic years and semesters, programs and concentrations, subjects, curricula, classrooms and rooms, class assignments, academic registration, teaching loads, schedules and dashboard summaries.

## School data

The school setup includes three programs and four concentrations: Teknik Mekanik Industri, Teknik Kendaraan Ringan, Teknik Sepeda Motor and Rekayasa Perangkat Lunak. Source dates and accuracy boundaries are documented in [SCHOOL-SETUP.md](SCHOOL-SETUP.md).

The four seeded curricula and 17 subjects are **inactive references**, not the school's approved current KOSP. Weekly hours are unset until confirmed. Actual class lists, staff assignments, schedules and student records must be supplied by the school.

## Requirements

- PHP 8.2 or newer, with the extensions required by Laravel and the selected database driver.
- Composer.
- Node.js compatible with Vite 8 and npm.
- MySQL/MariaDB, or SQLite for a local setup.

## Local setup (Windows PowerShell)

```powershell
git clone https://github.com/Evel12/Bhakti-Praja-AIS.git
cd Bhakti-Praja-AIS\backend
composer install
Copy-Item .env.example .env
php artisan key:generate
```

Choose a database before migrating. `.env.example` defaults to SQLite. To use that default:

```powershell
New-Item -ItemType File -Path database\database.sqlite
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

For MySQL/MariaDB instead, start the database server, create `sistem_akademik`, and set these values in `backend/.env` before running migrations:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sistem_akademik
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
```

Then run `php artisan migrate --seed` and start the backend as above. On an existing installation, run `php artisan migrate` and `php artisan db:seed --class=BhaktiPrajaSchoolSeeder` to add the school catalog without resetting demo accounts.

In a second terminal, from the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:5173**. Vite forwards `/api` requests to **http://127.0.0.1:8000**. Keep both servers running.

## Development login

Fresh seeding creates `admin@akademik.test` with password `admin123`. These are local demonstration credentials; configure `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` before seeding a non-demo installation. Running the full default seeder again resets existing demo account details.

Local `.env` files, database files, SQL exports, recovery backups and dependency folders are excluded from version control.

## Checks

```powershell
cd backend
php artisan test
cd ..\frontend
npm.cmd run lint
npm.cmd run build
```

The backend test suite uses an in-memory SQLite database. Production hosting must serve the Laravel API and the built frontend with an appropriate `/api` routing configuration; Vite's development proxy is for local development.

See [AIS-REVIEW.md](AIS-REVIEW.md) for the AIS scope review and [SCHOOL-SETUP.md](SCHOOL-SETUP.md) for school data sources and setup details.

## Member 4: finance

Finance is available at `/finance` after running the existing migrations. Choose **Portal wali dan keuangan pendidikan** on the login page for existing student/parent accounts; administrators can also open the finance menu from their academic administration session. Student and parent accounts must already be linked to the school records by Member 1. No finance demo records are added to the school database.

Payment evidence is stored privately in Laravel's local disk (`storage/app/private/payment-proofs`) and downloaded through an authenticated API. JPG/JPEG/PNG/PDF files up to 2 MB are accepted. Payments remain pending until an administrator approves or rejects them. The current workflow accepts full invoice payments only.

See [the Stage 3 report](docs/member4/STAGE-3.md), [API contract](docs/member4/API.md), and [integration dependencies](docs/member4/INTEGRATION.md).

## Member 4: parent portal

Existing active parent accounts can choose **Portal wali dan keuangan pendidikan** at login and open `/parent`. The portal shows linked children, school/class information, learning schedules, and child-specific bills/payment history. Payment submissions continue through the finance module.

Grades, attendance, assignments/submissions and academic progress sources from Members 2/3 are absent in this checkout. Their portal pages clearly show unavailable states; no academic records or statistics are fabricated. The required integration contracts and verification limits are documented in [the Stage 4 report](docs/member4/STAGE-4.md). No Stage 4 migrations are needed. Communication/reminder delivery remains outside this stage.

## Member 4: communication and notifications

Run `php artisan migrate` for the additive notification metadata migration. Choose **Komunikasi sekolah (semua peran)** at login and open `/communication/announcements` or `/communication/notifications`. The existing authentication supports teachers in this context; academic administration and finance permissions remain unchanged.

Administrators manage system announcements and can create payment reminders from an unpaid invoice's finance detail page. Announcements and reminders generate private in-app notifications; this is not push delivery. Reminders are manual and deduplicated. No recurring reminder schedule is installed.

Email is disabled by default. Configure `MEMBER4_EMAIL_ENABLED=true`, `MAIL_MAILER=smtp` (or sendmail), the existing `MAIL_*` environment values and an appropriate `MAIL_FROM_ADDRESS`, then run `php artisan queue:work`. No credentials are committed. Log/array transports are not counted as email delivery. The queue-to-local-SMTP path was tested; production mailbox delivery was not.

Messaging rules and reminder timing remain unspecified; assignment/examination data and push infrastructure are unavailable. See [the Stage 5 report](docs/member4/STAGE-5.md) for exact coverage, tests and pending requirements, and the following section for Stage 6 integration.

## Member 4: dashboard and UI integration

Stage 6 integrates the existing pages without new backend routes or migrations. Finance dashboard cards open the relevant lists, payment status filters survive reload, and finance details opened from the parent portal retain the selected-child return path. Dashboards refresh when focused again; financial totals remain calculated by the backend. Payment upload drafts are preserved when the file chooser returns focus.

Member 4 pages share in-flight requests through the existing authenticated API client, handle server failures without exposing backend details, and retain session isolation. See [the Stage 6 report](docs/member4/STAGE-6.md) for integration details.

## Member 4: final verification

Stage 7 completed verification of the available implementation: 82 Laravel tests / 929 assertions passed on both SQLite and isolated MySQL, frontend lint/build passed, and Chrome workflows covered finance, parent data isolation, announcements, notifications and logout failures. Three defects were fixed: announcement UTF-8 byte limits, failed logout handling, and internal API debug leakage. No new routes or migrations were added.

See [the final requirement coverage and readiness report](docs/member4/STAGE-7.md). Academic sources from Members 2/3, messaging rules, academic reminder timing/data, external email delivery and push infrastructure remain blocked; production readiness is not claimed.
## Repository applications after branch integration

This repository contains two independently runnable applications:

| Application | Location | Development commands |
| --- | --- | --- |
| Laravel API + React AIS / parent / finance / communication | `backend/` and `frontend/` | `cd backend` then `php artisan serve`; in another terminal `cd frontend` then `npm ci` and `npm run dev` |
| Assessment UI contributed by Blackumis | Repository root (`src/`, `tests/`, root `package.json`) | At repository root: `npm ci`, then `npm run dev` (port 4173) |

Root `npm run build` builds assessment into root `dist/`. Running the build inside `frontend/` builds React into `frontend/dist/`. Deploy them separately; neither build replaces the other.

Assessment retains its original Vue implementation, local-storage repository, fixtures, role switcher and history. Its role switcher is a UI demonstration, not Laravel authorization. It is not yet connected to the authenticated Laravel API or the parent portal's academic readers; local assessment data must not be treated as shared school records. This merge preserves working applications and does not claim cross-module data integration.

The `assesment` branch (original spelling) was merged with its original commits intact. Assessment contributor: **Blackumis** (`herdikaputradevara@gmail.com`), including original tip `67766f6`. See [merge verification](docs/MERGE-VERIFICATION.md) for checks and limits.

