<?php

namespace App\Services\Member4;

/** Availability of upstream integrations; never substitutes fabricated academic records. */
class ParentAcademicData
{
    public const SECTIONS = ['grades', 'attendance', 'assignments', 'progress'];

    public function read(string $section): array
    {
        $messages = [
            'grades' => 'Informasi nilai akademik belum tersedia. Silakan periksa kembali nanti.',
            'attendance' => 'Informasi absensi belum tersedia. Silakan periksa kembali nanti.',
            'assignments' => 'Informasi tugas dan pengumpulannya belum tersedia. Silakan periksa kembali nanti.',
            'progress' => 'Informasi perkembangan akademik belum tersedia. Silakan periksa kembali nanti.',
        ];
        if (! isset($messages[$section])) throw new \InvalidArgumentException('Bagian akademik tidak dikenal.');

        // This checkout has no Member 2/3 models, migrations or read APIs. Wire their
        // published, student-scoped readers here once the contracts in STAGE-4.md exist.
        return ['available' => false, 'status' => 'unavailable', 'message' => $messages[$section], 'data' => null];
    }

    public function overview(): array
    {
        $sections = [];
        foreach (self::SECTIONS as $section) $sections[$section] = $this->read($section);
        return $sections;
    }
}
