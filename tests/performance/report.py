"""Aggregate k6 summaries and raw points without exporting account credentials."""
import argparse
import collections
import contextlib
import datetime as dt
import gzip
import json
from pathlib import Path
import statistics


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--results', default='.tools/k6/results')
    parser.add_argument('--mode', choices=['local', 'cloud'], default='local')
    parser.add_argument('--output', default='docs/performance/k6-results-2026-11-14')
    parser.add_argument('--cloud-status', default='.tools/k6/results/cloud-run-status.json')
    args = parser.parse_args()
    results = Path(args.results)
    cloud_runs = json.loads(Path(args.cloud_status).read_text(encoding='utf-8-sig')) if args.mode == 'cloud' and Path(args.cloud_status).exists() else []
    report = []
    for concurrency in (10, 25, 50):
        stem = f'{args.mode}-lms-{concurrency}'
        summary = json.loads((results / f'{stem}.summary.json').read_text(encoding='utf-8-sig'))
        metrics = summary['metrics']
        names = collections.defaultdict(list)
        statuses = collections.Counter()
        responses = []
        peaks = []
        raw_path = results / f'{stem}.metrics.json.gz'
        with (gzip.open(raw_path, 'rt', encoding='utf-8') if raw_path.exists() else contextlib.nullcontext([])) as stream:
            for line in stream:
                point = json.loads(line)
                if point.get('type') != 'Point':
                    continue
                data = point['data']
                if point['metric'] == 'vus' and data['value'] == concurrency:
                    peaks.append(data['time'])
                if point['metric'] == 'http_req_duration':
                    names[data['tags']['name']].append(data['value'])
                    statuses[data['tags'].get('status', 'transport-error')] += 1
                    responses.append((data['time'], data['value']))
        max_vus = metrics['vus']['values']['max']
        if max_vus < concurrency:
            raise ValueError(f'Target concurrency {concurrency} was not reached.')
        steady = [value for timestamp, value in responses if peaks and min(peaks) <= timestamp <= max(peaks)]
        thresholds = {f'{name}: {condition}': result['ok'] for name, metric in metrics.items() for condition, result in metric.get('thresholds', {}).items()}
        row = {
            'users': concurrency, 'max_observed_vus': max_vus,
            'requests': metrics['http_reqs']['values']['count'],
            'requests_per_second': metrics['http_reqs']['values']['rate'],
            'duration_seconds': summary['state']['testRunDurationMs'] / 1000,
            'http_failure_rate': metrics['http_req_failed']['values']['rate'],
            'application_failure_rate': metrics['application_failure_rate']['values']['rate'],
            'rate_limited_rate': metrics['rate_limited_rate']['values']['rate'],
            'response_ms': metrics['http_req_duration']['values'],
            'steady_peak_response_p95_ms': percentile(steady, .95),
            'status_counts': dict(statuses) if raw_path.exists() else None, 'thresholds': thresholds,
            'passed': all(thresholds.values()),
            'endpoints': {name: {'requests': len(values), 'avg_ms': statistics.mean(values), 'p95_ms': percentile(values, .95)} for name, values in sorted(names.items())},
            'html_report': (results / f'{stem}.html').resolve().as_posix(),
            'cloud_run': next((run for run in cloud_runs if run['users'] == concurrency), None),
        }
        report.append(row)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    document = {
        'generated_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'target': 'http://127.0.0.1:8086',
        'execution': 'local Apache 2.4 / PHP 8.2.12, 64 threads, isolated SQLite WAL',
        'grafana_stack': 'https://tancoconut1625.grafana.net/',
        'cloud_authenticated_run': args.mode == 'cloud',
        'cloud_run_status': cloud_runs,
        'runs': report,
    }
    output.with_suffix('.json').write_text(json.dumps(document, indent=2), encoding='utf-8')
    lines = [
        '# Hasil uji pengguna bersamaan LMS', '',
        'Lingkungan: Apache 2.4 / PHP 8.2.12, 64 thread, database SQLite WAL terpisah.',
        'Beban: sekitar 10% guru dan 90% murid, masing-masing menggunakan akun/token berbeda.',
        'Setiap tingkat beban naik selama 10 detik, bertahan 30 detik, lalu turun 5 detik.', '',
        '| Pengguna bersamaan | Request | Rata-rata (ms) | p95 (ms) | p99 (ms) | Gagal HTTP | HTTP 429 | Hasil |',
        '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ]
    for row in report:
        value = row['response_ms']
        lines.append(f"| {row['users']} | {row['requests']} | {value['avg']:.2f} | {value['p(95)']:.2f} | {value['p(99)']:.2f} | {100 * row['http_failure_rate']:.2f}% | {100 * row['rate_limited_rate']:.2f}% | {'Lulus' if row['passed'] else 'Tidak lulus'} |")
    lines += ['', 'p95 berarti 95% request selesai dalam waktu tersebut atau lebih cepat.',
              'Kriteria sementara: kegagalan HTTP/aplikasi <1%, HTTP 429 <1%, p95 <2 detik dan p99 <5 detik.', '',
              '## Rincian dan dashboard', '']
    for row in report:
        lines += [f"### {row['users']} pengguna", '',
                  f"- Konkurensi maksimum teramati: {row['max_observed_vus']} VU.",
                  f"- Laju request rata-rata: {row['requests_per_second']:.2f}/detik.",
                  f"- Status HTTP: {row['status_counts'] if row['status_counts'] is not None else 'rincian tersedia di Grafana Cloud; tidak diekspor sebagai raw JSON lokal'}.",
                  f"- Dashboard HTML: [buka laporan]({row['html_report']}).", '',
                  ]
        if row['endpoints']:
            lines += ['| Endpoint | Request | Rata-rata (ms) | p95 (ms) |', '| --- | ---: | ---: | ---: |']
        for name, endpoint in row['endpoints'].items():
            lines.append(f"| `{name}` | {endpoint['requests']} | {endpoint['avg_ms']:.2f} | {endpoint['p95_ms']:.2f} |")
        if row['cloud_run']:
            run = row['cloud_run']
            lines += ['', f"Grafana Cloud: [buka run {run['id']}]({run['url']}); status: **{run['status']}**, hasil: **{run['result']}**."]
        lines.append('')
    lines += [
        '## Batas interpretasi', '',
        '- Ini baseline lokal berdurasi singkat pada mesin yang juga menjalankan k6; bukan jaminan kapasitas produksi atau uji ketahanan jangka panjang.',
        '- Jadwal akademik kosong dan PDF sintetis kecil; hasil tidak mengukur bandwidth dokumen besar.',
        '- Login massal, render browser, generasi AI dan fitur assessment tidak termasuk beban ini.',
        '- Hasil awal dengan storage Apache salah dikonfigurasi disimpan di `.tools/k6/results/storage-misconfigured/` dan tidak digunakan dalam tabel ini. Jalur storage pada server uji diperbaiki sebelum pengukuran ulang; kode aplikasi tidak diubah.',
        '- Database, akun, token dan file fixture terpisah dari data aplikasi.', '',
        '## Grafana Cloud', '',
        ('Hasil ini berasal dari eksekusi lokal dengan pengiriman ke Grafana Cloud; lihat URL run yang dicetak k6.' if args.mode == 'cloud' else
         'Grafana stack dapat dijangkau, tetapi pengiriman ke Grafana Cloud belum diverifikasi karena autentikasi k6 lokal belum tersedia. Laporan lokal di atas bukan bukti hasil sudah masuk Grafana.'), '',
        'Panduan menjalankan ulang dan autentikasi: [tests/performance/README.md](../../tests/performance/README.md).',
    ]
    output.with_suffix('.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps([{'users': r['users'], 'requests': r['requests'], 'p95_ms': r['response_ms']['p(95)'], 'failure_rate': r['http_failure_rate'], 'passed': r['passed']} for r in report], indent=2))


if __name__ == '__main__':
    main()
