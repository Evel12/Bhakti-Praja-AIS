// Seeds demo data into the LOCAL AIS backend (http://127.0.0.1:8000) via its public API
// so the guidebook screenshots show a populated system. Local/dev use only.
const API = 'http://127.0.0.1:8000/api';
let token = '';

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}
const list = async (p) => { const j = await call('GET', `${p}${p.includes('?') ? '&' : '?'}per_page=100`); return j.data?.data ?? j.data ?? []; };
const create = async (p, b) => { const j = await call('POST', p, b); return j.data ?? j; };

const login = await call('POST', '/auth/login', { email: 'admin@akademik.test', password: 'admin123', portal: 'ais' });
token = login.token;

let years = await list('/academic-years');
let year = years.find((y) => y.is_active) ?? years[0];
if (!year) year = await create('/academic-years', { name: '2026/2027', start_date: '2026-07-13', end_date: '2027-06-25', is_active: true, status: 'active' });
let sems = await list('/semesters');
let sem = sems.find((s) => s.is_active) ?? sems[0];
if (!sem) sem = await create('/semesters', { academic_year_id: year.id, name: 'Semester Ganjil 2026/2027', period: 'Ganjil', start_date: '2026-07-13', end_date: '2026-12-19', is_active: true, status: 'active' });
console.log('year', year.id, 'semester', sem.id);

const programs = await list('/study-programs');
const subjects = await list('/subjects');
console.log('programs', programs.length, 'subjects', subjects.length);
const rpl = programs.find((p) => /RPL/.test(p.code ?? '') || /Rekayasa/.test(p.name ?? '')) ?? programs[0];
const tkr = programs.find((p) => /TKR/.test(p.code ?? '')) ?? programs[1] ?? rpl;

const users = await list('/users');
const byEmail = (e) => users.find((u) => u.email === e);
const guruUser = byEmail('budi@akademik.test');
const muridUser = byEmail('andi@akademik.test');
const waliUser = byEmail('agus@akademik.test');

const safe = async (fn) => { try { return await fn(); } catch (e) { console.log('skip:', e.message.slice(0, 160)); return null; } };

const t1 = await safe(() => create('/teachers', { teacher_number: '198507012010011001', name: 'Budi Santoso, S.Pd.', email: 'budi@akademik.test', phone: '081234567801', user_id: guruUser?.id, status: 'active' }));
const t2 = await safe(() => create('/teachers', { teacher_number: '198812052012012002', name: 'Agus Setiawan, S.T.', email: 'agus.setiawan@smkbp.sch.id', phone: '081234567802', status: 'active' }));
const teachers = await list('/teachers');

const studentRows = [
  ['2026001', 'Andi Pratama', 'L', muridUser?.id], ['2026002', 'Siti Nurhaliza', 'P'], ['2026003', 'Rizky Maulana', 'L'],
  ['2026004', 'Dewi Lestari', 'P'], ['2026005', 'Fajar Nugroho', 'L'], ['2026006', 'Putri Ayu Wulandari', 'P'],
];
for (const [nis, name, gender, user_id] of studentRows) {
  await safe(() => create('/students', { student_number: nis, name, gender, birth_date: '2009-03-15', address: 'Batang, Jawa Tengah', status: 'active', ...(user_id ? { user_id } : {}) }));
}
const students = await list('/students');

await safe(() => create('/rooms', { code: 'R-LAB1', name: 'Lab RPL 1', capacity: 36, location: 'Gedung A Lantai 2', status: 'active' }));
await safe(() => create('/rooms', { code: 'R-BKL', name: 'Bengkel Otomotif', capacity: 30, location: 'Gedung Bengkel', status: 'active' }));
const rooms = await list('/rooms');

await safe(() => create('/classrooms', { name: 'XI RPL 1', level: 'XI', study_program_id: rpl.id, academic_year_id: year.id, homeroom_teacher_id: teachers[0]?.id, status: 'active' }));
await safe(() => create('/classrooms', { name: 'XI TKR 1', level: 'XI', study_program_id: tkr.id, academic_year_id: year.id, homeroom_teacher_id: teachers[1]?.id, status: 'active' }));
const classes = await list('/classrooms');
const c1 = classes.find((c) => c.name === 'XI RPL 1') ?? classes[0];
const c2 = classes.find((c) => c.name === 'XI TKR 1') ?? classes[1] ?? c1;

for (const [i, s] of students.entries()) {
  const cls = i < 4 ? c1 : c2;
  await safe(() => create('/class-students', { student_id: s.id, classroom_id: cls.id, academic_year_id: year.id, semester_id: sem.id, status: 'active', assigned_at: '2026-07-13' }));
  await safe(() => create('/academic-registrations', { student_id: s.id, academic_year_id: year.id, semester_id: sem.id, status: i % 3 === 2 ? 'pending' : 'approved', registered_at: '2026-07-10' }));
}

const sub = (i) => subjects[i % subjects.length];
const sched = [
  [sub(0), c1, teachers[0], rooms[0], 'Senin', '07:00', '09:15'],
  [sub(1), c2, teachers[1], rooms[1], 'Selasa', '07:00', '08:30'],
  [sub(2), c1, teachers[0], rooms[0], 'Rabu', '09:30', '11:00'],
];
for (const [s, c, t, r, day, st, en] of sched) {
  await safe(() => create('/teaching-loads', { teacher_id: t.id, subject_id: s.id, classroom_id: c.id, semester_id: sem.id, weekly_hours: 4, status: 'active' }));
  await safe(() => create('/schedules', { subject_id: s.id, classroom_id: c.id, teacher_id: t.id, room_id: r?.id, semester_id: sem.id, academic_year_id: year.id, day, start_time: st, end_time: en, status: 'active' }));
}

const andi = students.find((s) => s.student_number === '2026001');
if (waliUser) await safe(() => create('/parents', { name: 'Agus Wali', email: 'agus@akademik.test', phone: '081234567899', address: 'Batang', occupation: 'Wiraswasta', user_id: waliUser.id, status: 'active', student_ids: [andi.id], relationship: 'Ayah' }));

const inv = [
  [andi, 'spp', 450000, '2026-11-15'], [andi, 'exam', 150000, '2026-11-30'], [students[1], 'activity', 300000, '2026-11-10'],
  [students[2], 'book', 275000, '2026-12-05'], [students[3], 'uniform', 500000, '2026-12-10'],
];
for (const [s, type, amount, due] of inv) await safe(() => create('/member4/invoices', { student_id: s.id, invoice_type: type, amount, due_date: due }));

await safe(() => create('/member4/announcements', { title: 'Pelaksanaan Penilaian Akhir Semester (PAS) Ganjil 2026/2027', content: 'Diberitahukan kepada seluruh guru, siswa, dan wali murid bahwa PAS Ganjil dilaksanakan melalui ruang Assessment Pembelajaran mulai 23 November 2026.', target_role: 'all' }));
await safe(() => create('/member4/announcements', { title: 'Batas Akhir Pembayaran SPP November', content: 'Pembayaran SPP bulan November 2026 paling lambat 15 November 2026.', target_role: 'wali_murid' }));

console.log('seed done', { students: students.length, classes: classes.length });
