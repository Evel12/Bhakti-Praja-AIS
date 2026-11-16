<?php

$root = dirname(__DIR__, 2);
$expected = str_replace('\\', '/', $root.'/.tools/k6/k6-lms.sqlite');
if (getenv('DB_CONNECTION') !== 'sqlite' || str_replace('\\', '/', getenv('DB_DATABASE') ?: '') !== $expected) {
    throw new RuntimeException('BrowserStack fixtures require the disposable k6 database.');
}
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (str_replace('\\', '/', config('database.connections.sqlite.database')) !== $expected) throw new RuntimeException('The selected database is not isolated.');

use App\Models\{Guardian, Role, Student, User};

$accounts = [];
foreach (['teacher' => 'guru', 'student' => 'murid', 'parent' => 'wali_murid'] as $name => $role) {
    $password = bin2hex(random_bytes(18));
    $user = User::updateOrCreate(['email' => "browserstack-$name@local-test.invalid"], ['name' => 'BrowserStack '.ucfirst($name), 'password' => $password, 'role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    $accounts[$name] = ['id' => $user->id, 'email' => $user->email, 'password' => $password];
}
$student = Student::updateOrCreate(['user_id' => $accounts['student']['id']], ['name' => 'BrowserStack Student', 'student_number' => 'BS-LOCAL-001', 'status' => 'active']);
$guardian = Guardian::updateOrCreate(['user_id' => $accounts['parent']['id']], ['name' => 'BrowserStack Parent', 'status' => 'active']);
$guardian->students()->syncWithoutDetaching([$student->id => ['relationship' => 'wali']]);
// A stable course makes the read-only device smoke independent of earlier runs.
Illuminate\Support\Facades\DB::table('lms_courses')->updateOrInsert(
    ['teacher_id' => $accounts['teacher']['id'], 'code' => 'BSMATRIX01'],
    ['name' => 'BrowserStack compatibility fixture', 'description' => 'Disposable device-test course', 'created_at' => now(), 'updated_at' => now()]
);
file_put_contents($root.'/.tools/browserstack/app-users.json', json_encode($accounts, JSON_PRETTY_PRINT));
echo "Prepared isolated teacher, student, and linked-parent browser accounts.\n";
