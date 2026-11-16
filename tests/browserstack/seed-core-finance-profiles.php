<?php
$root=dirname(__DIR__,2);$expected=str_replace('\\','/',$root.'/.tools/k6/k6-lms.sqlite');
if(getenv('DB_CONNECTION')!=='sqlite'||str_replace('\\','/',getenv('DB_DATABASE')?:'')!==$expected)throw new RuntimeException('Select isolated database.');
require $root.'/backend/vendor/autoload.php';$app=require $root.'/backend/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(str_replace('\\','/',config('database.connections.sqlite.database'))!==$expected)throw new RuntimeException('Database is not isolated.');
use App\Models\{User,Role,Student,Guardian,Department,Invoice};
$profiles=[];
for($i=0;$i<9;$i++){
 $actors=[];
 foreach(['ais'=>'admin','admin'=>'admin','student'=>'murid','parent'=>'wali_murid'] as $name=>$role){
  $password=bin2hex(random_bytes(16));$user=User::updateOrCreate(['email'=>"browser-cf-$i-$name@core-finance-test.invalid"],['name'=>"Synthetic CF $i $name",'password'=>$password,'role_id'=>Role::where('name',$role)->value('id'),'status'=>'active']);
  $actors[$name]=['id'=>$user->id,'email'=>$user->email,'password'=>$password,'role'=>$role];
 }
 $student=Student::updateOrCreate(['student_number'=>"CF-BS-$i"],['user_id'=>$actors['student']['id'],'name'=>"Synthetic Device Finance Student $i",'status'=>'active']);
 $parent=Guardian::updateOrCreate(['user_id'=>$actors['parent']['id']],['name'=>"Synthetic Device Parent $i",'status'=>'active']);$parent->students()->syncWithoutDetaching([$student->id=>['relationship'=>'wali']]);
 $actors['student_id']=$student->id;$actors['department_id']=Department::where('code','CFDEP')->value('id');$actors['other_invoice_id']=Invoice::where('student_id','!=',$student->id)->value('id');
 $profiles[]=$actors;
}
file_put_contents($root.'/.tools/browserstack/core-finance-profiles.json',json_encode($profiles));
echo "Prepared independent accounts for nine browser profiles.\n";
