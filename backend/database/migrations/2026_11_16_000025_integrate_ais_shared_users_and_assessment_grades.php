<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('role', 30)->nullable()->index()->after('password');
            });
        } elseif (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NULL');
        }

        if (DB::table('users')->exists() && Schema::hasTable('roles')) {
            $now = now();
            $roles = [
                ['name' => 'admin', 'display_name' => 'Admin', 'description' => 'Administrator Core Academic Information System.'],
                ['name' => 'guru', 'display_name' => 'Guru', 'description' => 'Guru pengampu pembelajaran (modul LMS).'],
                ['name' => 'murid', 'display_name' => 'Murid', 'description' => 'Siswa/murid terdaftar.'],
                ['name' => 'wali_murid', 'display_name' => 'Wali Murid', 'description' => 'Orang tua/wali murid (modul Parent Portal).'],
            ];

            foreach ($roles as $role) {
                if (! DB::table('roles')->where('name', $role['name'])->exists()) {
                    DB::table('roles')->insert($role + ['created_at' => $now, 'updated_at' => $now]);
                }
            }
        }

        $roleRows = Schema::hasTable('roles') ? DB::table('roles')->pluck('id', 'name') : collect();
        $aisToAssess = ['admin' => 'admin', 'guru' => 'teacher', 'murid' => 'student', 'wali_murid' => 'parent'];
        $assessToAis = array_flip($aisToAssess);

        DB::table('users')->orderBy('id')->chunkById(200, function ($users) use ($roleRows, $aisToAssess, $assessToAis): void {
            foreach ($users as $user) {
                $updates = [];

                if ($user->role_id === null && ! empty($user->role) && isset($assessToAis[$user->role])) {
                    $aisName = $assessToAis[$user->role];
                    if (isset($roleRows[$aisName])) {
                        $updates['role_id'] = $roleRows[$aisName];
                    }
                } elseif ($user->role_id !== null && empty($user->role)) {
                    $aisName = $roleRows->search($user->role_id);
                    if (is_string($aisName) && isset($aisToAssess[$aisName])) {
                        $updates['role'] = $aisToAssess[$aisName];
                    }
                }

                if (empty($user->status)) {
                    $updates['status'] = 'active';
                }

                if ($updates !== []) {
                    DB::table('users')->where('id', $user->id)->update($updates);
                }
            }
        });

        if (! Schema::hasTable('ais_assessment_grades')) {
            Schema::create('ais_assessment_grades', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('classroom_id')->nullable()->constrained('classrooms')->nullOnDelete();
                $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
                $table->unsignedBigInteger('assessment_class_id')->nullable()->index();
                $table->string('source_type', 20)->default('quiz');
                $table->unsignedBigInteger('source_quiz_id')->index();
                $table->string('title');
                $table->string('assessment_type', 30)->default('quiz');
                $table->decimal('score', 6, 2);
                $table->decimal('max_score', 6, 2)->default(100.00);
                $table->text('teacher_feedback')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('graded_at')->nullable();
                $table->timestamp('released_at')->nullable();
                $table->timestamps();

                $table->unique(['student_id', 'source_quiz_id'], 'ais_assessment_grades_student_quiz_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ais_assessment_grades');
    }
};
