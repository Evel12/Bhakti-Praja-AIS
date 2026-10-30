<?php

namespace App\Http\Controllers;

use App\Models\AcademicRegistration;
use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\ClassStudent;
use App\Models\Department;
use App\Models\Guardian;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudyProgram;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $stats = [
            ['resource' => 'students', 'label' => 'Total Siswa', 'value' => Student::count()],
            ['resource' => 'teachers', 'label' => 'Total Guru', 'value' => Teacher::count()],
            ['resource' => 'parents', 'label' => 'Total Wali Murid', 'value' => Guardian::count()],
            ['resource' => 'classrooms', 'label' => 'Total Kelas', 'value' => Classroom::count()],
            ['resource' => 'subjects', 'label' => 'Total Mata Pelajaran', 'value' => Subject::count()],
            ['resource' => 'departments', 'label' => 'Program Keahlian', 'value' => Department::count()],
            ['resource' => 'academic-registrations', 'label' => 'Total Registrasi', 'value' => AcademicRegistration::count()],
        ];

        $activeYear = AcademicYear::where('is_active', true)->orderByDesc('id')->first();
        $activeSemester = Semester::where('is_active', true)->with('academicYear')->orderByDesc('id')->first();

        $registrationsByStatus = AcademicRegistration::selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $studentsByStatus = Student::selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $classroomsPerLevel = Classroom::selectRaw('level, COUNT(*) as total')
            ->groupBy('level')
            ->orderBy('level')
            ->get();

        $schedulesPerDay = Schedule::selectRaw('day, COUNT(*) as total')
            ->where('status', 'active')
            ->groupBy('day')
            ->pluck('total', 'day');

        $activeAssignments = ClassStudent::where('status', 'active')->count();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'active_academic_year' => $activeYear,
                'active_semester' => $activeSemester,
                'summary' => [
                    'study_programs' => StudyProgram::count(),
                    'active_class_assignments' => $activeAssignments,
                    'active_schedules' => Schedule::where('status', 'active')->count(),
                    'registrations_by_status' => $registrationsByStatus,
                    'students_by_status' => $studentsByStatus,
                    'classrooms_per_level' => $classroomsPerLevel,
                    'schedules_per_day' => $schedulesPerDay,
                ],
            ],
        ]);
    }
}
