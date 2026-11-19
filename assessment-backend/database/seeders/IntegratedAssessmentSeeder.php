<?php

namespace Database\Seeders;

use App\Enums\AttemptStatus;
use App\Enums\ChallengeMode;
use App\Enums\GameMode;
use App\Enums\NotificationType;
use App\Enums\OptionLabel;
use App\Enums\QuestionSource;
use App\Enums\QuestionType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Announcement;
use App\Models\Assignment;
use App\Models\Attempt;
use App\Models\AttemptAnswer;
use App\Models\LmsNotification;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AisGradebookExporter;
use App\Services\AisRosterSyncService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class IntegratedAssessmentSeeder extends Seeder
{
    public function run(): void
    {
        app(AisRosterSyncService::class)->syncAll();

        DB::transaction(function (): void {
            $rplClass = $this->resolveClass(
                'Rekayasa Perangkat Lunak · XI RPL 1',
                'guru.baru@bhaktiprajabatang.sch.id',
                'Kelas pemrograman web, basis data, dan rekayasa perangkat lunak XI RPL 1.',
            );
            $infClass = $this->resolveClass(
                'Informatika · XI RPL 1',
                'guru.baru@bhaktiprajabatang.sch.id',
                'Pembelajaran logika algoritma, struktur data dasar, dan komputasi XI RPL 1.',
            );
            $mtkClass = $this->resolveClass(
                'Matematika · XI RPL 1',
                'rina.kusuma@bhaktiprajabatang.sch.id',
                'Matematika terapan SMK kelas XI RPL 1.',
            );
            $tkrClass = $this->resolveClass(
                'Teknik Kendaraan Ringan · XI TKR 1',
                'hendra.wijaya@bhaktiprajabatang.sch.id',
                'Kompetensi kelistrikan bodi dan mesin injeksi EFI kelas XI TKR 1.',
            );

            $ahmad = $this->ensureUser('siswa1@bhaktiprajabatang.sch.id', 'Ahmad Fauzi', Role::Student, 'MuridBhakti#2026');
            $siti = $this->ensureUser('siswa2@bhaktiprajabatang.sch.id', 'Siti Aisyah', Role::Student, 'MuridBhakti#2026');
            $dimas = $this->ensureUser('dimas.pratama@bhaktiprajabatang.sch.id', 'Dimas Pratama', Role::Student, 'MuridBhakti#2026');
            $nabila = $this->ensureUser('nabila.putri@bhaktiprajabatang.sch.id', 'Nabila Putri', Role::Student, 'MuridBhakti#2026');

            foreach ([$rplClass, $infClass, $mtkClass] as $class) {
                $ids = array_values(array_filter([$ahmad?->id, $siti?->id, $dimas?->id]));
                if ($ids !== []) {
                    $class->students()->syncWithoutDetaching($ids);
                }
            }
            if ($nabila) {
                $tkrClass->students()->syncWithoutDetaching([$nabila->id]);
            }

            $rplQuiz = $this->seedQuizWithQuestions(
                $rplClass,
                'Evaluasi Pemrograman Web & Basis Data',
                [
                    'description' => 'Evaluasi pemahaman REST API, HTTP status code, dan relasi tabel SQL.',
                    'assessment_type' => 'quiz',
                    'course_name' => 'Rekayasa Perangkat Lunak',
                    'instructions' => 'Bacalah setiap soal dengan teliti. Nilai otomatis tampil setelah selesai.',
                    'open_at' => now()->subDays(7),
                    'deadline' => now()->addDays(21),
                    'duration_minutes' => 45,
                    'release_mode' => 'immediate',
                    'results_released' => true,
                    'status' => QuizStatus::Published,
                ],
                [
                    [
                        'Kode status HTTP manakah yang paling tepat dikembalikan ketika resource baru berhasil dibuat melalui permintaan POST?',
                        ['200 OK', '201 Created', '204 No Content', '400 Bad Request'],
                        'B',
                        'REST API API',
                        '201 Created menandakan resource baru berhasil dibuat di server.',
                    ],
                    [
                        'Dalam desain basis data relasional, constraint apa yang memastikan setiap nilai foreign key merujuk ke baris yang valid pada tabel induk?',
                        ['UNIQUE KEY', 'CHECK CONSTRAINT', 'FOREIGN KEY', 'FULLTEXT INDEX'],
                        'C',
                        'Basis Data',
                        'FOREIGN KEY menjaga integritas referensial antar tabel induk dan anak.',
                    ],
                    [
                        'Perintah SQL manakah yang digunakan untuk mengambil data unik tanpa duplikat dari sebuah kolom?',
                        ['SELECT UNIQUE', 'SELECT DISTINCT', 'SELECT FILTER', 'SELECT GROUP'],
                        'B',
                        'Query SQL',
                        'SELECT DISTINCT menyaring baris duplikat pada hasil query.',
                    ],
                    [
                        'Manakah pola arsitektur Laravel yang bertugas menangani validasi permintaan HTTP dan mengembalikan respons JSON?',
                        ['Migration', 'Controller', 'Seeder', 'Observer'],
                        'B',
                        'Framework Web',
                        'Controller menerima request dari router, memvalidasi input, lalu mengembalikan response.',
                    ],
                    [
                        'Mengapa token autentikasi API sebaiknya dikirim melalui header Authorization Bearer daripada query string URL?',
                        ['Agar URL tidak tercatat di riwayat browser dan log server', 'Karena URL maksimal 10 karakter', 'Agar JSON berubah menjadi XML', 'Supaya tidak membutuhkan HTTPS'],
                        'A',
                        'Keamanan Web',
                        'Query string mudah terekam pada browser history dan access log, sedangkan header lebih aman saat memakai HTTPS.',
                    ],
                ],
            );

            $this->seedQuizWithQuestions(
                $infClass,
                'Latihan Logika & Algoritma Pemrograman',
                [
                    'description' => 'Kuis latihan struktur kontrol, kompleksitas dasar, dan logika pemrograman.',
                    'assessment_type' => 'quiz',
                    'course_name' => 'Informatika',
                    'instructions' => 'Kerjakan sebagai latihan sebelum praktikum laboratorium.',
                    'open_at' => now()->subDays(2),
                    'deadline' => now()->addDays(30),
                    'duration_minutes' => 30,
                    'release_mode' => 'immediate',
                    'results_released' => true,
                    'status' => QuizStatus::Published,
                ],
                [
                    [
                        'Struktur data manakah yang bekerja dengan prinsip LIFO (Last In, First Out)?',
                        ['Queue', 'Stack', 'Linked List', 'Hash Table'],
                        'B',
                        'Struktur Data',
                        'Stack menumpuk elemen sehingga data terakhir masuk akan keluar pertama.',
                    ],
                    [
                        'Berapakah kompleksitas waktu pencarian biner (Binary Search) pada array terurut berukuran n?',
                        ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
                        'B',
                        'Algoritma',
                        'Binary Search membagi ruang pencarian menjadi dua bagian di tiap langkah.',
                    ],
                    [
                        'Pada pemrograman, perulangan mana yang selalu menjalankan blok kode minimal satu kali sebelum memeriksa kondisi?',
                        ['for', 'while', 'do...while', 'foreach'],
                        'C',
                        'Alur Kontrol',
                        'do...while mengevaluasi kondisi di akhir iterasi.',
                    ],
                    [
                        'Apa hasil dari operasi modulo 17 % 5?',
                        ['2', '3', '4', '12'],
                        'A',
                        'Operator Aritmatika',
                        '17 dibagi 5 sama dengan 3 dengan sisa bagi 2.',
                    ],
                    [
                        'Tipe data yang tepat untuk menyimpan nilai benar atau salah (true/false) adalah:',
                        ['Integer', 'Float', 'Boolean', 'String'],
                        'C',
                        'Dasar Pemrograman',
                        'Boolean merepresentasikan nilai logika true atau false.',
                    ],
                ],
            );

            $mtkQuiz = $this->seedQuizWithQuestions(
                $mtkClass,
                'PTS Matematika Terapan - Persamaan & Fungsi',
                [
                    'description' => 'Penilaian Tengah Semester materi aljabar linear, fungsi kuadrat, dan barisan aritmatika.',
                    'assessment_type' => 'exam',
                    'course_name' => 'Matematika',
                    'instructions' => 'Periksa kembali perhitungan Anda sebelum mengumpulkan jawaban.',
                    'open_at' => now()->subDays(5),
                    'deadline' => now()->addDays(14),
                    'duration_minutes' => 60,
                    'release_mode' => 'immediate',
                    'results_released' => true,
                    'status' => QuizStatus::Published,
                ],
                [
                    [
                        'Jika 3x + 7 = 22, maka nilai x adalah:',
                        ['3', '4', '5', '6'],
                        'C',
                        'Persamaan Linear',
                        '3x = 22 - 7 = 15, sehingga x = 5.',
                    ],
                    [
                        'Suku ke-6 dari barisan aritmatika 4, 7, 10, 13, ... adalah:',
                        ['16', '19', '22', '25'],
                        'B',
                        'Barisan Aritmatika',
                        'a = 4 dan beda b = 3, maka U6 = 4 + 5(3) = 19.',
                    ],
                    [
                        'Diketahui fungsi f(x) = 2x^2 - 3x + 1. Nilai f(2) adalah:',
                        ['1', '2', '3', '5'],
                        'C',
                        'Fungsi Kuadrat',
                        'f(2) = 2(4) - 6 + 1 = 3.',
                    ],
                    [
                        'Gradien garis yang melalui titik (1, 2) dan (4, 8) adalah:',
                        ['1', '2', '3', '4'],
                        'B',
                        'Persamaan Garis',
                        'm = (8 - 2) / (4 - 1) = 6 / 3 = 2.',
                    ],
                    [
                        'Jika sebuah toko memberikan diskon 20% untuk barang seharga Rp150.000, harga setelah diskon adalah:',
                        ['Rp115.000', 'Rp120.000', 'Rp125.000', 'Rp130.000'],
                        'B',
                        'Aritmatika Terapan',
                        'Potongan 20% x 150.000 = 30.000, sehingga harga akhir Rp120.000.',
                    ],
                ],
            );

            $this->seedQuizWithQuestions(
                $tkrClass,
                'Sistem Kelistrikan & Injeksi EFI Dasar',
                [
                    'description' => 'Evaluasi sensor dan aktuator pada sistem Electronic Fuel Injection kendaraan ringan.',
                    'assessment_type' => 'quiz',
                    'course_name' => 'Teknik Kendaraan Ringan',
                    'instructions' => 'Pilih jawaban paling tepat sesuai standar perawatan berkala otomotif.',
                    'open_at' => now()->subDays(1),
                    'deadline' => now()->addDays(25),
                    'duration_minutes' => 30,
                    'release_mode' => 'immediate',
                    'results_released' => true,
                    'status' => QuizStatus::Published,
                ],
                [
                    [
                        'Komponen EFI yang berfungsi mendeteksi besar sudut pembukaan katup gas adalah:',
                        ['CKP Sensor', 'TPS (Throttle Position Sensor)', 'O2 Sensor', 'ECT Sensor'],
                        'B',
                        'Sensor EFI',
                        'TPS membaca posisi sudut bukaan throttle valve dan mengirim sinyalnya ke ECU.',
                    ],
                    [
                        'Alat ukur yang digunakan untuk memeriksa tegangan pengisian baterai/aki 12V adalah:',
                        ['Micrometer', 'Multimeter', 'Feeler Gauge', 'Dial Indicator'],
                        'B',
                        'Kelistrikan Otomotif',
                        'Multimeter pada mode DC Volt digunakan untuk mengukur tegangan aki.',
                    ],
                    [
                        'Fungsi utama fuse (sekring) pada rangkaian kelistrikan bodi kendaraan adalah:',
                        ['Menaikkan tegangan baterai', 'Melindungi rangkaian dari arus berlebih/korsleting', 'Mengubah arus AC ke DC', 'Mengatur putaran kipas radiator'],
                        'B',
                        'Pengaman Rangkaian',
                        'Sekring akan putus jika arus melebihi batas aman untuk mencegah kerusakan kabel.',
                    ],
                    [
                        'Sensor yang membaca temperatur cairan pendingin mesin untuk menentukan koreksi pengayaan bahan bakar saat mesin dingin adalah:',
                        ['ECT (Engine Coolant Temperature)', 'CMP Sensor', 'VSS (Vehicle Speed Sensor)', 'Knock Sensor'],
                        'A',
                        'Sensor EFI',
                        'ECT memantau suhu air pendingin mesin dan melaporkannya ke ECU.',
                    ],
                ],
            );

            $this->seedQuizWithQuestions(
                $rplClass,
                'Persiapan Uji Kompetensi Keahlian (UKK) RPL',
                [
                    'description' => 'Draft bank soal persiapan UKK yang masih perlu ditinjau guru pengampu.',
                    'assessment_type' => 'quiz',
                    'course_name' => 'Rekayasa Perangkat Lunak',
                    'instructions' => 'Draft internal guru sebelum diterbitkan ke siswa.',
                    'open_at' => now()->addDays(7),
                    'deadline' => now()->addDays(45),
                    'duration_minutes' => 60,
                    'release_mode' => 'manual',
                    'results_released' => false,
                    'status' => QuizStatus::Draft,
                ],
                [
                    [
                        'Metode pengujian perangkat lunak yang berfokus pada fungsionalitas input dan output tanpa melihat kode sumber internal disebut:',
                        ['White-box Testing', 'Black-box Testing', 'Unit Profiling', 'Static Linting'],
                        'B',
                        'Pengujian Sistem',
                        'Black-box testing menguji perilaku sistem berdasarkan spesifikasi fungsional.',
                    ],
                    [
                        'Format pertukaran data ringan yang paling umum dipakai oleh layanan REST API modern adalah:',
                        ['INI', 'JSON', 'BMP', 'RTF'],
                        'B',
                        'Integrasi Sistem',
                        'JSON ringkas, mudah dibaca manusia, dan didukung langsung oleh browser serta backend.',
                    ],
                    [
                        'Perintah Git manakah yang membuat branch baru sekaligus langsung berpindah ke branch tersebut?',
                        ['git merge -b feature', 'git checkout -b feature', 'git status -b feature', 'git clone -b feature'],
                        'B',
                        'Version Control',
                        'git checkout -b <nama-branch> (atau git switch -c) membuat dan mengaktifkan branch baru.',
                    ],
                ],
                false,
            );

            if ($ahmad) {
                $this->seedCompletedAttempt($rplQuiz, $ahmad, 4, 'Pemahaman REST API dan SQL sangat baik; pelajari kembali detail status kode HTTP.');
                $this->seedCompletedAttempt($mtkQuiz, $ahmad, 4, 'Langkah penyelesaian aljabar dan aritmatika sudah tepat.');
            }
            if ($siti) {
                $this->seedCompletedAttempt($rplQuiz, $siti, 5, 'Nilai sempurna! Semua konsep REST API, SQL, dan keamanan dijawab benar.');
            }
            if ($dimas) {
                $this->seedCompletedAttempt($mtkQuiz, $dimas, 3, 'Tingkatkan ketelitian pada soal persamaan garis lurus.');
            }

            $this->seedAssignments($rplClass, $infClass, $tkrClass);
            $this->seedAnnouncementsAndNotifications($rplClass, $infClass, $rplQuiz, [$ahmad, $siti, $dimas]);
        });

        app(AisGradebookExporter::class)->exportAllReleased();
    }

    private function resolveClass(string $name, string $teacherEmail, string $description): SchoolClass
    {
        $existing = SchoolClass::query()->where('name', $name)->first();
        if ($existing) {
            if (! $existing->description) {
                $existing->description = $description;
                $existing->save();
            }

            return $existing;
        }

        $teacherName = match ($teacherEmail) {
            'rina.kusuma@bhaktiprajabatang.sch.id' => 'Rina Kusuma, S.Pd.',
            'hendra.wijaya@bhaktiprajabatang.sch.id' => 'Hendra Wijaya, S.T.',
            default => 'Budi Santoso, S.Kom',
        };
        $teacher = $this->ensureUser($teacherEmail, $teacherName, Role::Teacher, 'GuruBhakti#2026');

        $schoolClass = new SchoolClass([
            'name' => $name,
            'description' => $description,
        ]);
        $schoolClass->teacher_id = $teacher->id;
        $schoolClass->save();

        return $schoolClass;
    }

    private function ensureUser(string $email, string $name, Role $role, string $plainPassword): User
    {
        $aisRoleName = match ($role) {
            Role::Admin => 'admin',
            Role::Teacher => 'guru',
            Role::Student => 'murid',
        };
        $roleId = \Illuminate\Support\Facades\Schema::hasTable('roles')
            ? \Illuminate\Support\Facades\DB::table('roles')->where('name', $aisRoleName)->value('id')
            : null;

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            $dirty = false;
            if ($existing->role !== $role) {
                $existing->role = $role;
                $dirty = true;
            }
            if ($roleId !== null && \Illuminate\Support\Facades\Schema::hasColumn('users', 'role_id') && (int) $existing->role_id !== (int) $roleId) {
                $existing->role_id = $roleId;
                $dirty = true;
            }
            if ($dirty) {
                $existing->save();
            }

            return $existing;
        }

        $user = new User([
            'name' => $name,
            'email' => $email,
            'password' => $plainPassword,
        ]);
        $user->role = $role;
        if ($roleId !== null && \Illuminate\Support\Facades\Schema::hasColumn('users', 'role_id')) {
            $user->forceFill(['role_id' => $roleId, 'status' => 'active']);
        }
        $user->save();

        return $user;
    }

    private function seedQuizWithQuestions(
        SchoolClass $schoolClass,
        string $title,
        array $attributes,
        array $questionSpecs,
        bool $reviewed = true,
    ): Quiz {
        $quiz = Quiz::query()->where('class_id', $schoolClass->id)->where('title', $title)->first();
        if ($quiz) {
            return $quiz;
        }

        $quiz = new Quiz([
            'title' => $title,
            'description' => $attributes['description'],
            'deadline' => $attributes['deadline'],
            'assessment_type' => $attributes['assessment_type'],
            'course_name' => $attributes['course_name'],
            'instructions' => $attributes['instructions'],
            'open_at' => $attributes['open_at'],
            'duration_minutes' => $attributes['duration_minutes'],
            'release_mode' => $attributes['release_mode'],
            'results_released' => $attributes['results_released'],
        ]);
        $quiz->class_id = $schoolClass->id;
        $quiz->status = $attributes['status'];
        $quiz->save();

        $pointsPerQuestion = (int) floor(100 / max(1, count($questionSpecs)));
        foreach ($questionSpecs as [$text, $options, $correctLabel, $topic, $explanation]) {
            $question = new Question([
                'question_text' => $text,
                'question_type' => QuestionType::MultipleChoice,
                'points' => $pointsPerQuestion,
                'explanation' => $explanation,
                'topic' => $topic,
                'is_bank_item' => $reviewed,
            ]);
            $question->quiz_id = $quiz->id;
            $question->source = QuestionSource::Manual->value;
            $question->reviewed = $reviewed;
            $question->save();

            foreach (OptionLabel::cases() as $idx => $label) {
                $option = new Option([
                    'option_label' => $label,
                    'option_text' => $options[$idx],
                    'is_correct' => $label->value === $correctLabel,
                ]);
                $option->question_id = $question->id;
                $option->save();
            }
        }

        return $quiz;
    }

    private function seedCompletedAttempt(Quiz $quiz, User $student, int $correctCount, string $feedback): void
    {
        $exists = Attempt::query()
            ->where('quiz_id', $quiz->id)
            ->where('student_id', $student->id)
            ->exists();
        if ($exists) {
            return;
        }

        $questions = $quiz->questions()->with('options')->get();
        $total = $questions->count();
        if ($total === 0) {
            return;
        }

        $grade = round(($correctCount / $total) * 100, 2);
        $startedAt = now()->subDays(2);
        $finishedAt = $startedAt->copy()->addMinutes(12);

        $attempt = new Attempt([
            'game_mode' => GameMode::Expedition,
            'challenge_mode' => ChallengeMode::Normal,
        ]);
        $attempt->quiz_id = $quiz->id;
        $attempt->student_id = $student->id;
        $attempt->started_at = $startedAt;
        $attempt->finished_at = $finishedAt;
        $attempt->graded_at = $finishedAt;
        $attempt->expires_at = $startedAt->copy()->addMinutes($quiz->duration_minutes);
        $attempt->status = AttemptStatus::Finished;
        $attempt->score = $grade;
        $attempt->final_grade = $grade;
        $attempt->streak_max = $correctCount;
        $attempt->multiplier_max = 1.00;
        $attempt->progress_percentage = 100.00;
        $attempt->teacher_feedback = $feedback;
        $attempt->save();

        foreach ($questions as $index => $question) {
            $wantCorrect = $index < $correctCount;
            $chosen = $question->options->firstWhere('is_correct', $wantCorrect)
                ?? $question->options->first();

            $answer = new AttemptAnswer([
                'question_id' => $question->id,
                'chosen_option_id' => $chosen->id,
            ]);
            $answer->attempt_id = $attempt->id;
            $answer->is_correct = (bool) $chosen->is_correct;
            $answer->answered_at = $startedAt->copy()->addMinutes($index + 1);
            $answer->save();
        }
    }

    private function seedAssignments(SchoolClass $rplClass, SchoolClass $infClass, SchoolClass $tkrClass): void
    {
        $defs = [
            [$rplClass, 'Mini Proyek API Laravel & MySQL', 'Buat endpoint CRUD terautentikasi Sanctum dan uji lewat Postman/Vitest.', 'published', now()->addDays(10)],
            [$rplClass, 'Normalisasi Skema Database Sekolah', 'Dokumentasikan ERD 3NF untuk sistem informasi akademik SMK.', 'published', now()->addDays(18)],
            [$infClass, 'Flowchart Algoritma Pencarian Data', 'Gambar flowchart serta pseudocode Binary Search dalam format PDF.', 'published', now()->addDays(12)],
            [$tkrClass, 'Laporan Praktikum Pemeriksaan Sensor EFI', 'Catat hasil pengukuran tegangan TPS dan ECT menggunakan multimeter.', 'draft', now()->addDays(21)],
        ];

        foreach ($defs as [$class, $title, $description, $status, $deadline]) {
            $existing = Assignment::query()->where('class_id', $class->id)->where('title', $title)->first();
            if ($existing) {
                continue;
            }
            $assignment = new Assignment([
                'title' => $title,
                'description' => $description,
                'deadline' => $deadline,
                'status' => $status,
                'published_at' => $status === 'published' ? now()->subDays(1) : null,
            ]);
            $assignment->class_id = $class->id;
            $assignment->save();
        }
    }

    private function seedAnnouncementsAndNotifications(
        SchoolClass $rplClass,
        SchoolClass $infClass,
        Quiz $rplQuiz,
        array $students,
    ): void {
        $items = [
            [$rplClass, 'Pembukaan Kuis Evaluasi Pemrograman Web & Basis Data', 'Silakan kerjakan evaluasi sebelum tenggat waktu. Skor langsung masuk ke buku nilai setelah selesai.', true],
            [$infClass, 'Latihan Algoritma Pra-Praktikum Lab', 'Gunakan kuis latihan algoritma sebagai persiapan sesi praktik laboratorium minggu ini.', false],
        ];

        foreach ($items as [$class, $title, $content, $pinned]) {
            $existing = Announcement::query()->where('class_id', $class->id)->where('title', $title)->first();
            if ($existing) {
                continue;
            }
            $announcement = new Announcement([
                'title' => $title,
                'content' => $content,
                'is_pinned' => $pinned,
            ]);
            $announcement->class_id = $class->id;
            $announcement->author_id = $class->teacher_id;
            $announcement->save();
        }

        foreach ($students as $student) {
            if (! $student) {
                continue;
            }
            $already = LmsNotification::query()
                ->where('user_id', $student->id)
                ->where('class_id', $rplClass->id)
                ->where('type', NotificationType::QuizPublished->value)
                ->exists();
            if ($already) {
                continue;
            }
            LmsNotification::query()->create([
                'user_id' => $student->id,
                'class_id' => $rplClass->id,
                'type' => NotificationType::QuizPublished->value,
                'title' => 'Kuis baru tersedia: '.$rplQuiz->title,
                'body' => 'Kerjakan evaluasi pada kelas Rekayasa Perangkat Lunak · XI RPL 1.',
                'data' => ['quiz_id' => $rplQuiz->id],
            ]);
        }
    }
}
