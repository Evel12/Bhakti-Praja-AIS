<?php

namespace App\Http\Controllers\Member4;

use App\Models\Invoice;
use App\Services\Member4\FinanceSummary;
use Illuminate\Http\Request;

class FinanceReportController extends Member4Controller
{
    public function __construct(private FinanceSummary $finance) {}

    private function totals(Request $request, ?string $type = null): array
    {
        return $this->finance->forUser($request->user(), null, $type);
    }

    public function summary(Request $request)
    {
        return response()->json(['success' => true, 'data' => $this->totals($request) + ['as_of' => now(config('member4_finance.timezone'))->toIso8601String()]]);
    }

    public function report(Request $request)
    {
        $groups = [];
        foreach (Invoice::TYPES as $type) $groups[] = ['invoice_type' => $type] + $this->totals($request, $type);
        return response()->json(['success' => true, 'data' => ['summary' => $this->totals($request), 'by_type' => $groups, 'as_of' => now(config('member4_finance.timezone'))->toIso8601String()]]);
    }
}
