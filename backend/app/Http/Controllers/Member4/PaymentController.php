<?php

namespace App\Http\Controllers\Member4;

use App\Models\Payment;
use App\Services\Member4\FinanceService;
use App\Services\Member4\StudentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PaymentController extends Member4Controller
{
    public function __construct(private StudentAccess $access) {}

    private function mutate(callable $action)
    {
        try {
            return $action();
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->invalid($e->errors());
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->missing();
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['success' => false, 'message' => 'Pembayaran gagal disimpan. Silakan coba kembali.'], 500);
        }
    }

    private function scope(Request $request)
    {
        return Payment::whereIn('invoice_id', $this->access->invoices($request->user())->select('invoices.id'))
            ->with(['invoice' => fn ($q) => $q->withFinanceTotals()->with('student:id,name,student_number'), 'submitter:id,name', 'verifier:id,name']);
    }

    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'invoice_id' => ['nullable', 'integer', 'min:1'],
            'student_id' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', Rule::in(['pending', 'verified', 'rejected'])],
        ], $this->messages(['status.in' => 'Status pembayaran tidak valid.']));
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $query = $this->scope($request)->orderByDesc('payment_date')->orderByDesc('id');
        if ($request->filled('student_id')) $query->whereHas('invoice', fn ($q) => $q->where('student_id', $request->query('student_id')));
        foreach (['invoice_id', 'status'] as $field) {
            if ($request->filled($field)) $query->where($field, $request->query($field));
        }
        return $this->listing($query, $request);
    }

    public function show(Request $request, string $id)
    {
        $item = $this->scope($request)->find($id);
        return $item ? response()->json(['success' => true, 'data' => $item]) : $this->missing();
    }

    public function store(Request $request, string $id, FinanceService $finance)
    {
        $invoice = $this->access->invoices($request->user())->find($id);
        if (! $invoice) return $this->missing();
        Gate::authorize('submitPayment', $invoice);
        $validator = Validator::make($request->all(), [
            'amount' => ['required', 'numeric', 'gt:0', 'regex:/^\d{1,10}(\.\d{1,2})?$/'],
            'payment_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now(config('member4_finance.timezone'))->toDateString()],
            'payment_method' => ['required', 'string', 'max:50'],
            'transaction_number' => ['nullable', 'string', 'max:100'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'extensions:jpg,jpeg,png,pdf', 'max:'.config('member4_finance.max_proof_kb')],
            'status' => ['missing'], 'submitted_by' => ['missing'], 'verified_by' => ['missing'], 'verified_at' => ['missing'], 'invoice_id' => ['missing'], 'proof_path' => ['missing'],
        ], $this->messages([
            'amount.regex' => 'Nominal maksimal sepuluh angka dan dua angka desimal.', 'amount.gt' => 'Nominal harus lebih dari nol.',
            'payment_date.date_format' => 'Tanggal pembayaran harus memakai format YYYY-MM-DD.',
            'payment_date.before_or_equal' => 'Tanggal pembayaran tidak boleh melewati hari ini.',
            'proof.required' => 'Bukti pembayaran wajib diunggah.', 'proof.file' => 'Bukti harus berupa berkas.',
            'proof.mimes' => 'Bukti harus berupa JPG, JPEG, PNG, atau PDF.', 'proof.extensions' => 'Ekstensi bukti harus JPG, JPEG, PNG, atau PDF.',
            'proof.max' => 'Ukuran bukti maksimal 2 MB.', 'proof.uploaded' => 'Bukti gagal diunggah. Periksa ukuran berkas.',
        ]), ['amount' => 'nominal pembayaran', 'payment_date' => 'tanggal pembayaran', 'payment_method' => 'metode pembayaran', 'transaction_number' => 'nomor transaksi', 'proof' => 'bukti pembayaran']);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $proof = $request->file('proof');
        $mime = $proof->getMimeType();
        $validContent = in_array($mime, ['image/jpeg', 'image/png'], true)
            ? @getimagesize($proof->getRealPath()) !== false
            : ($mime === 'application/pdf' && str_starts_with(file_get_contents($proof->getRealPath(), false, null, 0, 5), '%PDF-'));
        if (! $validContent) return $this->invalid(['proof' => ['Isi berkas bukti tidak valid.']]);
        return $this->mutate(function () use ($request, $id, $validator, $proof, $finance) {
            $payment = $finance->submit($request->user(), (int) $id, $validator->validated(), $proof);
            return response()->json(['success' => true, 'message' => 'Pembayaran diajukan dan menunggu verifikasi admin.', 'data' => $payment], 201);
        });
    }

    public function verify(Request $request, string $id, FinanceService $finance)
    {
        $payment = Payment::find($id);
        if (! $payment) return $this->missing();
        Gate::authorize('verify', $payment);
        $validator = Validator::make($request->all(), [
            'decision' => ['required', Rule::in(['verified', 'rejected'])],
            'status' => ['missing'], 'verified_by' => ['missing'], 'verified_at' => ['missing'], 'amount' => ['missing'],
        ], $this->messages(['decision.in' => 'Pilih keputusan terima atau tolak.', 'decision.required' => 'Keputusan verifikasi wajib dipilih.']));
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        return $this->mutate(function () use ($request, $id, $validator, $finance) {
            $payment = $finance->verify($request->user(), (int) $id, $validator->validated()['decision']);
            return response()->json(['success' => true, 'message' => 'Keputusan verifikasi berhasil disimpan.', 'data' => $this->scope($request)->find($payment->id)]);
        });
    }

    public function proof(Request $request, string $id)
    {
        $payment = $this->scope($request)->find($id);
        if (! $payment) return $this->missing();
        Gate::authorize('view', $payment);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'application/pdf' => 'pdf'];
        if (! isset($extensions[$payment->proof_mime]) || ! str_starts_with($payment->proof_path, 'payment-proofs/') || str_contains($payment->proof_path, '..') || ! Storage::disk('local')->exists($payment->proof_path)) {
            return response()->json(['success' => false, 'message' => 'Berkas bukti pembayaran tidak tersedia.'], 404);
        }
        return Storage::disk('local')->download($payment->proof_path, 'bukti-pembayaran-'.$payment->id.'.'.$extensions[$payment->proof_mime], [
            'Content-Type' => $payment->proof_mime, 'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store', 'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }
}
