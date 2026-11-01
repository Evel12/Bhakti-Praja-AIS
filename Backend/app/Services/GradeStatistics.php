<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;

class GradeStatistics
{
    // Sum integer hundredths per stored grade before averaging. Zero is a grade;
    // unfinished attempts and legacy missing grades must never enter the denominator.
    private const string AGGREGATES = <<<'SQL'
        COUNT(*) AS attempts_count,
        COALESCE(SUM(CASE WHEN attempts.status = 'ongoing' THEN 1 ELSE 0 END), 0) AS ongoing_count,
        COALESCE(SUM(CASE WHEN attempts.status = 'finished' THEN 1 ELSE 0 END), 0) AS finished_count,
        COALESCE(SUM(CASE WHEN attempts.status = 'finished' AND attempts.final_grade IS NOT NULL THEN 1 ELSE 0 END), 0) AS graded_count,
        COALESCE(SUM(CASE WHEN attempts.status = 'finished' AND attempts.final_grade IS NOT NULL THEN ROUND(attempts.final_grade * 100, 0) ELSE 0 END), 0) AS grade_cents,
        MAX(CASE WHEN attempts.status = 'finished' AND attempts.final_grade IS NOT NULL THEN attempts.final_grade END) AS highest_grade,
        MIN(CASE WHEN attempts.status = 'finished' AND attempts.final_grade IS NOT NULL THEN attempts.final_grade END) AS lowest_grade
        SQL;

    public function summarize(Builder $attempts): array
    {
        $row = $this->aggregateQuery($attempts)->selectRaw(self::AGGREGATES)->toBase()->first();

        return $this->format($row);
    }

    public function byStudent(Builder $attempts, array $studentIds): array
    {
        if ($studentIds === []) {
            return [];
        }

        $rows = $this->aggregateQuery($attempts)->whereIn('attempts.student_id', $studentIds)
            ->select('attempts.student_id')->selectRaw(self::AGGREGATES)
            ->groupBy('attempts.student_id')->toBase()->get();
        $summaries = [];
        foreach ($rows as $row) {
            $summaries[(int) $row->student_id] = $this->format($row);
        }

        return $summaries;
    }

    public function empty(): array
    {
        return $this->format(null);
    }

    private function aggregateQuery(Builder $attempts): Builder
    {
        // Clearing the projection avoids unrelated withCount/select columns breaking
        // aggregate SQL under MySQL ONLY_FULL_GROUP_BY.
        return (clone $attempts)->setEagerLoads([])->reorder()->select([]);
    }

    private function format(?object $row): array
    {
        $graded = (int) ($row->graded_count ?? 0);
        $finished = (int) ($row->finished_count ?? 0);
        $sumCents = (int) ($row->grade_cents ?? 0);

        return [
            'attempts_count' => (int) ($row->attempts_count ?? 0),
            'ongoing_count' => (int) ($row->ongoing_count ?? 0),
            'finished_count' => $finished,
            'graded_count' => $graded,
            'ungraded_finished_count' => $finished - $graded,
            'average_grade' => $graded === 0 ? null : $this->decimal(intdiv($sumCents + intdiv($graded, 2), $graded)),
            'highest_grade' => isset($row->highest_grade) ? number_format((float) $row->highest_grade, 2, '.', '') : null,
            'lowest_grade' => isset($row->lowest_grade) ? number_format((float) $row->lowest_grade, 2, '.', '') : null,
        ];
    }

    private function decimal(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
