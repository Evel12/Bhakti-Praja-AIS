<?php
$root=dirname(__DIR__,2);$expected=str_replace('\\','/',$root.'/.tools/k6/k6-lms.sqlite');
if(getenv('DB_CONNECTION')!=='sqlite'||str_replace('\\','/',getenv('DB_DATABASE')?:'')!==$expected)throw new RuntimeException('Use the isolated test database.');
require $root.'/backend/vendor/autoload.php';$app=require $root.'/backend/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(str_replace('\\','/',config('database.connections.sqlite.database'))!==$expected)throw new RuntimeException('Database is not isolated.');
use App\Models\{User,Role,Student};
use Illuminate\Support\Facades\{DB,Storage};
$actors=[];
foreach(['admin'=>'admin','student'=>'murid'] as $name=>$role){
 $user=User::updateOrCreate(['email'=>"uptime-$name@local-test.invalid"],['name'=>'Synthetic Uptime '.ucfirst($name),'password'=>bin2hex(random_bytes(20)),'role_id'=>Role::where('name',$role)->value('id'),'status'=>'active']);
 $user->tokens()->delete();$actors[$name]=['id'=>$user->id,'token'=>$user->createToken('local-uptime-probe')->plainTextToken];
}
$student=Student::updateOrCreate(['student_number'=>'UPTIME-001'],['user_id'=>$actors['student']['id'],'name'=>'Synthetic Uptime Student','status'=>'active']);
$material=DB::table('lms_materials')->where('visibility','public')->orderBy('id')->first();
if(!$material||!Storage::disk('local')->exists($material->path))throw new RuntimeException('Missing populated LMS/storage fixture.');
DB::table('lms_members')->updateOrInsert(['course_id'=>$material->course_id,'user_id'=>$actors['student']['id']],['created_at'=>now(),'updated_at'=>now()]);
$invoice=DB::table('invoices')->orderBy('id')->first();$payment=DB::table('payments')->orderBy('id')->first();
if(!$invoice||!$payment||!Storage::disk('local')->exists($payment->proof_path))throw new RuntimeException('Missing populated finance/storage fixture.');
$counts=[];foreach(['students','schedules','lms_courses','lms_materials','invoices','payments'] as $table)$counts[$table]=DB::table($table)->count();
$actors+=['course_id'=>$material->course_id,'material_id'=>$material->id,'invoice_id'=>$invoice->id,'payment_id'=>$payment->id,'fixture_counts'=>$counts];
file_put_contents($root.'/.tools/uptime/probe-credentials.json',json_encode($actors,JSON_PRETTY_PRINT));
$core=json_decode(file_get_contents($root.'/.tools/browserstack/core-finance-profiles.json'),true)[0];
$lms=json_decode(file_get_contents($root.'/.tools/browserstack/app-users.json'),true);
file_put_contents($root.'/.tools/uptime/demo-accounts.json',json_encode(['core_ais_admin'=>$core['ais'],'finance_admin'=>$core['admin'],'finance_parent'=>$core['parent'],'lms_teacher'=>$lms['teacher']],JSON_PRETTY_PRINT));
echo json_encode(['fixture_counts'=>$counts])."\n";
