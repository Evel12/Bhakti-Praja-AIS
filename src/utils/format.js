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
export function download(data, name, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
