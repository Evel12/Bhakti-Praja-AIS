<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DomainMigrationTest extends TestCase
{
    use DatabaseMigrations;

    public function test_domain_migrations_can_be_rolled_back_and_reapplied_without_removing_auth(): void
    {
        $tables = ['classes', 'class_members', 'modules', 'quizzes', 'questions', 'options', 'attempts', 'attempt_answers', 'quiz_generations'];
        $this->seed();
        $this->artisan('migrate:rollback', ['--step' => 10, '--force' => true])->assertSuccessful();

        foreach ($tables as $table) {
            $this->assertFalse(Schema::hasTable($table));
        }
        $this->assertTrue(Schema::hasTable('users'));
        $this->assertTrue(Schema::hasTable('personal_access_tokens'));
        $this->assertDatabaseCount('users', 4);

        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->seed();
        foreach ($tables as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
        $this->assertDatabaseCount('users', 4);
        $this->assertDatabaseCount('questions', 5);
        $this->assertDatabaseCount('options', 20);
    }
}
