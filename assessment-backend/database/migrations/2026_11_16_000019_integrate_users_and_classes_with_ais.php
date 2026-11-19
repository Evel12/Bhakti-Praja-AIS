<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql' && Schema::hasColumn('users', 'role')) {
            DB::statement('ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NULL');

            $aisToAssess = ['admin' => 'admin', 'guru' => 'teacher', 'murid' => 'student', 'wali_murid' => 'parent'];
            if (Schema::hasTable('roles') && Schema::hasColumn('users', 'role_id')) {
                $roleNames = DB::table('roles')->pluck('name', 'id');
                foreach (DB::table('users')->where(fn ($q) => $q->whereNull('role')->orWhere('role', ''))->get(['id', 'role_id']) as $u) {
                    $mapped = $aisToAssess[$roleNames[$u->role_id] ?? ''] ?? 'student';
                    DB::table('users')->where('id', $u->id)->update(['role' => $mapped]);
                }
            }
            DB::table('users')->where(fn ($q) => $q->whereNull('role')->orWhere('role', ''))->update(['role' => 'student']);

            $cases = implode("','", array_map(
                static fn (Role $case): string => $case->value,
                Role::cases(),
            ));

            DB::statement(
                "ALTER TABLE users MODIFY COLUMN role ENUM('{$cases}') NOT NULL DEFAULT 'student'"
            );
        }

        if (! Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('status', 20)->default('active')->index()->after('role');
            });
        }

        Schema::table('classes', function (Blueprint $table): void {
            if (! Schema::hasColumn('classes', 'ais_teaching_load_id')) {
                $table->unsignedBigInteger('ais_teaching_load_id')->nullable()->unique()->after('description');
            }
            if (! Schema::hasColumn('classes', 'ais_classroom_id')) {
                $table->unsignedBigInteger('ais_classroom_id')->nullable()->index()->after('ais_teaching_load_id');
            }
            if (! Schema::hasColumn('classes', 'ais_subject_id')) {
                $table->unsignedBigInteger('ais_subject_id')->nullable()->index()->after('ais_classroom_id');
            }
            if (! Schema::hasColumn('classes', 'sync_source')) {
                $table->string('sync_source', 20)->default('manual')->index()->after('ais_subject_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table): void {
            if (Schema::hasColumn('classes', 'sync_source')) {
                $table->dropIndex(['sync_source']);
            }
            if (Schema::hasColumn('classes', 'ais_subject_id')) {
                $table->dropIndex(['ais_subject_id']);
            }
            if (Schema::hasColumn('classes', 'ais_classroom_id')) {
                $table->dropIndex(['ais_classroom_id']);
            }
            if (Schema::hasColumn('classes', 'ais_teaching_load_id')) {
                $table->dropUnique(['ais_teaching_load_id']);
            }

            $dropCols = [];
            foreach (['sync_source', 'ais_subject_id', 'ais_classroom_id', 'ais_teaching_load_id'] as $col) {
                if (Schema::hasColumn('classes', $col)) {
                    $dropCols[] = $col;
                }
            }
            if ($dropCols !== []) {
                $table->dropColumn($dropCols);
            }
        });

        if (Schema::hasColumn('users', 'status') && ! Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            });
        }
    }
};
