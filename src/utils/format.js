export const date = (v) =>
  Number.isFinite(Date.parse(v))
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(v))
    : "—";
export const time = (v) =>
  Number.isFinite(Date.parse(v))
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(v))
    : "—";
export const localInput = (v) =>
  Number.isFinite(Date.parse(v))
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(v))
        .replace(" ", "T")
    : "";
export const fromInput = (v) => {
  const n = Date.parse(v + "+07:00");
  return Number.isFinite(n) ? new Date(n).toISOString() : "";
};
export function deadlineDay(value, now = Date.now()) {
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return "Jadwal belum diatur";
  // WIB is UTC+7 year-round; compare calendar dates, rather than elapsed 24-hour periods.
  const day = (ms) => Math.floor((ms + 7 * 36e5) / 864e5);
  const remaining = day(deadline) - day(now);
  if (remaining < 0) return "Sudah lewat";
  if (remaining === 0) return "Hari ini";
  if (remaining === 1) return "Besok";
  return `Dalam ${remaining} hari`;
}
export function download(data, name, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
