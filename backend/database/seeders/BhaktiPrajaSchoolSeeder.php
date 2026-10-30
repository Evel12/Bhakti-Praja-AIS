<?php

namespace Database\Seeders;

use App\Models\Curriculum;
use App\Models\Department;
use App\Models\StudyProgram;
use App\Models\Subject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BhaktiPrajaSchoolSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $common = [];
            foreach (config('school_subjects.common') as $code => $name) {
                $common[] = $this->subject($code, $name)->id;
            }
            foreach (config('school.programs') as $program) {
                $department = Department::firstOrCreate(['code' => $program['code']], ['name' => $program['name'], 'status' => 'active']);
                if ($department->name !== $program['name']) throw new \RuntimeException('Kode program sekolah sudah dipakai: '.$program['code']);
                [$foundationCode, $foundationName] = config('school_subjects.foundations.'.$program['code']);
                $foundation = $this->subject($foundationCode, $foundationName);
                foreach ($program['concentrations'] as $concentration) {
                    $study = StudyProgram::firstOrCreate(['code' => $concentration['code']], [
                        'department_id' => $department->id, 'name' => $concentration['name'], 'status' => 'active',
                    ]);
                    if ($study->department_id !== $department->id || $study->name !== $concentration['name']) {
                        throw new \RuntimeException('Kode konsentrasi sekolah sudah dipakai: '.$concentration['code']);
                    }
                    $specialism = $this->subject($concentration['code'].'-MAPEL', $concentration['name'], $study->id);
                    $curriculum = Curriculum::firstOrCreate([
                        'study_program_id' => $study->id, 'name' => 'Referensi Kurikulum Merdeka - '.$concentration['name'], 'year' => 'Referensi',
                    ], [
                        'is_active' => false,
                        'source_url' => config('school.sources.2.url'),
                        'notes' => 'Draf rujukan nasional; bukan KOSP sekolah yang telah disahkan. Belum mencakup agama sesuai peserta didik, pilihan seni, muatan lokal, mata pelajaran pilihan, pembagian fase/semester, atau alokasi JP sekolah. '.config('school.curriculum_note'),
                    ]);
                    // Re-running setup preserves administrator edits and approvals.
                    if ($curriculum->wasRecentlyCreated) {
                        $curriculum->subjects()->sync([...$common, $foundation->id, $specialism->id]);
                    }
                }
            }
        });
    }

    private function subject(string $code, string $name, ?int $studyProgramId = null): Subject
    {
        $subject = Subject::firstOrCreate(['code' => $code], [
            'name' => $name, 'study_program_id' => $studyProgramId, 'credit_hours' => null, 'status' => 'inactive',
        ]);
        if ($subject->name !== $name || $subject->study_program_id !== $studyProgramId) {
            throw new \RuntimeException('Kode mata pelajaran sekolah sudah dipakai: '.$code);
        }
        return $subject;
    }
}
