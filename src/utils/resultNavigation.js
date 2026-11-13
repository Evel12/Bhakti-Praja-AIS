// Carry only the register's explicit scope through detail/grading pages.
export function resultContext(query) {
  return Object.fromEntries(["class", "course"]
    .filter((key) => typeof query[key] === "string" && query[key] !== "")
    .map((key) => [key, query[key]]));
}
