import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export function auditMotionSource(source, path) {
  const issues = [],
    text = source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, " "),
    );
  const add = (match, rule) =>
    issues.push({
      path,
      line: text.slice(0, match.index).split("\n").length,
      rule,
    });
  if (path.replaceAll("\\", "/").endsWith("motion/tokens.css")) return issues;
  for (const m of text.matchAll(
    /\b(?:transition|animation)(?:-duration|-timing-function)?\s*:\s*([^;}]+)/g,
  )) {
    if (/^none(?:\s*!important)?\s*$/.test(m[1].trim())) continue;
    add(
      m,
      "Use the shared spring engine instead of CSS transitions/animations.",
    );
  }
  // Business assessment durations live in domain/fixtures; these are not motion.
  if (!/(?:domain|fixtures)[\\/]/.test(path)) {
    for (const m of text.matchAll(
      /(?:^|[{,])\s*(?:duration|stiffness|damping|mass|delay)\s*:\s*\d+(?:\.\d+)?\b/gm,
    ))
      add(m, "Read animation values from motion tokens.");
    for (const m of text.matchAll(/\beasing\s*:\s*["'][^"']+["']/g))
      add(m, "Read easing from motion tokens.");
  }
  for (const m of text.matchAll(/\bwill-change\s*:\s*([^;}]+)/g))
    if (!/^auto\s*$/.test(m[1].trim()))
      add(m, "Let the engine own temporary will-change.");
  return issues;
}
export async function checkMotion(directory = "src") {
  const issues = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(css|js|vue)$/.test(path))
        issues.push(
          ...auditMotionSource(
            await readFile(path, "utf8"),
            relative(".", path),
          ),
        );
    }
  }
  await walk(directory);
  return issues;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const issues = await checkMotion();
  if (issues.length) {
    issues.forEach((i) => console.error(`${i.path}:${i.line} ${i.rule}`));
    process.exitCode = 1;
  } else
    console.log(
      "Motion guard passed: shared tokens/engine, no CSS motion or permanent will-change.",
    );
}
