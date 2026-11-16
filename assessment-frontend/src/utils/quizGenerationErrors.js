const GENERATION_ERROR_MESSAGES = {
  ai_unavailable:
    "Layanan AI (Ollama) sedang sibuk atau belum aktif. Pastikan AI service dan Ollama berjalan, lalu coba lagi.",
  ai_rejected:
    "Materi PDF tidak dapat diproses oleh AI (misalnya file scan gambar tanpa teks, terenkripsi, atau format tidak valid).",
  source_unavailable:
    "Berkas materi PDF pada server tidak ditemukan atau tidak terbaca.",
  malformed_output:
    "Format hasil soal dari AI tidak valid. Silakan ulangi proses generate.",
  configuration_error:
    "Konfigurasi layanan AI pada backend belum lengkap atau tidak valid.",
  ownership_changed:
    "Izin kepemilikan kelas/modul berubah saat proses berjalan.",
  generation_failed:
    "AI gagal membuat soal dari materi PDF.",
};

export function formatQuizGenerationError(job, fallback = "AI gagal membuat soal dari materi PDF.") {
  if (job?.error_message) {
    return job.error_message;
  }
  const code = String(job?.error_code || "").trim();
  return GENERATION_ERROR_MESSAGES[code] || fallback;
}
