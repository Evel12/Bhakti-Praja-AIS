<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class MockCrudController extends Controller
{
    private array $allowedResources = [
        'users',
        'students',
        'teachers',
        'parents',
        'departments',
        'study-programs',
        'subjects',
        'academic-years',
        'semesters',
        'academic-calendars',
        'rooms',
        'classrooms',
        'curricula',
        'classes',
        'class-students',
        'academic-registrations',
        'schedules',
    ];

    private array $seed = [
        'users' => [
            [
                'id' => 1,
                'name' => 'Administrator',
                'email' => 'admin@akademik.test',
                'role' => 'admin',
                'status' => 'active',
            ],
            [
                'id' => 2,
                'name' => 'Budi Guru',
                'email' => 'budi@akademik.test',
                'role' => 'guru',
                'status' => 'active',
            ],
        ],

        'students' => [
            [
                'id' => 1,
                'student_number' => 'S001',
                'name' => 'Andi Pratama',
                'status' => 'active',
                'class_id' => 1,
            ],
            [
                'id' => 2,
                'student_number' => 'S002',
                'name' => 'Siti Rahma',
                'status' => 'active',
                'class_id' => 1,
            ],
        ],

        'teachers' => [
            [
                'id' => 1,
                'teacher_number' => 'T001',
                'name' => 'Budi Guru',
                'status' => 'active',
            ],
        ],

        'parents' => [
            [
                'id' => 1,
                'name' => 'Agus Pratama',
                'email' => 'agus@example.test',
                'status' => 'active',
            ],
        ],

        'departments' => [
            [
                'id' => 1,
                'code' => 'TK',
                'name' => 'Teknik Komputer',
                'status' => 'active',
            ],
        ],

        'study-programs' => [
            [
                'id' => 1,
                'code' => 'TK-S1',
                'name' => 'S1 Teknik Komputer',
                'department_id' => 1,
                'status' => 'active',
            ],
        ],

        'subjects' => [
            [
                'id' => 1,
                'code' => 'TK101',
                'name' => 'Pemrograman Dasar',
                'study_program_id' => 1,
                'status' => 'active',
            ],
        ],

        'academic-years' => [
            [
                'id' => 1,
                'name' => '2026/2027',
                'start_date' => '2026-07-01',
                'end_date' => '2027-06-30',
                'status' => 'active',
            ],
        ],

        'semesters' => [
            [
                'id' => 1,
                'name' => 'Ganjil',
                'academic_year_id' => 1,
                'period' => '2026/2027 Ganjil',
                'status' => 'active',
            ],
        ],

        'academic-calendars' => [],

        'rooms' => [
            [
                'id' => 1,
                'code' => 'R-101',
                'name' => 'Ruang 101',
                'capacity' => 30,
                'location' => 'Gedung A',
                'status' => 'active',
            ],
        ],

        'classrooms' => [
            [
                'id' => 1,
                'name' => 'TK-A',
                'level' => '1',
                'study_program_id' => 1,
                'academic_year_id' => 1,
                'status' => 'active',
            ],
        ],

        'curricula' => [
            [
                'id' => 1,
                'name' => 'Kurikulum 2026',
                'period' => '2026/2027',
                'study_program_id' => 1,
                'status' => 'active',
            ],
        ],

        'classes' => [],
        'class-students' => [],
        'academic-registrations' => [],
        'schedules' => [],
    ];

    private function ensureResource(string $resource): void
    {
        abort_unless(
            in_array(
                $resource,
                $this->allowedResources,
                true
            ),
            404
        );
    }

    private function getData(
        Request $request,
        string $resource
    ): array {
        $key = "mock_data.$resource";

        $data = $request->session()->get($key);

        if ($data === null) {
            $data = $this->seed[$resource] ?? [];

            $request->session()->put(
                $key,
                $data
            );
        }

        return $data;
    }

    private function saveData(
        Request $request,
        string $resource,
        array $data
    ): void {
        $request->session()->put(
            "mock_data.$resource",
            array_values($data)
        );
    }

    public function index(
        Request $request,
        string $resource
    ) {
        $this->ensureResource($resource);

        $items = $this->getData(
            $request,
            $resource
        );

        $search = trim(
            (string) $request->query(
                'search',
                ''
            )
        );

        if ($search !== '') {
            $items = array_values(
                array_filter(
                    $items,
                    function ($item) use ($search) {
                        return Str::contains(
                            Str::lower(
                                json_encode($item)
                            ),
                            Str::lower($search)
                        );
                    }
                )
            );
        }

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'total' => count($items),
            ],
        ]);
    }

    public function store(
        Request $request,
        string $resource
    ) {
        $this->ensureResource($resource);

        $validator = Validator::make(
            $request->all(),
            [
                'name' => [
                    'nullable',
                    'string',
                    'max:150',
                ],

                'email' => [
                    'nullable',
                    'email',
                    'max:150',
                ],

                'code' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'status' => [
                    'nullable',
                    'in:active,inactive',
                ],
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $this->getData(
            $request,
            $resource
        );

        $ids = array_column(
            $data,
            'id'
        );

        $newId = empty($ids)
            ? 1
            : max($ids) + 1;

        $item = $request->except([
            '_token',
        ]);

        $item['id'] = $newId;

        $item['status'] =
            $item['status'] ??
            'active';

        $data[] = $item;

        $this->saveData(
            $request,
            $resource,
            $data
        );

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil dibuat.',
            'data' => $item,
        ], 201);
    }

    public function show(
        Request $request,
        string $resource,
        string $id
    ) {
        $this->ensureResource($resource);

        $items = $this->getData(
            $request,
            $resource
        );

        foreach ($items as $item) {
            if (
                (string) $item['id'] ===
                (string) $id
            ) {
                return response()->json([
                    'success' => true,
                    'data' => $item,
                ]);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Data tidak ditemukan.',
        ], 404);
    }

    public function update(
        Request $request,
        string $resource,
        string $id
    ) {
        $this->ensureResource($resource);

        $items = $this->getData(
            $request,
            $resource
        );

        foreach ($items as $index => $item) {
            if (
                (string) $item['id'] ===
                (string) $id
            ) {
                $items[$index] = array_merge(
                    $item,
                    $request->except([
                        '_token',
                        'id',
                    ])
                );

                $this->saveData(
                    $request,
                    $resource,
                    $items
                );

                return response()->json([
                    'success' => true,
                    'message' =>
                        'Data berhasil diperbarui.',
                    'data' => $items[$index],
                ]);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Data tidak ditemukan.',
        ], 404);
    }

    public function destroy(
        Request $request,
        string $resource,
        string $id
    ) {
        $this->ensureResource($resource);

        $items = $this->getData(
            $request,
            $resource
        );

        $filtered = array_values(
            array_filter(
                $items,
                fn ($item) =>
                    (string) $item['id'] !==
                    (string) $id
            )
        );

        if (
            count($filtered) ===
            count($items)
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Data tidak ditemukan.',
            ], 404);
        }

        $this->saveData(
            $request,
            $resource,
            $filtered
        );

        return response()->json([
            'success' => true,
            'message' =>
                'Data berhasil dihapus.',
        ]);
    }
}
