<?php
// This fixture is only allowed in the existing disposable test database.
$root = dirname(__DIR__, 2);
$expected = str_replace('\\', '/', $root.'/.tools/k6/k6-lms.sqlite');
if (getenv('DB_CONNECTION') !== 'sqlite' || str_replace('\\', '/', getenv('DB_DATABASE') ?: '') !== $expected) throw new RuntimeException('Select the isolated test database.');
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (str_replace('\\', '/', config('database.connections.sqlite.database')) !== $expected) throw new RuntimeException('Database is not isolated.');
use App\Models\{User, Role, Student, Guardian, Department, StudyProgram, AcademicYear, Semester, Teacher, Room, Classroom, Subject, Schedule, ClassStudent, AcademicRegistration, Invoice, Payment};
use Illuminate\Support\Facades\{DB, Storage};
function account($name, $role) {
    $password = bin2hex(random_bytes(16));
    $user = User::updateOrCreate(['email' => "$name@core-finance-test.invalid"], ['name' => 'Synthetic '.$name, 'password' => $password, 'role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    $user->tokens()->delete();
    return ['id' => $user->id, 'email' => $user->email, 'password' => $password, 'role' => $role, 'token' => $user->createToken('isolated-core-finance')->plainTextToken];
}
$core = [];
for ($i = 0; $i < 50; $i++) $core[] = account("core-load-$i", 'admin');
$browser = ['ais' => account('browser-ais', 'admin'), 'admin' => account('browser-finance', 'admin'), 'student' => account('browser-student', 'murid'), 'parent' => account('browser-parent', 'wali_murid')];
$department = Department::updateOrCreate(['code'=>'CFDEP'],['name'=>'Synthetic Core Finance Department','status'=>'active']);
$program = StudyProgram::updateOrCreate(['code'=>'CFPROG'],['department_id'=>$department->id,'name'=>'Synthetic Core Finance Program','status'=>'active']);
$year = AcademicYear::updateOrCreate(['name'=>'2026/2027 CF'],['start_date'=>'2026-07-01','end_date'=>'2027-06-30','is_active'=>true]);
$semester = Semester::updateOrCreate(['name'=>'Synthetic Ganjil CF','academic_year_id'=>$year->id],['period'=>'ganjil','start_date'=>'2026-07-01','end_date'=>'2026-12-31','is_active'=>true]);
$teacher = Teacher::updateOrCreate(['teacher_number'=>'CFTEACH'],['name'=>'Synthetic CF Teacher','status'=>'active']);
$room = Room::updateOrCreate(['code'=>'CFROOM'],['name'=>'Synthetic CF Room','capacity'=>40,'status'=>'active']);
$class = Classroom::updateOrCreate(['name'=>'X CF Test'],['level'=>'X','study_program_id'=>$program->id,'academic_year_id'=>$year->id,'homeroom_teacher_id'=>$teacher->id,'status'=>'active']);
$subject = Subject::updateOrCreate(['code'=>'CFSUBJ'],['name'=>'Synthetic CF Subject','study_program_id'=>$program->id,'credit_hours'=>2,'status'=>'active']);
Schedule::updateOrCreate(['classroom_id'=>$class->id,'subject_id'=>$subject->id,'semester_id'=>$semester->id],['teacher_id'=>$teacher->id,'room_id'=>$room->id,'academic_year_id'=>$year->id,'day'=>'monday','start_time'=>'08:00','end_time'=>'09:00','status'=>'active']);
$proof = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4Z8AAAAASUVORK5CYII=');
Storage::disk('local')->put('payment-proofs/core-finance-fixture.png',$proof);
$finance = [];
$students = [];
for ($i=0; $i<50; $i++) {
    $studentUser = account("finance-student-$i", 'murid');
    $parentUser = account("finance-parent-$i", 'wali_murid');
    $student = Student::updateOrCreate(['student_number'=>"CFLOAD$i"],['user_id'=>$studentUser['id'],'name'=>"Synthetic Finance Student $i",'status'=>'active']);
    $guardian = Guardian::updateOrCreate(['user_id'=>$parentUser['id']],['name'=>"Synthetic Finance Parent $i",'status'=>'active']);
    $guardian->students()->syncWithoutDetaching([$student->id=>['relationship'=>'wali']]);
    ClassStudent::updateOrCreate(['classroom_id'=>$class->id,'student_id'=>$student->id,'academic_year_id'=>$year->id,'semester_id'=>$semester->id],['status'=>'active','assigned_at'=>'2026-07-01']);
    AcademicRegistration::updateOrCreate(['student_id'=>$student->id,'academic_year_id'=>$year->id,'semester_id'=>$semester->id],['registration_number'=>"CFREG$i",'status'=>'registered','registered_at'=>'2026-07-01']);
    $invoices=[];
    foreach (['spp'=>'unpaid','book'=>'paid','exam'=>'pending'] as $type=>$state) {
        $invoice=Invoice::firstOrCreate(['student_id'=>$student->id,'invoice_type'=>$type],['created_by'=>$browser['admin']['id'],'amount'=>'150000.00','due_date'=>'2026-10-01']);
        if ($state!=='unpaid' && !$invoice->payments()->exists()) {
            $payment=Payment::create(['invoice_id'=>$invoice->id,'submitted_by'=>$studentUser['id'],'payment_date'=>'2026-10-01','amount'=>'150000.00','payment_method'=>'Synthetic bank transfer','proof_path'=>'payment-proofs/core-finance-fixture.png','proof_mime'=>'image/png','proof_size'=>strlen($proof)]);
            $payment->forceFill(['status'=>$state==='paid'?'verified':'pending','verified_by'=>$state==='paid'?$browser['admin']['id']:null,'verified_at'=>$state==='paid'?now():null])->save();
            if($state==='paid'){$invoice->forceFill(['status'=>'paid'])->save();}
        }
        $invoices[$type]=$invoice->id;
    }
    $actor=$i<5?account("finance-admin-$i",'admin'):($i%2?$parentUser:$studentUser);
    $finance[]=$actor+['student_id'=>$student->id,'invoice_id'=>$invoices['spp'],'payment_id'=>Invoice::find($invoices['book'])->payments()->first()->id];
    $students[]=$student->id;
}
$bsStudent=Student::updateOrCreate(['student_number'=>'CF-BS-001'],['user_id'=>$browser['student']['id'],'name'=>'Synthetic Browser Finance Student','status'=>'active']);
$guardian=Guardian::updateOrCreate(['user_id'=>$browser['parent']['id']],['name'=>'Synthetic Browser Finance Parent','status'=>'active']);
$guardian->students()->syncWithoutDetaching([$bsStudent->id=>['relationship'=>'wali']]);
$browser['student_id']=$bsStudent->id;
$browser['other_invoice_id']=$finance[6]['invoice_id'];
$browser['department_id']=$department->id;
file_put_contents($root.'/.tools/k6/core-credentials.json',json_encode($core));
$ordered=[];
for($i=0;$i<5;$i++){$ordered[]=$finance[$i];foreach(array_slice($finance,5+$i*9,9) as $actor)$ordered[]=$actor;}
file_put_contents($root.'/.tools/k6/finance-credentials.json',json_encode($ordered));
file_put_contents($root.'/.tools/browserstack/core-finance-users.json',json_encode($browser));
echo "Prepared 50 Core AIS load users, 50 finance load actors, 150 populated invoices and separate browser accounts.\n";
