<?php

// Only an explicitly selected disposable k6 database may be populated.
$root = dirname(__DIR__, 2);
$expected = str_replace('\\', '/', $root.'/.tools/k6/k6-lms.sqlite');
$selected = str_replace('\\', '/', getenv('DB_DATABASE') ?: '');
if (getenv('DB_CONNECTION') !== 'sqlite' || $selected !== $expected) {
    throw new RuntimeException('Select the isolated .tools/k6/k6-lms.sqlite database first.');
}
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (str_replace('\\', '/', config('database.connections.sqlite.database')) !== $expected) throw new RuntimeException('Database configuration is not isolated.');

use App\Models\{Role, User};
use Illuminate\Support\Facades\{DB, Storage};

(new Database\Seeders\RoleSeeder)->run();
DB::statement('PRAGMA journal_mode=WAL');
DB::statement('PRAGMA busy_timeout=10000');
if (DB::table('lms_courses')->exists()) throw new RuntimeException('Use a fresh disposable k6 database for a reproducible fixture.');

$now = now();
$password = password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT);
$teachers = []; $students = [];
for ($i = 1; $i <= 50; $i++) {
    // Interleaved identities keep the teacher/student mix at 10%/90% at every load level.
    $role = $i % 10 === 1 ? 'guru' : 'murid';
    $user = User::create(['name' => "K6 User $i", 'email' => "k6-$i@performance.test", 'password' => $password, 'role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    $entry = ['vu' => $i, 'user' => $user, 'role' => $role, 'token' => $user->createToken('isolated-k6-test')->plainTextToken];
    if ($role === 'guru') $teachers[] = $entry; else $students[] = $entry;
}
$pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
Storage::disk('local')->put('lms/k6-material.pdf', $pdf);
$courses = [];
foreach ($teachers as $index => $teacher) {
    $course = DB::table('lms_courses')->insertGetId(['teacher_id' => $teacher['user']->id, 'name' => 'K6 Course '.($index + 1), 'description' => 'Synthetic LMS concurrency fixture', 'code' => 'K6COURSE'.($index + 1), 'created_at' => $now, 'updated_at' => $now]);
    foreach ($students as $student) DB::table('lms_members')->insert(['course_id' => $course, 'user_id' => $student['user']->id, 'created_at' => $now, 'updated_at' => $now]);
    $material = null;
    for ($m = 0; $m < 4; $m++) {
        $id = DB::table('lms_materials')->insertGetId(['course_id' => $course, 'name' => "Materi $m.pdf", 'path' => 'lms/k6-material.pdf', 'visibility' => $m === 3 ? 'private' : 'public', 'created_at' => $now, 'updated_at' => $now]);
        $material ??= $id;
    }
    for ($a = 1; $a <= 5; $a++) {
        $assignment = DB::table('lms_assignments')->insertGetId(['course_id' => $course, 'title' => "Tugas $a", 'instructions' => 'Jawab berdasarkan materi.', 'due_at' => now()->addDays(7), 'status' => 'published', 'created_at' => $now, 'updated_at' => $now]);
        foreach ($students as $student) DB::table('lms_submissions')->insert(['assignment_id' => $assignment, 'user_id' => $student['user']->id, 'answer' => 'Contoh jawaban pengujian', 'grade' => 85, 'created_at' => $now, 'updated_at' => $now]);
    }
    foreach ($students as $student) DB::table('lms_attendance')->insert(['course_id' => $course, 'user_id' => $student['user']->id, 'meeting_date' => now()->toDateString(), 'status' => 'hadir', 'created_at' => $now, 'updated_at' => $now]);
    DB::table('lms_announcements')->insert(['course_id' => $course, 'title' => 'Pengumuman pengujian', 'content' => 'Data sintetis untuk k6.', 'created_at' => $now, 'updated_at' => $now]);
    $draft = DB::table('lms_ai_drafts')->insertGetId(['material_id' => $material, 'requested_by' => $teacher['user']->id, 'model' => 'qwen3.8:27b', 'question_count' => 1, 'status' => 'published', 'reviewed_at' => $now, 'deadline' => now()->addDays(7), 'draft' => json_encode(['title' => 'Kuis sintetis', 'questions' => [['question' => 'Apa fungsi primary key?', 'options' => ['Identitas unik', 'Warna', 'Ukuran', 'Alamat'], 'correct_index' => 0, 'explanation' => 'Pengenal unik pada tabel.']]]), 'created_at' => $now, 'updated_at' => $now]);
    $courses[] = ['course_id' => $course, 'material_id' => $material, 'draft_id' => $draft];
    $teachers[$index] += $courses[$index];
}
$users = [];
foreach ($teachers as $entry) { unset($entry['user']); $users[] = $entry; }
foreach ($students as $i => $entry) { unset($entry['user']); $users[] = $entry + $courses[$i % count($courses)]; }
usort($users, fn ($a, $b) => $a['vu'] <=> $b['vu']);
file_put_contents($root.'/.tools/k6/credentials.json', json_encode($users, JSON_PRETTY_PRINT));
echo "Prepared 50 unique users, 5 courses, 225 memberships and 1125 submissions. Tokens saved privately.\n";
