<?php

namespace App\Http\Controllers\Member4;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

abstract class Member4Controller extends Controller
{
    protected function messages(array $custom = []): array
    {
        return $custom + [
            'required' => 'Kolom :attribute wajib diisi.', 'integer' => 'Kolom :attribute harus berupa bilangan bulat.',
            'numeric' => 'Nominal harus berupa angka.', 'string' => 'Kolom :attribute harus berupa teks.',
            'min.numeric' => 'Nilai :attribute minimal :min.', 'max.string' => 'Kolom :attribute maksimal :max karakter.',
            'max.numeric' => 'Nilai :attribute maksimal :max.',
            'boolean' => 'Status baca harus bernilai 0 atau 1.', 'missing' => 'Kolom :attribute tidak boleh dikirim.',
        ];
    }

    protected function listing(Builder $query, Request $request)
    {
        $validator = Validator::make($request->query(), [
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ], $this->messages());
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $page = $query->paginate(max(1, min(100, (int) $request->query('per_page', 15))));
        return response()->json(['success' => true, 'data' => $page->items(), 'meta' => [
            'current_page' => $page->currentPage(), 'per_page' => $page->perPage(),
            'total' => $page->total(), 'last_page' => $page->lastPage(),
        ]]);
    }

    protected function invalid(array $errors)
    {
        return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $errors], 422);
    }

    protected function missing()
    {
        return response()->json(['success' => false, 'message' => 'Data tidak ditemukan atau tidak dapat diakses.'], 404);
    }
}
