# Bhakti Praja Academic Information System (AIS) & Assessment LMS

Unified full-stack platform for **SMK Bhakti Praja Batang** combining:

- **`frontend/`** — Consolidated React + Vue 3 frontend (AIS Portal, Assessment & LMS Workspace, Finance/Parent/Communication Portal) running on Vite (`http://127.0.0.1:5173` dev, `http://127.0.0.1:4173` preview).
- **`backend/`** — Laravel Core AIS + Member 4 (Finance, Parent Portal, Communication) + AIS↔Assessment Grade/Roster Bridge API (`http://127.0.0.1:8000`).
- **`assessment-backend/`** — Laravel Assessment, Quiz Generation, & LMS API (`http://127.0.0.1:8002`).
- **`ai-service/`** — FastAPI + Ollama AI Quiz Generation service (`http://127.0.0.1:8001`).

Both Laravel backends share the MySQL database **`sistem_akademik`** (`127.0.0.1:3306`, user `root`).

---

## Quick Start (Local Development)

### 1. Database Migration & Seeding (MySQL `sistem_akademik`)

Ensure MySQL is running on `127.0.0.1:3306` with database `sistem_akademik`:

```powershell
# Migrate & seed Core AIS + Bhakti Praja sample accounts
cd backend
composer install
php artisan key:generate
php artisan migrate:fresh --seed

# Migrate & seed Assessment/LMS on the same database
cd ..\assessment-backend
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed
```

### 2. Run Backend, Assessment API, AI Service, and Frontend

Open terminals from the repository root:

```powershell
# Terminal 1 — Core AIS Backend (:8000)
cd backend
php artisan serve --host=127.0.0.1 --port=8000

# Terminal 2 — Assessment & LMS Backend (:8002)
cd assessment-backend
php artisan serve --host=127.0.0.1 --port=8002

# Terminal 3 — AI Quiz Service (:8001, optional if using AI generation)
cd ai-service
uvicorn app.main:app --host 127.0.0.1 --port 8001

# Terminal 4 — Consolidated Frontend (:5173)
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open **`http://127.0.0.1:5173`** in your browser. Vite automatically proxies `/api` to `127.0.0.1:8000` and `/assessment-api` to `127.0.0.1:8002`.

---

## Seeded Login Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@bhaktiprajabatang.sch.id` | `AdminBhakti#2026` |
| **Guru** | `rina.kusuma@bhaktiprajabatang.sch.id` | `GuruBhakti#2026` |
| **Murid** | `siswa1@bhaktiprajabatang.sch.id` | `MuridBhakti#2026` |
| **Wali Murid** | `slamet.walimurid@bhaktiprajabatang.sch.id` | `WaliBhakti#2026` |

> Also seeded for legacy AIS admin tests: `admin@akademik.test` / `admin123`.

---

## Test & Verification Commands

```powershell
# Core AIS Backend
cd backend && php artisan test

# Assessment & LMS Backend
cd assessment-backend && php artisan test

# AI Quiz Service
cd ai-service && pytest

# Consolidated Frontend
cd frontend
npm run check:motion
npm run test
npm run test:components
npm run lint
npm run build
```
