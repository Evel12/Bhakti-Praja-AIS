import {STORAGE_KEY,STUDENT_ID,clone,uid,newAssessment,newQuestion,saveAssessment,duplicateAssessment,validateAssessment,startAttempt,finishAttempt,exportResults,escapeHTML as e,statusOf,COURSES} from './model.js';
import {makeSeed} from './seed.js';
import {renderShell,icon,btn,date,time} from './ui.js';
const root=document.getElementById('app'),dialog=document.getElementById('app-dialog');
let db;try{const raw=localStorage.getItem(STORAGE_KEY);db=raw?JSON.parse(raw):makeSeed();if(db.version!==1||!Array.isArray(db.assessments)||!Array.isArray(db.attempts)||!Array.isArray(db.bank))db=makeSeed();}catch{db=makeSeed();}
const ctx={db,role:'teacher',route:{name:'dashboard',id:null},filter:'all',search:'',bankSearch:'',draft:null,step:0,questionIndex:0,examIndex:0,errors:[],storageError:false,menuOpen:false,navExpanded:true};
let toastTimer,timerId,confirmAction=null,bankContext=null,dialogReturnFocus=null,expiredHandled=new Set();
function toast(message,error=false){const el=document.getElementById('toast');el.innerHTML=`${icon(error?'alert':'checkCircle','sm')}<span>${e(message)}</span>`;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4500);}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));ctx.storageError=false;return true;}catch{ctx.storageError=true;toast('Penyimpanan browser penuh atau tidak tersedia. Perubahan belum tersimpan.',true);return false;}}
persist();
function parseRoute(){const [name,id]=location.hash.replace(/^#\/?/,'').split('/');return {name:name||'dashboard',id:id?decodeURIComponent(id):null};}
function navigate(hash){if(location.hash===hash){ctx.route=parseRoute();render();}else location.hash=hash;}
function render(keepFocus=false){
  const active=keepFocus?document.activeElement:null,id=active?.id,selection=active&&'selectionStart'in active?active.selectionStart:null,scroll=window.scrollY;
  root.innerHTML=renderShell(ctx);updateTimer();
  if(keepFocus&&id){const replacement=document.getElementById(id);if(replacement){replacement.focus({preventScroll:true});if(selection!==null&&replacement.setSelectionRange)try{replacement.setSelectionRange(selection,selection);}catch{}}window.scrollTo({top:scroll,behavior:'instant'});}
}
function routeChanged(){
  const next=parseRoute();ctx.menuOpen=false;ctx.errors=[];ctx.examIndex=0;ctx.search='';ctx.route=next;
  if(['student','instructions','attempt','review','my-results'].includes(next.name))ctx.role='student';
  else if(['dashboard','assessments','builder','bank','results','grade'].includes(next.name))ctx.role='teacher';
  if(next.name==='assessments')ctx.filter=['all','Aktif','Draft','Terjadwal','Ditutup'].includes(next.id)?next.id:'all';
  if(next.name==='builder'){
    const found=db.assessments.find(a=>a.id===next.id);ctx.draft=found?clone(found):null;ctx.step=0;ctx.questionIndex=0;
  }
  if(next.name==='instructions'){
    const a=db.assessments.find(x=>x.id===next.id);
    if(!a||['draft','archived'].includes(a.state)||a.className!=='Kelas A'){navigate('#/student');return;}
  }
  if(next.name==='attempt'){
    const at=db.attempts.find(x=>x.id===next.id&&x.studentId===STUDENT_ID);
    if(!at){navigate('#/student');return;}if(at.status==='submitted'){navigate(`#/review/${at.id}`);return;}
  }
  render();document.getElementById('main-content')?.focus({preventScroll:true});window.scrollTo(0,0);
}
window.addEventListener('hashchange',routeChanged);
function createDraft(){const a=newAssessment();saveAssessment(db,a);persist();navigate(`#/builder/${a.id}`);}
function saveDraft(show=true){if(!ctx.draft)return false;saveAssessment(db,ctx.draft);if(!persist())return false;if(show)toast('Draft tersimpan. Anda dapat melanjutkan kapan saja.');return true;}
function showDialog(title,content,footer=''){
  dialogReturnFocus=document.activeElement;
  if(dialog.open)dialog.close();
  dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${e(title)}</h2><button class="icon-btn" type="button" data-action="dismiss-dialog" aria-label="Tutup dialog">${icon('x')}</button></div>${content}${footer?`<div class="dialog-footer">${footer}</div>`:''}`;dialog.showModal();
}
function closeDialog(){dialog.close();confirmAction=null;dialogReturnFocus?.focus?.({preventScroll:true});}
dialog.addEventListener('cancel',()=>confirmAction=null);
function confirm(title,content,label,onConfirm){confirmAction=onConfirm;showDialog(title,content,`${btn('Kembali','dismiss-dialog')}${btn(e(label),'confirm-dialog','','primary')}`);}
function ownAttempt(){return db.attempts.find(x=>x.id===ctx.route.id&&x.studentId===STUDENT_ID);}
function assessmentFor(at){return db.assessments.find(x=>x.id===at?.assessmentId);}
function currentQuestion(){return ctx.draft?.questions[ctx.questionIndex];}
function updateTimer(){
  clearInterval(timerId);
  if(ctx.route.name!=='attempt')return;
  const at=ownAttempt(),a=assessmentFor(at);if(!at||!a||at.status!=='in_progress')return;
  const tick=()=>{
    const remaining=Math.max(0,Date.parse(at.expiresAt)-Date.now()),timer=document.getElementById('exam-timer');
    if(timer){const seconds=Math.ceil(remaining/1000);timer.textContent=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;timer.classList.toggle('warning',remaining<5*60e3);}
    if(remaining===0&&!expiredHandled.has(at.id)){
      expiredHandled.add(at.id);
      if(a.type!=='Tugas'){submit(at,true);}else{toast('Tenggat pengumpulan sudah lewat.',true);navigate('#/student');}
    }
  };timerId=setInterval(tick,1000);setTimeout(tick,0);
}
function submit(at,automatic=false){
  const a=assessmentFor(at);if(!a)return;
  if(at.status==='submitted'){navigate(`#/review/${at.id}`);return;}
  if(a.type==='Tugas'&&Date.now()>Date.parse(at.expiresAt)){toast('Tenggat pengumpulan sudah lewat.',true);return;}
  const before=clone(at);
  try{finishAttempt(a,at);if(!persist()){Object.assign(at,before);return;}if(dialog.open)closeDialog();toast(automatic?'Waktu habis. Jawaban yang tersimpan telah dikirim.':'Assessment berhasil dikirim.');navigate(`#/review/${at.id}`);}catch(err){toast(err.message,true);}
}
function questionDialog(q){showDialog('Detail soal',`<p class="dialog-copy">${e(q.topic||'Pilihan ganda')} · ${q.points} poin</p><h3 style="line-height:1.8">${e(q.text)}</h3>${q.options.map((o,i)=>`<div class="option-display ${i===q.correct?'correct':''}">${String.fromCharCode(65+i)}. ${e(o)} ${i===q.correct?'✓':''}</div>`).join('')}${q.explanation?`<p class="dialog-copy mt">${e(q.explanation)}</p>`:''}`,btn('Tutup','dismiss-dialog'));}
function openBankPicker(){bankContext='builder';showDialog('Pilih dari bank soal',`<p class="dialog-copy">Pilih soal untuk disalin ke draft. Soal asli tetap tersimpan di bank soal.</p><form id="bank-picker-form">${db.bank.map(q=>`<div class="bank-picker"><input type="checkbox" name="bank-question" value="${q.id}" id="pick-${q.id}"><label for="pick-${q.id}">${e(q.text)}<small>${e(q.topic)} · ${q.points} poin</small></label></div>`).join('')}</form>`,`${btn('Batal','dismiss-dialog')}${btn('Tambahkan soal','add-bank-selection','','primary','plus')}`);}
function openAI(){showDialog('Bantu susun soal dengan AI',`<div class="notice warning">Pratinjau alur AI · layanan pembuat soal belum dihubungkan.</div><p class="dialog-copy">Pilih PDF untuk mencoba tampilan unggah, lalu gunakan contoh soal untuk meninjau alur review. Berkas tidak dikirim ke layanan eksternal.</p><label class="upload">${icon('upload')}<strong>Pilih materi pembelajaran</strong><small>PDF · maksimal 10 MB</small><input type="file" id="ai-pdf" accept=".pdf" aria-label="Pilih materi PDF"></label><div class="notice">Soal contoh berasal dari bank soal Jaringan Komputer, bukan hasil analisis PDF Anda.</div>`,`${btn('Batal','dismiss-dialog')}${btn('Gunakan 3 soal contoh','sample-ai','','primary','sparkles')}`);}
function download(data,name,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();document.getElementById('main-content')?.focus();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action,id=target.dataset.id,value=target.dataset.value;
  const a=id?db.assessments.find(x=>x.id===id):null;
  switch(action){
    case'open-menu':ctx.menuOpen=true;render();document.querySelector('.sidebar-close')?.focus();break;
    case'close-menu':ctx.menuOpen=false;render();document.querySelector('.mobile-menu')?.focus();break;
    case'toggle-assessment-nav':ctx.navExpanded=!ctx.navExpanded;render();break;
    case'new':createDraft();break;
    case'help':showDialog('Satu alur, dari soal sampai hasil',`<ol class="help-steps"><li><strong>Buat assessment.</strong> Pilih jenis, mata kuliah, dan kelas.</li><li><strong>Tambahkan konten.</strong> Tulis soal atau gunakan bank soal.</li><li><strong>Periksa dan terbitkan.</strong> Atur jadwal serta durasinya.</li><li><strong>Coba sebagai peserta.</strong> Ganti tampilan di kanan atas.</li><li><strong>Tinjau dan rilis hasil.</strong> Kembali ke tampilan pengajar.</li></ol><p class="demo-description">Ini implementasi UI dengan data contoh. Perubahan tersimpan pada browser dan perangkat ini. Autentikasi, API Laravel, penyimpanan server, dan layanan AI belum dihubungkan.</p>`,btn('Mengerti','dismiss-dialog','','primary'));break;
    case'filter':ctx.filter=value;navigate(`#/assessments/${encodeURIComponent(value)}`);break;
    case'duplicate':if(a){const copy=duplicateAssessment(a);saveAssessment(db,copy);persist();toast('Salinan draft dibuat.');navigate(`#/builder/${copy.id}`);}break;
    case'save-draft':saveDraft();break;
    case'builder-step':ctx.errors=[];ctx.step=Number(value);render();break;
    case'prev-step':ctx.errors=[];ctx.step=Math.max(0,ctx.step-1);render();break;
    case'next-step':{
      const d=ctx.draft;if(!d)break;
      ctx.errors=[];
      if(ctx.step===0&&!d.title.trim())ctx.errors=['Tuliskan judul assessment terlebih dahulu.'];
      if(ctx.step===1){const errors=validateAssessment(d);ctx.errors=errors.filter(x=>/soal|pertanyaan|pilihan|poin|instruksi/i.test(x));}
      if(ctx.step===2)ctx.errors=validateAssessment(d).filter(x=>/waktu|durasi/i.test(x));
      if(!ctx.errors.length){saveDraft(false);ctx.step=Math.min(3,ctx.step+1);}render();if(ctx.errors.length)document.querySelector('.error-box')?.scrollIntoView({block:'center',behavior:'smooth'});break;
    }
    case'add-question':ctx.draft.questions.push(newQuestion());ctx.questionIndex=ctx.draft.questions.length-1;ctx.errors=[];render();break;
    case'select-question':ctx.questionIndex=Number(value);render();break;
    case'remove-question':confirm('Hapus soal ini?',`<p class="dialog-copy">Soal ${ctx.questionIndex+1} akan dihapus dari draft ini. Bank soal tetap tersimpan.</p>`,'Hapus soal',()=>{ctx.draft.questions.splice(ctx.questionIndex,1);ctx.questionIndex=Math.max(0,Math.min(ctx.questionIndex,ctx.draft.questions.length-1));ctx.errors=[];render();});break;
    case'pick-bank':openBankPicker();break;
    case'add-bank-selection':{
      const selected=[...dialog.querySelectorAll('input[name="bank-question"]:checked')].map(x=>x.value);if(!selected.length){toast('Pilih setidaknya satu soal.',true);break;}
      const qs=db.bank.filter(q=>selected.includes(q.id)).map(q=>({...clone(q),id:uid()}));
      if(ctx.draft.questions.length===1&&!ctx.draft.questions[0].text.trim())ctx.draft.questions=[];
      ctx.draft.questions.push(...qs);ctx.questionIndex=ctx.draft.questions.length-qs.length;closeDialog();render();toast(`${qs.length} soal ditambahkan ke draft.`);break;
    }
    case'open-ai':openAI();break;
    case'sample-ai':{
      const qs=db.bank.slice(0,3).map(q=>({...clone(q),id:uid(),source:'ai',reviewed:false}));if(ctx.draft.questions.length===1&&!ctx.draft.questions[0].text.trim())ctx.draft.questions=[];ctx.draft.questions.push(...qs);ctx.questionIndex=ctx.draft.questions.length-3;closeDialog();render();toast('Soal contoh ditambahkan. Tinjau kunci dan isinya sebelum terbit.');break;
    }
    case'publish':{
      const errors=validateAssessment(ctx.draft);ctx.errors=errors;if(Date.parse(ctx.draft.closeAt)<=Date.now())ctx.errors.push('Waktu tutup sudah lewat. Atur jadwal yang baru.');
      if(ctx.errors.length){render();document.querySelector('.error-box')?.scrollIntoView({block:'center',behavior:'smooth'});break;}
      confirm('Terbitkan assessment?',`<p class="dialog-copy"><strong>${e(ctx.draft.title)}</strong> akan tersedia untuk ${e(ctx.draft.className)} sesuai jadwal. Konten dikunci setelah terbit.</p>`,'Ya, terbitkan',()=>{ctx.draft.state='published';saveAssessment(db,ctx.draft);if(persist()){toast('Assessment berhasil diterbitkan.');navigate('#/assessments/all');}});break;
    }
    case'bank-detail':{const q=db.bank.find(x=>x.id===id);if(q)questionDialog(q);break;}
    case'use-bank':{
      const q=db.bank.find(x=>x.id===id);if(!q)break;const draft=newAssessment();draft.title='Assessment baru — '+q.topic;draft.course=COURSES.includes(q.topic)?q.topic:COURSES[0];draft.questions=[{...clone(q),id:uid()}];saveAssessment(db,draft);persist();navigate(`#/builder/${draft.id}`);toast('Soal ditambahkan ke draft baru.');break;
    }
    case'new-bank':showDialog('Tambahkan soal ke bank',`<p class="dialog-copy">Tulis soal yang dapat digunakan kembali untuk assessment berikutnya.</p><form id="new-bank-form"><label class="field"><span class="field-label">Mata kuliah</span><select class="input" name="topic">${COURSES.map(c=>`<option>${e(c)}</option>`).join('')}</select></label><label class="field mt"><span class="field-label">Pertanyaan</span><textarea class="input" name="text" maxlength="2000" required></textarea></label><div class="mt"><span class="field-label">Pilihan jawaban · tandai kunci yang benar</span>${[0,1,2,3].map(i=>`<label class="option-editor"><input type="radio" name="correct" value="${i}" ${i===0?'checked':''}><span class="option-letter">${String.fromCharCode(65+i)}</span><input class="input" name="option${i}" maxlength="1000" required aria-label="Pilihan ${String.fromCharCode(65+i)}"></label>`).join('')}</div><label class="field mt"><span class="field-label">Pembahasan</span><textarea class="input" name="explanation" maxlength="2000" rows="2"></textarea></label></form>`,`${btn('Batal','dismiss-dialog')}${btn('Simpan soal','save-bank','','primary','save')}`);break;
    case'save-bank':{
      const form=dialog.querySelector('#new-bank-form');if(!form.reportValidity())break;const data=new FormData(form);const options=[0,1,2,3].map(i=>data.get('option'+i).trim());const text=data.get('text').trim();if(!text||options.some(x=>!x)){toast('Lengkapi soal dan semua pilihan jawaban.',true);break;}
      db.bank.unshift({id:uid(),text,options,correct:Number(data.get('correct')),points:1,source:'manual',reviewed:true,explanation:data.get('explanation').trim(),topic:data.get('topic')});if(persist()){closeDialog();render();toast('Soal tersimpan di bank soal.');}break;
    }
    case'export':if(a){download(exportResults(a,db.attempts),`hasil-${a.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.csv`);toast('Hasil diunduh sebagai CSV.');}break;
    case'release':{
      if(!a)break;const submitted=db.attempts.filter(x=>x.assessmentId===id&&x.status==='submitted');if(!submitted.length||submitted.some(x=>!x.graded)){toast('Selesaikan penilaian semua pengumpulan terlebih dahulu.',true);break;}
      confirm('Rilis hasil ke peserta?',`<p class="dialog-copy">${submitted.length} peserta akan dapat melihat nilai dan review untuk <strong>${e(a.title)}</strong>.</p>`,'Rilis hasil',()=>{a.released=true;if(persist()){render();toast('Hasil sudah dapat dilihat peserta.');}});break;
    }
    case'close-assessment':if(a)confirm('Tutup assessment?',`<p class="dialog-copy">Peserta tidak dapat memulai pengerjaan baru. Sesi yang masih berjalan akan berakhir saat halaman diperbarui atau waktu habis. Hasil tetap mengikuti aturan rilis.</p>`,'Tutup assessment',()=>{a.state='closed';db.attempts.filter(at=>at.assessmentId===id&&at.status==='in_progress'&&a.type!=='Tugas').forEach(at=>finishAttempt(a,at));persist();render();toast('Assessment ditutup.');});break;
    case'attempt-detail':{
      const at=db.attempts.find(x=>x.id===id),a=assessmentFor(at);if(!at||!a)break;showDialog('Review jawaban peserta',`<p class="dialog-copy">${e(at.studentName)} · ${e(a.title)}<br>Nilai: ${at.graded?at.score+'/100':'Belum selesai'}</p>${a.questions.map((q,i)=>`<div class="preview-question mb"><h3>${i+1}. ${e(q.text)}</h3><p>Jawaban: ${e(at.answers[q.id]===undefined?'Tidak dijawab':q.options[at.answers[q.id]])}</p><div class="option-display correct">Kunci: ${e(q.options[q.correct])}</div></div>`).join('')}`,btn('Tutup','dismiss-dialog'));break;
    }
    case'start':{
      if(!a)break;try{const at=startAttempt(a,db.attempts);if(!db.attempts.some(x=>x.id===at.id))db.attempts.push(at);if(persist())navigate(`#/attempt/${at.id}`);}catch(err){toast(err.message,true);}break;
    }
    case'exam-prev':ctx.examIndex=Math.max(0,ctx.examIndex-1);render();break;
    case'exam-next':{const a=assessmentFor(ownAttempt());ctx.examIndex=Math.min(a.questions.length-1,ctx.examIndex+1);render();break;}
    case'exam-go':ctx.examIndex=Number(value);render();break;
    case'flag':{const at=ownAttempt();if(at){at.flags=at.flags.includes(id)?at.flags.filter(x=>x!==id):[...at.flags,id];persist();render(true);}break;}
    case'submit-attempt':{
      const at=ownAttempt(),a=assessmentFor(at);if(!at||!a)break;
      if(a.type==='Tugas'){if(!at.attachment){toast('Pilih berkas tugas terlebih dahulu.',true);document.getElementById('task-upload')?.focus();break;}confirm('Kirim tugas?',`<p class="dialog-copy"><strong>${e(at.attachment.name)}</strong> akan dikumpulkan. Berkas tidak dapat diganti setelah dikirim.</p>`,'Kirim tugas',()=>submit(at));}
      else {const answered=Object.keys(at.answers).length,blank=a.questions.length-answered;confirm('Periksa jawaban Anda',`<p class="dialog-copy">${answered} dari ${a.questions.length} soal sudah dijawab.${blank?` <strong>${blank} soal masih kosong.</strong>`:''} Setelah dikirim, jawaban tidak dapat diubah.</p><div class="review-numbers">${a.questions.map((q,i)=>`<span class="${at.answers[q.id]===undefined?'blank':''}">${i+1}</span>`).join('')}</div>`,'Kirim jawaban',()=>submit(at));}break;
    }
    case'choose-file':document.getElementById('task-upload')?.click();break;
    case'download-file':{
      const at=db.attempts.find(x=>x.id===id);if(at?.attachment?.dataURL){const a=document.createElement('a');a.href=at.attachment.dataURL;a.download=at.attachment.name;a.click();}break;
    }
    case'dismiss-dialog':closeDialog();break;
    case'confirm-dialog':{const callback=confirmAction;closeDialog();callback?.();break;}
  }
});
document.addEventListener('input',event=>{
  const input=event.target;
  if(input.id==='assessment-search'){ctx.search=input.value;render(true);return;}
  if(input.id==='bank-search'){ctx.bankSearch=input.value;render(true);return;}
  if(!input.closest('#builder-form')||!ctx.draft)return;
  const name=input.name,q=currentQuestion();
  if(['title','description','instructions'].includes(name))ctx.draft[name]=input.value;
  if(name==='question-text'&&q){q.text=input.value;if(q.source==='ai'){q.reviewed=false;const reviewInput=document.querySelector('[name="question-reviewed"]');if(reviewInput)reviewInput.checked=false;}}
  if(name?.startsWith('question-option-')&&q){q.options[Number(name.slice(-1))]=input.value;if(q.source==='ai'){q.reviewed=false;const reviewInput=document.querySelector('[name="question-reviewed"]');if(reviewInput)reviewInput.checked=false;}}
  if(name==='question-explanation'&&q)q.explanation=input.value;
  if(name==='question-points'&&q)q.points=Number(input.value);
  if(name==='duration')ctx.draft.duration=Number(input.value);
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.id==='role-switch'){
    if(ctx.route.name==='attempt'&&ownAttempt()?.status==='in_progress'){input.value='student';toast('Selesaikan atau simpan sesi melalui navigasi peserta terlebih dahulu.');return;}
    ctx.role=input.value;navigate(input.value==='student'?'#/student':'#/dashboard');return;
  }
  if(input.name==='student-answer'){
    const at=ownAttempt(),a=assessmentFor(at);if(!at||!a||at.status!=='in_progress')return;
    if(Date.now()>=Date.parse(at.expiresAt)||statusOf(a)==='Ditutup'){submit(at,true);return;}
    const before=clone(at.answers);at.answers[input.dataset.question]=Number(input.value);if(!persist())at.answers=before;render(true);return;
  }
  if(input.id==='task-upload'){uploadTask(input.files?.[0]);return;}
  if(input.id==='ai-pdf'){
    const file=input.files?.[0];if(file&&(!file.name.toLowerCase().endsWith('.pdf')||file.size>10*1024*1024)){input.value='';toast('Pilih berkas PDF dengan ukuran maksimal 10 MB.',true);}return;
  }
  if(!input.closest('#builder-form')||!ctx.draft)return;
  if(['course','className','releaseMode'].includes(input.name))ctx.draft[input.name]=input.value;
  if(input.name==='type'){ctx.draft.type=input.value;if(input.value==='Tugas')ctx.draft.releaseMode='manual';render();}
  if(['openAt','closeAt'].includes(input.name)){const d=new Date(input.value+'+07:00');ctx.draft[input.name]=Number.isNaN(d.getTime())?'':d.toISOString();}
  const q=currentQuestion();if(input.name==='question-correct'&&q){q.correct=Number(input.value);if(q.source==='ai'){q.reviewed=false;const reviewInput=document.querySelector('[name="question-reviewed"]');if(reviewInput)reviewInput.checked=false;}}
  if(input.name==='question-reviewed'&&q)q.reviewed=input.checked;
});
document.addEventListener('submit',event=>{
  if(event.target.id==='builder-form'){event.preventDefault();return;}
  if(event.target.id!=='grade-form')return;event.preventDefault();
  const form=event.target;if(!form.reportValidity())return;const data=new FormData(form),score=Number(data.get('score'));
  if(data.get('score')===''||!Number.isFinite(score)||score<0||score>100){toast('Masukkan nilai antara 0 dan 100.',true);return;}
  const at=db.attempts.find(x=>x.id===data.get('attemptId'));if(!at)return;at.score=score;at.feedback=data.get('feedback').trim();at.graded=true;
  if(persist()){toast('Penilaian tersimpan.');navigate(`#/results/${at.assessmentId}`);}
});
async function uploadTask(file){
  if(!file)return;const at=ownAttempt(),a=assessmentFor(at);if(!at||!a||at.status!=='in_progress')return;
  if(Date.now()>Date.parse(at.expiresAt)){toast('Tenggat pengumpulan sudah lewat.',true);return;}
  const ext=file.name.toLowerCase().split('.').pop();if(!['pdf','docx','jpg','jpeg','png'].includes(ext)||file.size>2*1024*1024){toast('Gunakan PDF, DOCX, JPG, atau PNG, maksimal 2 MB.',true);document.getElementById('task-upload').value='';return;}
  try{const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const before=at.attachment;at.attachment={name:file.name,size:file.size,type:file.type,dataURL};if(!persist()){at.attachment=before;return;}render();toast('Berkas siap dikumpulkan. Klik Kirim tugas untuk menyelesaikan.');}catch{toast('Berkas tidak dapat dibaca. Coba pilih kembali.',true);}
}
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&ctx.menuOpen){ctx.menuOpen=false;render();document.querySelector('.mobile-menu')?.focus();}
  if(event.key==='Tab'&&ctx.menuOpen&&!dialog.open){
    const items=[...document.querySelectorAll('#sidebar a[href],#sidebar button')].filter(el=>!el.disabled);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
window.addEventListener('pagehide',()=>clearInterval(timerId));
routeChanged();
