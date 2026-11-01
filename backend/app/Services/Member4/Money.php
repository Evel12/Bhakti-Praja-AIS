<?php

namespace App\Services\Member4;

final class Money
{
    public static function cents(string|int|float|null $amount): int
    {
        $value = (string) ($amount ?? '0');
        if (! preg_match('/^(\d{1,15})(?:\.(\d{1,2}))?$/', $value, $matches)) {
            throw new \InvalidArgumentException('Format nominal keuangan tidak valid.');
        }
        return ((int) $matches[1]) * 100 + (int) str_pad($matches[2] ?? '', 2, '0');
    }

    public static function decimal(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
