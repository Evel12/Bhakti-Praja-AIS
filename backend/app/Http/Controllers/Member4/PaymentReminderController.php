<?php

namespace App\Http\Controllers\Member4;

use App\Models\Invoice;
use App\Services\Member4\CommunicationService;
use Illuminate\Http\Request;

class PaymentReminderController extends Member4Controller
{
    public function store(Request $request, string $id, CommunicationService $communication)
    {
        if (! Invoice::whereKey($id)->exists()) return $this->missing();
        $result = $communication->remindPayment((int) $id);
        if (! $result['eligible']) return response()->json(['success' => false, 'message' => 'Tagihan sudah lunas dan tidak memerlukan pengingat.'], 409);
        return response()->json(['success' => true, 'message' => $result['created'] ? 'Pengingat pembayaran dibuat untuk penerima yang berhak.' : 'Tidak ada pengingat baru. Pengingat sudah tersedia atau belum ada akun penerima yang terhubung.', 'data' => $result]);
    }
}
