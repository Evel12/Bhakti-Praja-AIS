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
