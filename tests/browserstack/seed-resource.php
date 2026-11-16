<?php
$root = dirname(__DIR__, 2);
$expected = str_replace('\\', '/', $root.'/.tools/k6/k6-lms.sqlite');
if (getenv('DB_CONNECTION') !== 'sqlite' || str_replace('\\', '/', getenv('DB_DATABASE') ?: '') !== $expected) {
    throw new RuntimeException('Resource fixtures require the disposable k6 database.');
}
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (str_replace('\\', '/', config('database.connections.sqlite.database')) !== $expected) throw new RuntimeException('Database is not isolated.');
$password = bin2hex(random_bytes(18));
$user = App\Models\User::updateOrCreate(['email' => 'resource-teacher@local-test.invalid'], [
    'name' => 'Resource Test Teacher', 'password' => $password,
    'role_id' => App\Models\Role::where('name', 'guru')->value('id'), 'status' => 'active',
]);
Illuminate\Support\Facades\DB::table('lms_courses')->updateOrInsert(
    ['teacher_id' => $user->id, 'code' => 'BSRESOURCE'],
    ['name' => 'Browser resource compatibility', 'description' => 'Disposable fixture', 'created_at' => now(), 'updated_at' => now()]
);
file_put_contents($root.'/.tools/browserstack/resource-users.json', json_encode([
    'teacher' => ['email' => $user->email, 'password' => $password],
]));
echo "Prepared isolated resource-test teacher.\n";
