export function assessmentFieldId(field, questionId) {
  return questionId
    ? `question-${encodeURIComponent(questionId)}-${field}`
    : `assessment-${field}`;
}

// Field identities remain stable when questions are inserted or removed.
export function assessmentIssues(a, { forPublish = false, now = Date.now() } = {}) {
  const issues = [];
  const add = (step, field, message, questionId) => {
    const target = assessmentFieldId(field, questionId);
    issues.push({ step, field, message, questionId, target });
  };
  if (!a.title.trim()) add(0, "title", "Judul assessment wajib diisi.");
  if (!a.course) add(0, "course", "Pilih mata kuliah.");
  if (!a.className) add(0, "className", "Pilih kelas.");
  if (a.type === "Tugas") {
    if (!a.instructions.trim()) add(1, "instructions", "Tuliskan instruksi tugas.");
  } else {
    if (!a.questions.length) add(1, "questions", "Tambahkan minimal satu soal.");
    a.questions.forEach((q, i) => {
      if (!q.text.trim()) add(1, "text", `Tuliskan pertanyaan soal ${i + 1}.`, q.id);
      if (q.options.length < 2)
        add(1, "options", `Tambahkan minimal dua pilihan pada soal ${i + 1}.`, q.id);
      q.options.forEach((option, j) => {
        if (!option.trim())
          add(1, `option-${j}`, `Lengkapi pilihan ${String.fromCharCode(65 + j)} pada soal ${i + 1}.`, q.id);
      });
      if (q.options.length && (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length))
        add(1, "correct", `Pilih kunci jawaban soal ${i + 1}.`, q.id);
      if (!Number.isFinite(Number(q.points)) || Number(q.points) <= 0)
        add(1, "points", `Poin soal ${i + 1} harus lebih dari 0.`, q.id);
      if (q.source === "ai" && !q.reviewed)
        add(1, "reviewed", `Cek soal AI nomor ${i + 1} dulu.`, q.id);
    });
  }
  const start = Date.parse(a.openAt), end = Date.parse(a.closeAt);
  if (!Number.isFinite(start)) add(2, "openAt", "Isi waktu buka yang valid.");
  if (!Number.isFinite(end)) add(2, "closeAt", "Isi waktu tutup yang valid.");
  else if (Number.isFinite(start) && end <= start)
    add(2, "closeAt", "Waktu tutup harus setelah waktu buka.");
  else if (forPublish && end <= now)
    add(2, "closeAt", "Waktu tutup sudah lewat. Atur jadwal baru.");
  if (a.type !== "Tugas" && (!Number.isFinite(Number(a.duration)) || a.duration < 1 || a.duration > 240))
    add(2, "duration", "Durasi harus 1–240 menit.");
  return issues;
}
