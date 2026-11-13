<?php

namespace App\Http\Controllers\Lms;

use App\Http\Controllers\Controller;
use App\Jobs\Lms\GenerateQuiz;
use App\Models\{Schedule, Student, Teacher};
use App\Services\Member4\{StudentAccess, ParentScheduleReader};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage, Validator};
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LmsController extends Controller
{
    private function ok(mixed $data = null, int $status = 200)
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }

    private function teacher(Request $r): bool { return $r->user()->role->name === 'guru'; }

    private function learner(Request $r): int
    {
        if ($r->user()->role->name === 'murid') return $r->user()->id;
        abort_unless($r->user()->role->name === 'wali_murid', 403);
        $r->validate(['student_id' => ['required', 'integer']]);
        $student = app(StudentAccess::class)->students($r->user())->findOrFail($r->integer('student_id'));
        abort_unless($student->user_id, 404);
        return $student->user_id;
    }

    private function course(Request $r, int $id, bool $write = false): object
    {
        $course = DB::table('lms_courses')->find($id);
        abort_unless($course, 404);
        if ($this->teacher($r)) abort_unless($course->teacher_id === $r->user()->id, 403);
        else {
            abort_if($write, 403);
            abort_unless(DB::table('lms_members')->where('course_id', $id)->where('user_id', $this->learner($r))->exists(), 403);
        }
        return $course;
    }

    private function material(Request $r, int $id, bool $write = false): object
    {
        $m = DB::table('lms_materials')->find($id); abort_unless($m, 404);
        $this->course($r, $m->course_id, $write);
        abort_unless($this->teacher($r) || $m->visibility === 'public', 404);
        return $m;
    }

    private function insert(string $table, array $data): int
    {
        return DB::table($table)->insertGetId($data + ['created_at' => now(), 'updated_at' => now()]);
    }

    public function index(Request $r)
    {
        $q = DB::table('lms_courses');
        if ($this->teacher($r)) $q->where('teacher_id', $r->user()->id);
        else $q->whereIn('id', DB::table('lms_members')->where('user_id', $this->learner($r))->select('course_id'));
        return $this->ok($q->orderByDesc('id')->get());
    }

    public function create(Request $r)
    {
        abort_unless($this->teacher($r), 403);
        $data = $r->validate(['name' => 'required|string|max:255', 'description' => 'nullable|string|max:5000']);
        $id = $this->insert('lms_courses', $data + ['teacher_id' => $r->user()->id, 'code' => Str::upper(Str::random(10))]);
        return $this->ok(DB::table('lms_courses')->find($id), 201);
    }

    public function update(Request $r, int $course)
    {
        $this->course($r, $course, true);
        $data = $r->validate(['name' => 'required|string|max:255', 'description' => 'nullable|string|max:5000']);
        DB::table('lms_courses')->where('id', $course)->update($data + ['updated_at' => now()]);
        return $this->ok(DB::table('lms_courses')->find($course));
    }

    public function join(Request $r)
    {
        abort_unless($r->user()->role->name === 'murid', 403);
        $r->validate(['code' => 'required|string|max:12']);
        $course = DB::table('lms_courses')->where('code', strtoupper(trim($r->string('code'))))->first();
        abort_unless($course, 422, 'Kode course tidak ditemukan.');
        DB::table('lms_members')->insertOrIgnore(['course_id' => $course->id, 'user_id' => $r->user()->id, 'created_at' => now(), 'updated_at' => now()]);
        return $this->ok($course);
    }

    public function show(Request $r, int $course)
    {
        $info = $this->course($r, $course);
        $teacher = $this->teacher($r); $learner = $teacher ? null : $this->learner($r);
        $materials = DB::table('lms_materials')->where('course_id', $course)->when(! $teacher, fn ($q) => $q->where('visibility', 'public'))->get(['id', 'name', 'visibility', 'created_at']);
        $publicIds = DB::table('lms_materials')->where('course_id', $course)->where('visibility', 'public')->pluck('id');
        $members = DB::table('lms_members')->join('users', 'users.id', '=', 'lms_members.user_id')->where('course_id', $course)->when(! $teacher, fn ($q) => $q->where('user_id', $learner))->get(['users.id', 'users.name']);
        $assignments = DB::table('lms_assignments')->where('course_id', $course)->when(! $teacher, fn ($q) => $q->whereIn('status', ['published', 'closed']))->orderBy('due_at')->get();
        $submissions = DB::table('lms_submissions')->whereIn('assignment_id', $assignments->pluck('id'))->when(! $teacher, fn ($q) => $q->where('user_id', $learner))->get();
        $attendance = DB::table('lms_attendance')->where('course_id', $course)->when(! $teacher, fn ($q) => $q->where('user_id', $learner))->orderByDesc('meeting_date')->get();
        $drafts = DB::table('lms_ai_drafts')->whereIn('material_id', DB::table('lms_materials')->where('course_id', $course)->select('id'))->when(! $teacher, fn ($q) => $q->whereIn('status', ['published', 'closed']))->orderByDesc('id')->get(['id', 'material_id', 'model', 'question_count', 'status', 'deadline', 'error']);
        $results = DB::table('lms_quiz_results')->whereIn('draft_id', $drafts->pluck('id'))->when(! $teacher, fn ($q) => $q->where('user_id', $learner))->get();
        $progress = $members->map(function ($member) use ($publicIds, $submissions, $attendance, $results) {
            $read = DB::table('lms_reads')->whereIn('material_id', $publicIds)->where('user_id', $member->id)->count();
            $scores = $submissions->where('user_id', $member->id)->whereNotNull('grade')->pluck('grade')->merge($results->where('user_id', $member->id)->pluck('grade'));
            return ['user_id' => $member->id, 'name' => $member->name, 'read' => $read, 'total' => $publicIds->count(), 'percentage' => $publicIds->count() ? round(100 * $read / $publicIds->count()) : 0, 'submitted' => $submissions->where('user_id', $member->id)->count(), 'present' => $attendance->where('user_id', $member->id)->where('status', 'hadir')->count(), 'average_grade' => $scores->isEmpty() ? null : round($scores->avg(), 2)];
        });
        $reads = DB::table('lms_reads')->whereIn('material_id', $materials->pluck('id'))->when(! $teacher, fn ($q) => $q->where('user_id', $learner))->get();
        return $this->ok(compact('info', 'materials', 'members', 'assignments', 'submissions', 'attendance', 'drafts', 'results', 'progress', 'reads') + ['announcements' => DB::table('lms_announcements')->where('course_id', $course)->orderByDesc('id')->get()]);
    }

    public function upload(Request $r, int $course)
    {
        $this->course($r, $course, true);
        $r->validate(['file' => 'required|file|mimes:pdf|max:10240', 'visibility' => 'required|in:public,private']);
        $file = $r->file('file');
        abort_unless(str_starts_with(file_get_contents($file->getRealPath(), false, null, 0, 5), '%PDF-'), 422, 'Dokumen PDF tidak valid.');
        $path = $file->store('lms/materials', 'local');
        try { $id = $this->insert('lms_materials', ['course_id' => $course, 'name' => mb_substr(basename($file->getClientOriginalName()), 0, 255), 'path' => $path, 'visibility' => $r->input('visibility')]); }
        catch (\Throwable $e) { Storage::disk('local')->delete($path); throw $e; }
        return $this->ok(['id' => $id], 201);
    }

    public function download(Request $r, int $material)
    {
        $m = $this->material($r, $material);
        return Storage::disk('local')->download($m->path, $m->name, ['Content-Type' => 'application/pdf', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function visibility(Request $r, int $material)
    {
        $this->material($r, $material, true); $data = $r->validate(['visibility' => 'required|in:public,private']);
        DB::table('lms_materials')->where('id', $material)->update($data + ['updated_at' => now()]); return $this->ok();
    }

    public function read(Request $r, int $material)
    {
        abort_unless($r->user()->role->name === 'murid', 403); $this->material($r, $material);
        DB::table('lms_reads')->insertOrIgnore(['material_id' => $material, 'user_id' => $r->user()->id, 'read_at' => now()]); return $this->ok();
    }

    public function assignment(Request $r, int $course)
    {
        $this->course($r, $course, true);
        $data = $r->validate(['title' => 'required|string|max:255', 'instructions' => 'required|string|max:20000', 'due_at' => 'required|date|after:now']);
        $data['due_at'] = \Carbon\Carbon::parse($data['due_at'])->utc()->format('Y-m-d H:i:s');
        return $this->ok(['id' => $this->insert('lms_assignments', $data + ['course_id' => $course])], 201);
    }

    public function submit(Request $r, int $assignment)
    {
        abort_unless($r->user()->role->name === 'murid', 403);
        $a = DB::table('lms_assignments')->find($assignment); abort_unless($a, 404); $this->course($r, $a->course_id);
        $data = $r->validate(['answer' => 'nullable|required_without:file|string|max:50000', 'file' => 'nullable|required_without:answer|file|mimes:pdf,doc,docx,txt,zip|max:10240']);
        DB::transaction(function () use ($r, $a, $assignment, $data) {
            $live = DB::table('lms_assignments')->where('id', $assignment)->lockForUpdate()->first();
            abort_if($live->status !== 'published' || now()->gt($a->due_at), 422, 'Tugas belum diterbitkan atau sudah ditutup.');
            $existing = DB::table('lms_submissions')->where('assignment_id', $assignment)->where('user_id', $r->user()->id)->first();
            abort_if($existing && $existing->grade !== null, 422, 'Tugas sudah dinilai.');
            unset($data['file']);
            $newPath = null;
            if ($r->hasFile('file')) {
                $newPath = $r->file('file')->store('lms/submissions', 'local');
                $data['file_path'] = $newPath;
                $data['file_name'] = mb_substr(basename($r->file('file')->getClientOriginalName()), 0, 255);
            }
            try { DB::table('lms_submissions')->updateOrInsert(['assignment_id' => $assignment, 'user_id' => $r->user()->id], $data + ['created_at' => $existing?->created_at ?? now(), 'updated_at' => now()]); }
            catch (\Throwable $e) { if ($newPath) Storage::disk('local')->delete($newPath); throw $e; }
            if ($newPath && $existing?->file_path) DB::afterCommit(fn () => Storage::disk('local')->delete($existing->file_path));
        }); return $this->ok();
    }

    public function assignmentStatus(Request $r, int $assignment)
    {
        $a = DB::table('lms_assignments')->find($assignment); abort_unless($a, 404);
        $this->course($r, $a->course_id, true);
        $data = $r->validate(['status' => 'required|in:published,closed']);
        abort_unless(($a->status === 'draft' && $data['status'] === 'published' && now()->lt($a->due_at)) || ($a->status === 'published' && $data['status'] === 'closed'), 422);
        DB::table('lms_assignments')->where('id', $assignment)->update($data + ['updated_at' => now()]); return $this->ok();
    }

    public function submissionDownload(Request $r, int $submission)
    {
        $s = DB::table('lms_submissions')->find($submission); abort_unless($s && $s->file_path, 404);
        $a = DB::table('lms_assignments')->find($s->assignment_id); $this->course($r, $a->course_id);
        abort_unless($this->teacher($r) || $this->learner($r) === $s->user_id, 403);
        return Storage::disk('local')->download($s->file_path, $s->file_name, ['X-Content-Type-Options' => 'nosniff']);
    }

    public function grade(Request $r, int $submission)
    {
        $s = DB::table('lms_submissions')->find($submission); abort_unless($s, 404);
        $a = DB::table('lms_assignments')->find($s->assignment_id); $this->course($r, $a->course_id, true);
        $data = $r->validate(['grade' => 'required|numeric|between:0,100', 'feedback' => 'nullable|string|max:10000']);
        DB::table('lms_submissions')->where('id', $submission)->update($data + ['updated_at' => now()]); return $this->ok();
    }

    public function attendance(Request $r, int $course)
    {
        $this->course($r, $course, true);
        $data = $r->validate(['meeting_date' => 'required|date_format:Y-m-d|before_or_equal:today', 'records' => 'required|array|min:1|max:500', 'records.*.user_id' => 'required|integer|distinct', 'records.*.status' => 'required|in:hadir,izin,sakit,alpa']);
        DB::transaction(function () use ($data, $course) {
            foreach ($data['records'] as $record) {
                abort_unless(DB::table('lms_members')->where('course_id', $course)->where('user_id', $record['user_id'])->exists(), 422, 'Murid bukan anggota course.');
                DB::table('lms_attendance')->updateOrInsert(['course_id' => $course, 'user_id' => $record['user_id'], 'meeting_date' => $data['meeting_date']], ['status' => $record['status'], 'created_at' => now(), 'updated_at' => now()]);
            }
        }); return $this->ok();
    }

    public function announce(Request $r, int $course)
    {
        $this->course($r, $course, true); $data = $r->validate(['title' => 'required|string|max:255', 'content' => 'required|string|max:10000']);
        return $this->ok(['id' => $this->insert('lms_announcements', $data + ['course_id' => $course])], 201);
    }

    public function schedules(Request $r)
    {
        $q = Schedule::with(['subject:id,name', 'classroom:id,name', 'room:id,name', 'teacher:id,name'])->where('status', 'active');
        if ($this->teacher($r)) $q->whereIn('teacher_id', Teacher::where('user_id', $r->user()->id)->select('id'));
        else {
            $student = Student::where('user_id', $this->learner($r))->first();
            $q = app(ParentScheduleReader::class)->forStudent($student?->id ?? 0)->with(['subject:id,name', 'classroom:id,name', 'room:id,name', 'teacher:id,name']);
        }
        return $this->ok($q->orderBy('day')->orderBy('start_time')->get());
    }

    public function models(Request $r)
    {
        abort_unless($this->teacher($r), 403);
        return $this->ok(['default' => config('lms.default_model'), 'models' => array_values(array_unique([config('lms.default_model'), ...config('lms.models')]))]);
    }

    public function generate(Request $r, int $material)
    {
        $this->material($r, $material, true);
        $data = $r->validate(['question_count' => 'required|integer|between:1,50', 'model' => ['sometimes', 'string', Rule::in(array_unique([config('lms.default_model'), ...config('lms.models')]))]]);
        $id = DB::transaction(function () use ($r, $material, $data) {
            $id = $this->insert('lms_ai_drafts', ['material_id' => $material, 'requested_by' => $r->user()->id, 'model' => $data['model'] ?? config('lms.default_model'), 'question_count' => $data['question_count']]);
            GenerateQuiz::dispatch($id)->onConnection('lms')->onQueue('lms-ai'); return $id;
        }); return $this->ok(['id' => $id, 'status' => 'queued'], 202);
    }

    private function getDraft(Request $r, int $id, bool $write = false): object
    {
        $d = DB::table('lms_ai_drafts')->find($id); abort_unless($d, 404);
        $m = DB::table('lms_materials')->find($d->material_id); $this->course($r, $m->course_id, $write);
        abort_unless($this->teacher($r) || in_array($d->status, ['published', 'closed']), 404);
        $d->draft = $d->draft ? json_decode($d->draft, true) : null; return $d;
    }

    public function draft(Request $r, int $draft)
    {
        $d = $this->getDraft($r, $draft);
        if (! $this->teacher($r) && $d->draft) foreach ($d->draft['questions'] as &$question) { unset($question['correct_index'], $question['explanation']); }
        return $this->ok($d);
    }

    public function saveDraft(Request $r, int $draft)
    {
        $d = $this->getDraft($r, $draft, true); abort_unless($d->status === 'draft', 422);
        $data = $r->validate(['draft' => 'required|array', 'draft.title' => 'required|string|max:255', 'draft.questions' => 'required|array|size:'.$d->question_count, 'draft.questions.*.question' => 'required|string|max:5000', 'draft.questions.*.options' => 'required|array|size:4', 'draft.questions.*.options.*' => 'required|string|max:2000', 'draft.questions.*.correct_index' => 'required|integer|between:0,3', 'draft.questions.*.explanation' => 'required|string|max:5000', 'reviewed' => 'required|boolean']);
        $clean = ['title' => $data['draft']['title'], 'questions' => array_map(fn ($q) => array_intersect_key($q, array_flip(['question', 'options', 'correct_index', 'explanation'])), $data['draft']['questions'])];
        DB::transaction(function () use ($draft, $clean, $data) {
            $live = DB::table('lms_ai_drafts')->where('id', $draft)->lockForUpdate()->first();
            abort_unless($live->status === 'draft', 422);
            DB::table('lms_ai_drafts')->where('id', $draft)->update(['draft' => json_encode($clean), 'reviewed_at' => $data['reviewed'] ? now() : null, 'updated_at' => now()]);
        }); return $this->ok();
    }

    public function publish(Request $r, int $draft)
    {
        $this->getDraft($r, $draft, true); $r->validate(['deadline' => 'required|date|after:now']);
        DB::transaction(function () use ($r, $draft) {
            $d = DB::table('lms_ai_drafts')->where('id', $draft)->lockForUpdate()->first();
            abort_unless($d->status === 'draft' && $d->reviewed_at, 422, 'Tinjau dan simpan semua soal sebelum publikasi.');
            DB::table('lms_ai_drafts')->where('id', $draft)->update(['status' => 'published', 'deadline' => \Carbon\Carbon::parse($r->input('deadline'))->utc()->format('Y-m-d H:i:s'), 'updated_at' => now()]);
        }); return $this->ok();
    }

    public function close(Request $r, int $draft)
    {
        $d = $this->getDraft($r, $draft, true); abort_unless($d->status === 'published', 422);
        DB::table('lms_ai_drafts')->where('id', $draft)->update(['status' => 'closed', 'updated_at' => now()]); return $this->ok();
    }

    public function answers(Request $r, int $draft)
    {
        abort_unless($r->user()->role->name === 'murid', 403); $d = $this->getDraft($r, $draft);
        $data = $r->validate(['answers' => 'required|array|list|size:'.$d->question_count, 'answers.*' => 'required|integer|between:0,3']);
        return DB::transaction(function () use ($r, $draft, $d, $data) {
            $live = DB::table('lms_ai_drafts')->where('id', $draft)->lockForUpdate()->first();
            abort_unless($live->status === 'published' && now()->lte($live->deadline), 422, 'Kuis sudah ditutup.');
            abort_if(DB::table('lms_quiz_results')->where('draft_id', $draft)->where('user_id', $r->user()->id)->exists(), 422, 'Kuis sudah dikumpulkan.');
            $correct = 0; foreach ($d->draft['questions'] as $i => $q) if ((int) $data['answers'][$i] === (int) $q['correct_index']) $correct++;
            $grade = round(100 * $correct / $d->question_count, 2);
            $this->insert('lms_quiz_results', ['draft_id' => $draft, 'user_id' => $r->user()->id, 'answers' => json_encode($data['answers']), 'grade' => $grade]);
            return $this->ok(['grade' => $grade]);
        });
    }
}
