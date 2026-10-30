# Core AIS — review against capsnew_Merged.pdf

Source: `E:\Und\Caps\capsnew_Merged.pdf` (119 merged pages). Page references below count from the start of the merged PDF.

## Scope decisions

The PDF is the feature reference. The prompt identifies the responsibility boundary: Anggota 1 / core academic administration. PDF page 10 explicitly includes students, teachers, guardians, classes, departments/study programs, subjects, rooms, academic years, semesters, academic calendars, curricula, learning schedules, class assignments and academic registration. These existing features are retained, including those omitted from the prompt's list.

PDF pages 107–109 specify user management and role/status control (SRS-06/07), academic years, semesters, curricula and subjects (SRS-36–39), schedules (SRS-40), teaching loads (SRS-41) and dashboard analytics (SRS-56). Teaching loads now have a separate persistent CRUD module. Roles are visible in the access overview; assignment is managed through user forms, matching the existing server authorization rules.

No existing exposed application feature was found outside the PDF's core AIS requirements. The old mock controller is not routed. LMS courses, quizzes/AI, attendance, report cards, finance, parent-facing dashboards, self-service teacher/student registration and teaching-account approval described elsewhere in the PDF belong to the wider integrated product and are outside this administrator AIS review. Non-admin accounts remain unable to enter this administrator panel; this does not implement their separate portals.

## Changes

- Teaching loads: teacher, subject, class, semester, weekly hours and status; reject duplicates, invalid references, invalid hours and classes from another academic year.
- User creation includes a required password; editing supports retaining the password. Role changes no longer submit a stale role ID.
- Named relationship selectors load all pages of available records, including curriculum subjects and guardian children. Dates and times use appropriate controls and normalize API values.
- Registration starts with `pending`, matching server validation. Detail/table views show names and avoid dumping API object fields.
- Forms display validation errors inside the dialog, support Escape and focus containment, preserve focus on close, and prevent dismissal while saving. Pagination returns to the previous page after deleting its last record.
- Request sequencing prevents outdated search responses replacing newer results. Expired sessions return to login.
- Administrators cannot demote themselves; disabling accounts or changing their role revokes tokens. Foreign-key/duplicate database errors return an actionable API conflict response.
- Refreshed teal styling, login layout, password visibility control, responsive navigation, accessible labels and an overview of role access. Demo credentials appear only in development builds.

## Validation and running

Backend suite: `cd backend; php artisan test` (in-memory SQLite; does not modify the application database).

Frontend: `cd frontend; npm.cmd run lint` and `npm.cmd run build`.

Apply the new migration to your configured application database before using teaching loads: `cd backend; php artisan migrate`. Existing records are preserved. The review's browser checks use a separate disposable SQLite database at `.tools/ui.sqlite`; the supplied application database was not migrated or seeded during the review.

The migration command was attempted against the configured MySQL database `sistem_akademik`, but MySQL at `127.0.0.1:3306` refused the connection. Start MySQL, then run the migration before using the updated application against that database. SQLite tests do not verify MySQL-specific runtime behavior.

Browser audit: `node .tools/browser-audit.cjs` with backend on port 8000, Vite on 5173, and the isolated test database seeded with the development administrator. Playwright is a local review dependency under `.tools`, not an application dependency.

Verified: 29 backend tests / 304 assertions passed; production frontend build passed; all 17 resource pages and create dialogs opened in Chrome; user creation, search, editing without changing the password and deletion passed; role overview and mobile dashboard passed with no JavaScript page errors. Browser screenshots are under `.tools/dashboard-desktop.png` and `.tools/dashboard-mobile.png`. This is automated API/browser verification, not a claim of full cross-browser or production-load certification.
