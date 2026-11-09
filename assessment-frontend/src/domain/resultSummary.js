const average = (total, count) => count ? Math.round(total / count) : null;

/** Submitted work only. Drafts, archived assessments and orphan attempts do not
 * contribute to lecturer results. Keep score totals so class averages are
 * weighted by submissions rather than by the size of each assessment. */
export function assessmentResultRows(db) {
  const rows = db.assessments
    .filter((assessment) => !["draft", "archived"].includes(assessment.state))
    .map((assessment) => ({
      assessment, submitted: 0, graded: 0, pending: 0, scoreTotal: 0, scored: 0,
    }));
  const byId = new Map(rows.map((row) => [row.assessment.id, row]));
  for (const attempt of db.attempts) {
    const row = byId.get(attempt.assessmentId);
    if (!row || attempt.status !== "submitted") continue;
    row.submitted++;
    if (attempt.graded) {
      row.graded++;
      if (Number.isFinite(attempt.score) && attempt.score >= 0 && attempt.score <= 100) {
        row.scoreTotal += attempt.score;
        row.scored++;
      }
    } else row.pending++;
  }
  return rows.map((row) => ({ ...row, average: average(row.scoreTotal, row.scored) }));
}

export function classGradeRows(rows, course) {
  const groups = new Map();
  for (const row of rows) {
    const { assessment } = row;
    if (assessment.course !== course) continue;
    let group = groups.get(assessment.className);
    if (!group) {
      group = { className: assessment.className, course, graded: 0, pending: 0, scoreTotal: 0, scored: 0 };
      groups.set(assessment.className, group);
    }
    for (const key of ["graded", "pending", "scoreTotal", "scored"]) group[key] += row[key];
  }
  return [...groups.values()]
    .map((group) => ({ ...group, average: average(group.scoreTotal, group.scored) }))
    .sort((a, b) => a.className.localeCompare(b.className, "id", { numeric: true }));
}
