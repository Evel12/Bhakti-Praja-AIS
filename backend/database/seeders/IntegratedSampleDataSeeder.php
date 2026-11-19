<?php

namespace Database\Seeders;

use App\Models\AcademicCalendar;
use App\Models\AcademicRegistration;
use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\Classroom;
use App\Models\ClassStudent;
use App\Models\Curriculum;
use App\Models\Guardian;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PortalNotification;
use App\Models\Role;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudyProgram;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\AisAssessmentRosterBridge;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class IntegratedSampleDataSeeder extends Seeder
{
    public const PASSWORD_ADMIN = 'AdminBhakti#2026';

    public const PASSWORD_TEACHER = 'GuruBhakti#2026';

    public const PASSWORD_STUDENT = 'MuridBhakti#2026';

    public const PASSWORD_PARENT = 'WaliBhakti#2026';

    private const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            BhaktiPrajaSchoolSeeder::class,
        ]);

        $syncLoads = [];

        DB::transaction(function () use (&$syncLoads): void {
            $roles = Role::query()->pluck('id', 'name');

            $admin = $this->ensureUser(
                'admin@bhaktiprajabatang.sch.id',
                'Administrator Sekolah',
                (int) $roles['admin'],
                self::PASSWORD_ADMIN,
            );

            $teacherSpecs = [
                [
                    'email' => 'guru.baru@bhaktiprajabatang.sch.id',
                    'name' => 'Budi Santoso, S.Kom',
                    'number' => 'G-1988031201',
                    'phone' => '081548200101',
                ],
                [
                    'email' => 'rina.kusuma@bhaktiprajabatang.sch.id',
                    'name' => 'Rina Kusuma, S.Pd.',
                    'number' => 'G-1990071502',
                    'phone' => '081548200102',
                ],
                [
                    'email' => 'hendra.wijaya@bhaktiprajabatang.sch.id',
                    'name' => 'Hendra Wijaya, S.T.',
                    'number' => 'G-1986110403',
                    'phone' => '081548200103',
                ],
            ];

            $teachers = [];
            foreach ($teacherSpecs as $spec) {
                $user = $this->ensureUser($spec['email'], $spec['name'], (int) $roles['guru'], self::PASSWORD_TEACHER);
                $teacher = Teacher::query()->firstOrNew(['teacher_number' => $spec['number']]);
                $teacher->fill([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $spec['phone'],
                    'status' => 'active',
                ])->save();
                $teachers[$spec['email']] = $teacher;
            }

            $this->activateCoreSubjectsAndCurricula();

            $previousYear = AcademicYear::query()->updateOrCreate(
                ['name' => '2025/2026'],
                [
                    'start_date' => '2025-07-14',
                    'end_date' => '2026-06-20',
                    'is_active' => false,
                ],
            );
            Semester::query()->updateOrCreate(
                ['academic_year_id' => $previousYear->id, 'name' => 'Ganjil'],
                ['period' => '2025-1', 'start_date' => '2025-07-14', 'end_date' => '2025-12-20', 'is_active' => false],
            );
            Semester::query()->updateOrCreate(
                ['academic_year_id' => $previousYear->id, 'name' => 'Genap'],
                ['period' => '2025-2', 'start_date' => '2026-01-05', 'end_date' => '2026-06-20', 'is_active' => false],
            );

            $activeYear = AcademicYear::query()->updateOrCreate(
                ['name' => '2026/2027'],
                [
                    'start_date' => '2026-07-13',
                    'end_date' => '2027-06-19',
                    'is_active' => true,
                ],
            );
            $activeSemester = Semester::query()->updateOrCreate(
                ['academic_year_id' => $activeYear->id, 'name' => 'Ganjil'],
                ['period' => '2026-1', 'start_date' => '2026-07-13', 'end_date' => '2026-12-19', 'is_active' => true],
            );
            Semester::query()->updateOrCreate(
                ['academic_year_id' => $activeYear->id, 'name' => 'Genap'],
                ['period' => '2026-2', 'start_date' => '2027-01-04', 'end_date' => '2027-06-19', 'is_active' => false],
            );

            $calendarEvents = [
                ['Masa Pengenalan Lingkungan Sekolah (MPLS)', '2026-07-13', '2026-07-15', 'Orientasi siswa baru dan pengenalan program keahlian.'],
                ['Penilaian Tengah Semester (PTS) Ganjil', '2026-10-05', '2026-10-10', 'Evaluasi capaian belajar tengah semester ganjil.'],
                ['Penilaian Akhir Semester (PAS) Ganjil', '2026-12-01', '2026-12-08', 'Ujian akhir semester berbasis assessment digital.'],
                ['Pembagian Rapor Semester Ganjil', '2026-12-19', '2026-12-19', 'Pertemuan wali murid dan penyerahan laporan hasil belajar.'],
            ];
            foreach ($calendarEvents as [$name, $start, $end, $desc]) {
                AcademicCalendar::query()->firstOrCreate(
                    ['academic_year_id' => $activeYear->id, 'semester_id' => $activeSemester->id, 'name' => $name],
                    ['start_date' => $start, 'end_date' => $end, 'description' => $desc],
                );
            }

            $rooms = [];
            foreach ([
                ['R-101', 'Ruang Teori 101', 36, 'Gedung A Lantai 1'],
                ['R-102', 'Ruang Teori 102', 36, 'Gedung A Lantai 1'],
                ['LAB-RPL', 'Laboratorium Komputer PPLG', 36, 'Gedung B Lantai 2'],
                ['BENGKEL-TO', 'Bengkel Otomotif TKR', 32, 'Workshop Selatan'],
                ['BENGKEL-TM', 'Bengkel Teknik Mesin TMI', 32, 'Workshop Utara'],
            ] as [$code, $name, $cap, $loc]) {
                $rooms[$code] = Room::query()->firstOrCreate(
                    ['code' => $code],
                    ['name' => $name, 'capacity' => $cap, 'location' => $loc, 'status' => 'active'],
                );
            }

            $studyPrograms = StudyProgram::query()->pluck('id', 'code');
            $classrooms = [
                'XI RPL 1' => Classroom::query()->firstOrCreate(
                    ['name' => 'XI RPL 1', 'academic_year_id' => $activeYear->id],
                    [
                        'level' => 'XI',
                        'study_program_id' => $studyPrograms['BP-RPL'],
                        'homeroom_teacher_id' => $teachers['guru.baru@bhaktiprajabatang.sch.id']->id,
                        'status' => 'active',
                    ],
                ),
                'XI TKR 1' => Classroom::query()->firstOrCreate(
                    ['name' => 'XI TKR 1', 'academic_year_id' => $activeYear->id],
                    [
                        'level' => 'XI',
                        'study_program_id' => $studyPrograms['BP-TKR'],
                        'homeroom_teacher_id' => $teachers['hendra.wijaya@bhaktiprajabatang.sch.id']->id,
                        'status' => 'active',
                    ],
                ),
                'XI TMI 1' => Classroom::query()->firstOrCreate(
                    ['name' => 'XI TMI 1', 'academic_year_id' => $activeYear->id],
                    [
                        'level' => 'XI',
                        'study_program_id' => $studyPrograms['BP-TMI'],
                        'homeroom_teacher_id' => $teachers['rina.kusuma@bhaktiprajabatang.sch.id']->id,
                        'status' => 'active',
                    ],
                ),
            ];

            $studentSpecs = [
                [
                    'email' => 'siswa1@bhaktiprajabatang.sch.id',
                    'name' => 'Ahmad Fauzi',
                    'number' => '20261001',
                    'gender' => 'L',
                    'birth_date' => '2009-05-14',
                    'address' => 'Jl. Jenderal Sudirman No. 18, Batang',
                    'classroom' => 'XI RPL 1',
                    'reg_number' => 'REG-2026-001',
                ],
                [
                    'email' => 'siswa2@bhaktiprajabatang.sch.id',
                    'name' => 'Siti Aisyah',
                    'number' => '20261002',
                    'gender' => 'P',
                    'birth_date' => '2009-08-21',
                    'address' => 'Jl. Pemuda No. 42, Kauman, Batang',
                    'classroom' => 'XI RPL 1',
                    'reg_number' => 'REG-2026-002',
                ],
                [
                    'email' => 'dimas.pratama@bhaktiprajabatang.sch.id',
                    'name' => 'Dimas Pratama',
                    'number' => '20261003',
                    'gender' => 'L',
                    'birth_date' => '2009-03-11',
                    'address' => 'Perum Kalisalak Indah Blok C-4, Batang',
                    'classroom' => 'XI RPL 1',
                    'reg_number' => 'REG-2026-003',
                ],
                [
                    'email' => 'nabila.putri@bhaktiprajabatang.sch.id',
                    'name' => 'Nabila Putri',
                    'number' => '20261004',
                    'gender' => 'P',
                    'birth_date' => '2009-11-02',
                    'address' => 'Jl. Tentara Pelajar No. 9, Batang',
                    'classroom' => 'XI TKR 1',
                    'reg_number' => 'REG-2026-004',
                ],
                [
                    'email' => 'rizky.ramadhan@bhaktiprajabatang.sch.id',
                    'name' => 'Rizky Ramadhan',
                    'number' => '20261005',
                    'gender' => 'L',
                    'birth_date' => '2009-07-19',
                    'address' => 'Desa Pasekaran RT 02/03, Batang',
                    'classroom' => 'XI TMI 1',
                    'reg_number' => 'REG-2026-005',
                ],
            ];

            $students = [];
            foreach ($studentSpecs as $spec) {
                $user = $this->ensureUser($spec['email'], $spec['name'], (int) $roles['murid'], self::PASSWORD_STUDENT);
                $student = Student::query()->firstOrNew(['student_number' => $spec['number']]);
                $student->fill([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'gender' => $spec['gender'],
                    'birth_date' => $spec['birth_date'],
                    'address' => $spec['address'],
                    'status' => 'active',
                ])->save();
                $students[$spec['email']] = $student;

                ClassStudent::query()->firstOrCreate(
                    [
                        'classroom_id' => $classrooms[$spec['classroom']]->id,
                        'student_id' => $student->id,
                        'academic_year_id' => $activeYear->id,
                        'semester_id' => $activeSemester->id,
                    ],
                    [
                        'status' => 'active',
                        'assigned_at' => '2026-07-13',
                    ],
                );

                AcademicRegistration::query()->firstOrCreate(
                    [
                        'student_id' => $student->id,
                        'academic_year_id' => $activeYear->id,
                        'semester_id' => $activeSemester->id,
                    ],
                    [
                        'registration_number' => $spec['reg_number'],
                        'status' => 'approved',
                        'registered_at' => '2026-07-10',
                        'notes' => 'Registrasi ulang semester ganjil terverifikasi.',
                    ],
                );
            }

            $parentSpecs = [
                [
                    'email' => 'slamet.walimurid@bhaktiprajabatang.sch.id',
                    'name' => 'Slamet Riyadi',
                    'phone' => '081548201101',
                    'address' => 'Jl. Jenderal Sudirman No. 18, Batang',
                    'occupation' => 'Wiraswasta',
                    'children' => [
                        'siswa1@bhaktiprajabatang.sch.id' => 'ayah',
                        'dimas.pratama@bhaktiprajabatang.sch.id' => 'wali',
                    ],
                ],
                [
                    'email' => 'dewi.walimurid@bhaktiprajabatang.sch.id',
                    'name' => 'Dewi Lestari',
                    'phone' => '081548201102',
                    'address' => 'Jl. Pemuda No. 42, Kauman, Batang',
                    'occupation' => 'Pegawai Swasta',
                    'children' => [
                        'siswa2@bhaktiprajabatang.sch.id' => 'ibu',
                        'nabila.putri@bhaktiprajabatang.sch.id' => 'ibu',
                    ],
                ],
            ];

            $parentUsers = [];
            foreach ($parentSpecs as $spec) {
                $user = $this->ensureUser($spec['email'], $spec['name'], (int) $roles['wali_murid'], self::PASSWORD_PARENT);
                $parentUsers[$spec['email']] = $user;
                $guardian = Guardian::query()->firstOrNew(['email' => $spec['email']]);
                $guardian->fill([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'phone' => $spec['phone'],
                    'address' => $spec['address'],
                    'occupation' => $spec['occupation'],
                    'status' => 'active',
                ])->save();

                foreach ($spec['children'] as $studentEmail => $relationship) {
                    $student = $students[$studentEmail];
                    $guardian->students()->syncWithoutDetaching([
                        $student->id => ['relationship' => $relationship],
                    ]);
                }
            }

            $subjects = Subject::query()->pluck('id', 'code');
            $loadDefs = [
                ['guru.baru@bhaktiprajabatang.sch.id', 'BP-RPL-MAPEL', 'XI RPL 1', 6, 'LAB-RPL', 'monday', '07:30:00', '09:30:00'],
                ['guru.baru@bhaktiprajabatang.sch.id', 'BP-INFORMATIKA', 'XI RPL 1', 4, 'LAB-RPL', 'wednesday', '07:30:00', '09:30:00'],
                ['rina.kusuma@bhaktiprajabatang.sch.id', 'BP-MTK', 'XI RPL 1', 4, 'R-101', 'tuesday', '07:30:00', '09:30:00'],
                ['rina.kusuma@bhaktiprajabatang.sch.id', 'BP-BING', 'XI RPL 1', 3, 'R-101', 'thursday', '09:45:00', '11:15:00'],
                ['hendra.wijaya@bhaktiprajabatang.sch.id', 'BP-TKR-MAPEL', 'XI TKR 1', 6, 'BENGKEL-TO', 'monday', '09:45:00', '11:45:00'],
                ['rina.kusuma@bhaktiprajabatang.sch.id', 'BP-MTK', 'XI TKR 1', 4, 'R-102', 'friday', '07:30:00', '09:00:00'],
                ['hendra.wijaya@bhaktiprajabatang.sch.id', 'BP-TMI-MAPEL', 'XI TMI 1', 6, 'BENGKEL-TM', 'tuesday', '09:45:00', '11:45:00'],
            ];

            foreach ($loadDefs as [$teacherEmail, $subjectCode, $className, $hours, $roomCode, $day, $start, $end]) {
                $teacher = $teachers[$teacherEmail];
                $subjectId = $subjects[$subjectCode];
                $classroom = $classrooms[$className];

                $load = TeachingLoad::query()->firstOrCreate(
                    [
                        'teacher_id' => $teacher->id,
                        'subject_id' => $subjectId,
                        'classroom_id' => $classroom->id,
                        'semester_id' => $activeSemester->id,
                    ],
                    [
                        'weekly_hours' => $hours,
                        'status' => 'active',
                    ],
                );
                $syncLoads[] = (int) $load->id;

                Schedule::query()->firstOrCreate(
                    [
                        'subject_id' => $subjectId,
                        'classroom_id' => $classroom->id,
                        'teacher_id' => $teacher->id,
                        'semester_id' => $activeSemester->id,
                        'academic_year_id' => $activeYear->id,
                        'day' => $day,
                        'start_time' => $start,
                    ],
                    [
                        'room_id' => $rooms[$roomCode]->id,
                        'end_time' => $end,
                        'status' => 'active',
                    ],
                );
            }

            $this->seedFinance(
                $admin,
                $students,
                $parentUsers['slamet.walimurid@bhaktiprajabatang.sch.id'],
                $parentUsers['dewi.walimurid@bhaktiprajabatang.sch.id'],
            );

            $this->seedCommunications(
                $admin,
                $teachers['guru.baru@bhaktiprajabatang.sch.id']->user,
                array_merge(
                    array_values($parentUsers),
                    [$students['siswa1@bhaktiprajabatang.sch.id']->user],
                ),
            );
        });

        $bridge = app(AisAssessmentRosterBridge::class);
        foreach ($syncLoads as $loadId) {
            $bridge->syncTeachingLoad($loadId);
        }
    }

    private function ensureUser(string $email, string $name, int $roleId, string $plainPassword): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user) {
            $dirty = false;
            if ((int) $user->role_id !== $roleId) {
                $user->role_id = $roleId;
                $dirty = true;
            }
            if ($user->status !== User::STATUS_ACTIVE) {
                $user->status = User::STATUS_ACTIVE;
                $dirty = true;
            }
            if ($dirty) {
                $user->save();
            }

            return $user;
        }

        return User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $plainPassword,
            'role_id' => $roleId,
            'status' => User::STATUS_ACTIVE,
        ]);
    }

    private function activateCoreSubjectsAndCurricula(): void
    {
        $activeCredits = [
            'BP-PANCASILA' => 2,
            'BP-BIND' => 4,
            'BP-PJOK' => 2,
            'BP-SEJARAH' => 2,
            'BP-MTK' => 4,
            'BP-BING' => 3,
            'BP-INFORMATIKA' => 4,
            'BP-IPAS' => 4,
            'BP-PKK' => 4,
            'BP-DDTM' => 6,
            'BP-DDTO' => 6,
            'BP-DDPPLG' => 6,
            'BP-TMI-MAPEL' => 6,
            'BP-TKR-MAPEL' => 6,
            'BP-TSM-MAPEL' => 6,
            'BP-RPL-MAPEL' => 6,
        ];

        foreach ($activeCredits as $code => $hours) {
            Subject::query()->where('code', $code)->update([
                'credit_hours' => $hours,
                'status' => 'active',
            ]);
        }

        $programs = StudyProgram::query()->get();
        foreach ($programs as $program) {
            $curriculum = Curriculum::query()->firstOrCreate(
                [
                    'study_program_id' => $program->id,
                    'name' => 'KOSP Kurikulum Merdeka 2026/2027 - '.$program->name,
                    'year' => '2026/2027',
                ],
                [
                    'is_active' => true,
                    'source_url' => config('school.sources.2.url'),
                    'notes' => 'Kurikulum operasional aktif tahun ajaran 2026/2027 untuk konsentrasi '.$program->name.'.',
                ],
            );

            if ($curriculum->wasRecentlyCreated) {
                $subjectIds = Subject::query()
                    ->whereNull('study_program_id')
                    ->orWhere('study_program_id', $program->id)
                    ->pluck('id');
                $curriculum->subjects()->syncWithoutDetaching($subjectIds);
            }
        }
    }

    private function seedFinance(User $admin, array $students, User $parentSlamet, User $parentDewi): void
    {
        $pngBytes = base64_decode(self::TINY_PNG_BASE64, true);

        $createInvoiceWithPayment = function (
            Student $student,
            string $type,
            string $amount,
            string $dueDate,
            ?array $paymentSpec = null,
        ) use ($admin, $pngBytes): Invoice {
            $invoice = Invoice::query()->firstOrNew([
                'student_id' => $student->id,
                'invoice_type' => $type,
                'due_date' => $dueDate,
            ]);

            if (! $invoice->exists) {
                $invoice->created_by = $admin->id;
                $invoice->amount = $amount;
                $invoice->status = ($paymentSpec['status'] ?? null) === 'verified' ? 'paid' : 'unpaid';
                $invoice->save();
            }

            if ($paymentSpec && ! Payment::query()->where('invoice_id', $invoice->id)->exists()) {
                $proofPath = 'payment-proofs/seed-bukti-'.$invoice->id.'.png';
                Storage::disk('local')->put($proofPath, $pngBytes);

                $payment = new Payment([
                    'invoice_id' => $invoice->id,
                    'submitted_by' => $paymentSpec['submitter']->id,
                    'payment_date' => $paymentSpec['date'],
                    'amount' => $paymentSpec['amount'],
                    'payment_method' => $paymentSpec['method'],
                    'transaction_number' => $paymentSpec['tx'],
                    'proof_path' => $proofPath,
                    'proof_mime' => 'image/png',
                    'proof_size' => strlen($pngBytes),
                ]);
                $payment->status = $paymentSpec['status'];
                if ($paymentSpec['status'] === 'verified') {
                    $payment->verified_by = $admin->id;
                    $payment->verified_at = now()->subDays(1);
                }
                $payment->save();
            }

            return $invoice;
        };

        $ahmad = $students['siswa1@bhaktiprajabatang.sch.id'];
        $siti = $students['siswa2@bhaktiprajabatang.sch.id'];
        $dimas = $students['dimas.pratama@bhaktiprajabatang.sch.id'];
        $nabila = $students['nabila.putri@bhaktiprajabatang.sch.id'];
        $rizky = $students['rizky.ramadhan@bhaktiprajabatang.sch.id'];

        $today = now('Asia/Jakarta');

        $createInvoiceWithPayment($ahmad, 'spp', '250000.00', $today->copy()->addDays(10)->toDateString(), [
            'submitter' => $parentSlamet,
            'date' => $today->copy()->subDays(3)->format('Y-m-d 09:15:00'),
            'amount' => '250000.00',
            'method' => 'Transfer Bank BRI',
            'tx' => 'TRX-BP-20261101',
            'status' => 'verified',
        ]);
        $createInvoiceWithPayment($ahmad, 'exam', '150000.00', $today->copy()->addDays(14)->toDateString());
        $overdueAhmadBook = $createInvoiceWithPayment($ahmad, 'book', '175000.00', $today->copy()->subDays(5)->toDateString(), [
            'submitter' => $parentSlamet,
            'date' => $today->copy()->subDay()->format('Y-m-d 14:20:00'),
            'amount' => '175000.00',
            'method' => 'QRIS Sekolah',
            'tx' => 'TRX-BP-20261102',
            'status' => 'pending',
        ]);

        $createInvoiceWithPayment($siti, 'spp', '250000.00', $today->copy()->addDays(10)->toDateString(), [
            'submitter' => $parentDewi,
            'date' => $today->copy()->subDays(2)->format('Y-m-d 10:05:00'),
            'amount' => '250000.00',
            'method' => 'Transfer Bank Jateng',
            'tx' => 'TRX-BP-20261103',
            'status' => 'verified',
        ]);
        $createInvoiceWithPayment($siti, 'activity', '120000.00', $today->copy()->addDays(20)->toDateString());

        $createInvoiceWithPayment($dimas, 'spp', '250000.00', $today->copy()->subDays(4)->toDateString());
        $createInvoiceWithPayment($nabila, 'uniform', '350000.00', $today->copy()->addDays(12)->toDateString());
        $createInvoiceWithPayment($rizky, 'spp', '250000.00', $today->copy()->addDays(15)->toDateString());

        PortalNotification::query()->firstOrCreate(
            [
                'user_id' => $parentSlamet->id,
                'category' => 'payment_reminder',
                'source_id' => $overdueAhmadBook->id,
            ],
            [
                'title' => 'Pengingat Tagihan Modul & Buku Praktikum',
                'message' => 'Pembayaran tagihan buku Ahmad Fauzi sebesar Rp175.000 telah diterima dan sedang menunggu verifikasi bendahara sekolah.',
                'is_read' => false,
            ],
        );
    }

    private function seedCommunications(User $admin, User $budi, array $recipients): void
    {
        $items = [
            [
                'author' => $admin,
                'title' => 'Jadwal Penilaian Akhir Semester (PAS) Ganjil 2026/2027',
                'content' => 'Pelaksanaan PAS Ganjil dimulai tanggal 1 Desember 2026 melalui portal Assessment SMK Bhakti Praja Batang. Siswa wajib memastikan status registrasi aktif dan kehadiran tepat waktu.',
                'target_role' => 'all',
            ],
            [
                'author' => $admin,
                'title' => 'Panduan Pembayaran SPP & Verifikasi Bukti Transfer',
                'content' => 'Wali murid dapat mengunggah bukti pembayaran melalui Portal Wali > Tagihan Pendidikan. Admin keuangan memverifikasi bukti pembayaran maksimal 1x24 jam kerja.',
                'target_role' => 'wali_murid',
            ],
            [
                'author' => $budi,
                'title' => 'Persiapan Praktikum Pemrograman Web Kelas XI RPL 1',
                'content' => 'Siswa XI RPL 1 silakan mengerjakan kuis evaluasi dan meninjau tugas mini proyek pada menu Assessment sebelum sesi praktikum lab hari Rabu.',
                'target_role' => 'murid',
            ],
        ];

        foreach ($items as $item) {
            $announcement = Announcement::query()->firstOrCreate(
                ['title' => $item['title'], 'target_role' => $item['target_role']],
                ['created_by' => $item['author']->id, 'content' => $item['content']],
            );

            foreach ($recipients as $recipient) {
                if (! $recipient) {
                    continue;
                }
                PortalNotification::query()->firstOrCreate(
                    [
                        'user_id' => $recipient->id,
                        'category' => 'announcement',
                        'source_id' => $announcement->id,
                    ],
                    [
                        'title' => $announcement->title,
                        'message' => $announcement->content,
                        'is_read' => false,
                    ],
                );
            }
        }
    }
}
