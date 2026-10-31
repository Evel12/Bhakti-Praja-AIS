<?php

namespace App\Http\Controllers\Member4;

use App\Models\Announcement;
use App\Models\PortalNotification;
use App\Services\Member4\CommunicationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AnnouncementController extends Member4Controller
{
    public function __construct(private CommunicationService $communication) {}
    private function scope(Request $request)
    {
        $query = Announcement::query();
        if (! $request->user()->isAdmin()) {
            $query->whereIn('target_role', ['all', $request->user()->role->name]);
        }
        return $query;
    }

    public function index(Request $request)
    {
        return $this->listing($this->scope($request)->orderByDesc('id'), $request);
    }

    public function show(Request $request, string $id)
    {
        $item = $this->scope($request)->find($id);
        return $item ? response()->json(['success' => true, 'data' => $item]) : $this->missing();
    }

    private function validation(Request $request, bool $updating = false)
    {
        $presence = $updating ? ['sometimes', 'required'] : ['required'];
        return Validator::make($request->all(), [
            'title' => [...$presence, 'string', 'max:255'],
            'content' => ['bail', ...$presence, 'string', 'max:20000', function ($attribute, $value, $fail) {
                // MySQL TEXT holds at most 65,535 bytes, independently of the
                // character limit. Validate before either source or notification insert.
                if (strlen($value) > 65535) $fail('Isi pengumuman terlalu panjang untuk disimpan. Kurangi panjang teks.');
            }],
            'target_role' => [...$presence, Rule::in(Announcement::TARGET_ROLES)],
            'created_by' => ['missing'], 'course_id' => ['missing'],
        ], $this->messages([
            'title.required' => 'Judul pengumuman wajib diisi.',
            'content.required' => 'Isi pengumuman wajib diisi.',
            'target_role.required' => 'Penerima pengumuman wajib dipilih.',
            'target_role.in' => 'Peran penerima tidak valid.',
            'created_by.missing' => 'Pembuat pengumuman ditentukan oleh sistem.',
            'course_id.missing' => 'Pengumuman kelas dikelola melalui modul LMS.',
        ]));
    }

    public function store(Request $request)
    {
        $validator = $this->validation($request);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $item = DB::transaction(function () use ($validator, $request) {
            $item = Announcement::create($validator->validated() + ['created_by' => $request->user()->id]);
            $this->communication->syncAnnouncement($item);
            return $item;
        });
        return response()->json(['success' => true, 'message' => 'Pengumuman berhasil dibuat.', 'data' => $item], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Announcement::find($id);
        if (! $item) return $this->missing();
        $validator = $this->validation($request, true);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $item = DB::transaction(function () use ($id, $validator) {
            $item = Announcement::whereKey($id)->lockForUpdate()->firstOrFail();
            $item->update($validator->validated());
            $this->communication->syncAnnouncement($item);
            return $item;
        });
        return response()->json(['success' => true, 'message' => 'Pengumuman berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Announcement::find($id);
        if (! $item) return $this->missing();
        DB::transaction(function () use ($item) {
            Announcement::whereKey($item->id)->lockForUpdate()->firstOrFail();
            PortalNotification::where('category', 'announcement')->where('source_id', $item->id)->delete();
            $item->delete();
        });
        return response()->json(['success' => true, 'message' => 'Pengumuman berhasil dihapus.']);
    }
}
