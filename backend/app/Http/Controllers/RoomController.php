<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    public function index(Request $request)
    {
        $query = Room::orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = Room::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Ruang tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', 'max:30', 'unique:rooms,code'],
            'name' => ['required', 'string', 'max:100'],
            'capacity' => ['required', 'integer', 'min:1', 'max:1000'],
            'location' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'maintenance'])],
        ], [
            'code.required' => 'Kode ruang wajib diisi.',
            'code.unique' => 'Kode ruang sudah digunakan.',
            'name.required' => 'Nama ruang wajib diisi.',
            'capacity.required' => 'Kapasitas wajib diisi.',
            'capacity.min' => 'Kapasitas minimal 1.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = Room::create($request->only(['code', 'name', 'capacity', 'location']) + [
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Ruang berhasil dibuat.', 'data' => $item], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Room::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Ruang tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('rooms', 'code')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'capacity' => ['sometimes', 'required', 'integer', 'min:1', 'max:1000'],
            'location' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'maintenance'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['code', 'name', 'capacity', 'location', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Ruang berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Room::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Ruang tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Ruang berhasil dihapus.']);
    }
}
