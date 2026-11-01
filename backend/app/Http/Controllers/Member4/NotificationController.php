<?php

namespace App\Http\Controllers\Member4;

use App\Models\PortalNotification;
use App\Services\Member4\NotificationAccess;
use Illuminate\Validation\Rule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NotificationController extends Member4Controller
{
    public function __construct(private NotificationAccess $access) {}
    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), ['is_read' => ['nullable', 'boolean'], 'category' => ['nullable', Rule::in(['announcement', 'payment_reminder'])]], $this->messages(['category.in' => 'Kategori notifikasi tidak valid.']));
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $query = $this->access->forUser($request->user())->orderByDesc('id');
        if ($request->filled('category')) $query->where('category', $request->query('category'));
        if ($request->filled('is_read')) $query->where('is_read', $request->boolean('is_read'));
        return $this->listing($query, $request);
    }

    public function markRead(Request $request, string $id)
    {
        $item = $this->access->forUser($request->user())->find($id);
        if (! $item) return $this->missing();
        $item->is_read = true;
        $item->save();
        return response()->json(['success' => true, 'message' => 'Notifikasi ditandai sudah dibaca.', 'data' => $item]);
    }
}
