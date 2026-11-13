<?php

namespace App\Jobs\Lms;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\{DB, Http, Storage, Validator};
use Throwable;

class GenerateQuiz implements ShouldQueue
{
    use Queueable;
    public int $tries = 1;
    public int $timeout = 150;
    public bool $failOnTimeout = true;
    public function __construct(public int $draftId) {}

    public function handle(): void
    {
        $d = DB::table('lms_ai_drafts')->find($this->draftId);
        if (! $d || $d->status !== 'queued') return;
        if (! DB::table('lms_ai_drafts')->where('id', $d->id)->where('status', 'queued')->update(['status' => 'processing', 'updated_at' => now()])) return;
        $stream = null;
        try {
            $m = DB::table('lms_materials')->find($d->material_id);
            $owner = DB::table('lms_courses')->find($m->course_id);
            $user = \App\Models\User::find($d->requested_by);
            if ($owner->teacher_id !== $d->requested_by || ! $user?->isActive() || $user->role?->name !== 'guru') throw new \RuntimeException;
            if (! config('lms.ai_key')) throw new \RuntimeException;
            $stream = Storage::disk('local')->readStream($m->path);
            $response = Http::withToken(config('lms.ai_key'))->acceptJson()->timeout(120)->connectTimeout(5)
                ->withOptions(['allow_redirects' => false])
                ->attach('file', $stream, 'material.pdf')
                ->post(rtrim(config('lms.ai_url'), '/').'/generate-quiz', ['question_count' => $d->question_count, 'model' => $d->model]);
            $response->throw();
            $draft = $response->json();
            Validator::make($draft ?? [], [
                'title' => 'required|string|max:255', 'questions' => 'required|array|size:'.$d->question_count,
                'questions.*.question' => 'required|string|max:5000', 'questions.*.options' => 'required|array|size:4',
                'questions.*.options.*' => 'required|string|max:2000', 'questions.*.correct_index' => 'required|integer|between:0,3',
                'questions.*.explanation' => 'required|string|max:5000',
            ])->validate();
            $clean = ['title' => $draft['title'], 'questions' => array_map(fn ($q) => array_intersect_key($q, array_flip(['question', 'options', 'correct_index', 'explanation'])), $draft['questions'])];
            DB::table('lms_ai_drafts')->where('id', $d->id)->where('status', 'processing')->update(['status' => 'draft', 'draft' => json_encode($clean), 'error' => null, 'reviewed_at' => null, 'updated_at' => now()]);
        } catch (Throwable) {
            $this->failed(null);
        } finally { if (is_resource($stream)) fclose($stream); }
    }

    public function failed(?Throwable $exception): void
    {
        DB::table('lms_ai_drafts')->where('id', $this->draftId)->whereIn('status', ['queued', 'processing'])->update(['status' => 'failed', 'error' => 'Pembuatan soal gagal. Periksa layanan AI dan model, lalu coba kembali.', 'updated_at' => now()]);
    }
}
