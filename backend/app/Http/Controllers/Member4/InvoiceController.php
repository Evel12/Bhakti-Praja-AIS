<?php

namespace App\Http\Controllers\Member4;

use App\Models\Invoice;
use App\Services\Member4\StudentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class InvoiceController extends Member4Controller
{
    public function __construct(private StudentAccess $access) {}

    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'student_id' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', Rule::in(['unpaid', 'paid'])],
            'invoice_type' => ['nullable', Rule::in(Invoice::TYPES)],
            'outstanding' => ['nullable', 'boolean'], 'overdue' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string', 'max:150'],
        ], $this->messages(['status.in' => 'Status tagihan tidak valid.', 'invoice_type.in' => 'Jenis tagihan tidak valid.']));
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $query = $this->access->invoices($request->user())->withFinanceTotals()->with('student:id,name,student_number')->orderByDesc('id');
        foreach (['student_id', 'status', 'invoice_type'] as $field) {
            if ($request->filled($field)) $query->where($field, $request->query($field));
        }
        if ($request->boolean('outstanding') || $request->boolean('overdue')) $query->outstanding();
        if ($request->boolean('overdue')) $query->whereDate('due_date', '<', now(config('member4_finance.timezone'))->toDateString());
        if ($request->filled('search')) {
            $search = '%'.trim($request->query('search')).'%';
            $query->whereHas('student', fn ($q) => $q->where(fn ($q) => $q->where('name', 'like', $search)->orWhere('student_number', 'like', $search)));
        }
        return $this->listing($query, $request);
    }

    public function show(Request $request, string $id)
    {
        $item = $this->access->invoices($request->user())->withFinanceTotals()->with('student:id,name,student_number')->find($id);
        return $item ? response()->json(['success' => true, 'data' => $item]) : $this->missing();
    }

    private function validation(Request $request, bool $updating = false)
    {
        $presence = $updating ? ['sometimes', 'required'] : ['required'];
        return Validator::make($request->all(), [
            'student_id' => [...$presence, 'integer', 'exists:students,id'],
            'invoice_type' => [...$presence, Rule::in(Invoice::TYPES)],
            // Exact decimal input: never calculate money using floating-point arithmetic.
            'amount' => [...$presence, 'numeric', 'gt:0', 'regex:/^\d{1,10}(\.\d{1,2})?$/'],
            'due_date' => [...$presence, 'date_format:Y-m-d'],
            'status' => ['missing'], 'created_by' => ['missing'],
        ], $this->messages([
            'student_id.required' => 'Murid wajib dipilih.', 'student_id.exists' => 'Murid tidak ditemukan.',
            'invoice_type.required' => 'Jenis tagihan wajib dipilih.', 'invoice_type.in' => 'Jenis tagihan tidak valid.',
            'amount.required' => 'Nominal tagihan wajib diisi.', 'amount.gt' => 'Nominal harus lebih dari nol.',
            'amount.regex' => 'Nominal maksimal sepuluh angka dan dua angka desimal.',
            'due_date.required' => 'Tenggat pembayaran wajib diisi.', 'due_date.date_format' => 'Tenggat harus memakai format YYYY-MM-DD.',
            'status.missing' => 'Status tagihan hanya dapat diubah melalui verifikasi pembayaran.',
            'created_by.missing' => 'Pembuat tagihan ditentukan oleh sistem.',
        ]));
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Invoice::class);
        $validator = $this->validation($request);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $item = Invoice::create($validator->validated() + ['created_by' => $request->user()->id]);
        return response()->json(['success' => true, 'message' => 'Tagihan berhasil dibuat.', 'data' => $item->fresh()], 201);
    }

    public function update(Request $request, string $id)
    {
        $validator = $this->validation($request, true);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        return DB::transaction(function () use ($request, $id, $validator) {
            $item = Invoice::whereKey($id)->lockForUpdate()->first();
            if (! $item) return $this->missing();
            Gate::authorize('update', $item);
            if ($item->status !== 'unpaid' || $item->payments()->exists()) {
                return response()->json(['success' => false, 'message' => 'Tagihan yang sudah memiliki pembayaran atau sudah lunas tidak dapat diubah.'], 409);
            }
            $item->update($validator->validated());
            return response()->json(['success' => true, 'message' => 'Tagihan berhasil diperbarui.', 'data' => $item->fresh()]);
        });
    }
}
