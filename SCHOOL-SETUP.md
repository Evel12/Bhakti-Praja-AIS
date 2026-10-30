# SMK Bhakti Praja Batang — school setup

Implemented on 29 October 2026 for **NPSN 20322714**, at Jl. Ki Mangunsarkoro No. 45, Proyonanggan Selatan, Batang. This is a different institution from SMK Bhakti Praja 2 Batang (NPSN 69759226).

## Verified public information

The name, NPSN, address, foundation, telephone and email use the [Kemendikdasmen school record](https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20322714). The school's self-identified website is [skabhaprabatang.sch.id](https://www.skabhaprabatang.sch.id/); the government record still lists its older domain. No invented logo, staff roster or student records were added.

Program and concentration mapping follows the [Central Java Education Department decision 420/03574, dated 15 February 2023, for 2023/2024](https://file.data.kemendikdasmen.go.id/sk/1157028-120985-219346-48555515-949222384.pdf), PDF page 235 / school entry 56:

| Program keahlian | Konsentrasi keahlian |
| --- | --- |
| Teknik Mesin | Teknik Mekanik Industri |
| Teknik Otomotif | Teknik Kendaraan Ringan |
| Teknik Otomotif | Teknik Sepeda Motor |
| Pengembangan Perangkat Lunak dan Gim | Rekayasa Perangkat Lunak |

The existing `departments` and `study_programs` tables represent these two levels. Their UI labels now use SMK terminology. `BP-*` identifiers are internal application codes, not government program codes. The 2023/2024 date is displayed in the application; public confirmation of a program does not establish current class counts or the current year's intake.

## Curriculum accuracy and outstanding school documents

There are four **inactive reference curricula** and 17 **inactive reference subjects**. Subject names come from the [national SMK reference catalog](https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/smk/sejarah/). The entrepreneurship label uses Kreativitas, Inovasi, dan Kewirausahaan (KIK), reflecting the adjustment described in the [Ministry's 2025–2029 strategic plan](https://jdih.kemendikdasmen.go.id/sjdih/siperpu/dokumen/salinan/Permendikdasmen_Nomor_19_Tahun_2025_tentang_Rencana_Strategis_Kementerian_Pendidikan_Dasar_dan_Menengah_Tahun_2025_2029.pdf); its internal code `BP-PKK` is simply an application identifier. See also the [national curriculum portal](https://kurikulum.kemendikdasmen.go.id/).

These are incomplete setup references, **not the school's approved/current KOSP**. No weekly JP allocations were invented. Unknown hours are stored as NULL and shown as “Belum ditetapkan”; they are no longer silently filled as 2 JP. Curriculum notes and document URLs can be maintained by administrators. The catalog includes common reference subjects, three program foundations and the four concentration subjects. It deliberately does not assume which religion courses, arts options, local content or electives the school offers. An academic year and semester allocations were not invented.

To make the system match the school completely, provide the relevant academic year and approved KOSP/subject allocation documents, current class and room lists, staff/teaching assignments, timetable and academic calendar. Published student totals were not turned into fabricated student records. Existing demo accounts were preserved for login, not represented as actual school personnel.

## Safe application

The database was backed up before setup to `.recovery/before-school-setup-20261029.sql`. The school seeder was run separately, avoiding demo-account reseeding. It inserts missing school records and preserves existing administrator edits; conflicting reserved codes stop the transaction instead of overwriting data. Re-running it does not reset curriculum subject selections, hours, notes or activation choices.

For a separate installation:

```powershell
cd E:\final\backend
php artisan migrate
php artisan db:seed --class=BhaktiPrajaSchoolSeeder
```

School identity and sources live in `backend/config/school.php`; subject setup lives in `backend/config/school_subjects.php`. The public `/api/school-profile` endpoint supplies the login, sidebar and dashboard identity. It contains public school facts only.

Validation: backend tests cover correct NPSN, mappings, repeatable seeding, preservation of administrator edits, unset hours, source URLs and absence of fabricated operational records. Browser check: `node .tools/school-browser-check.cjs`, with backend on 8000 and frontend on 5173. That browser check reads the live school catalog and does not create or edit school records.
