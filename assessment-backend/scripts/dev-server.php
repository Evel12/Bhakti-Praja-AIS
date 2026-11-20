<?php

declare(strict_types=1);

/**
 * Local development launcher for assessment-backend.
 * Runs the HTTP API server (:8002, 25 MB upload limits) and the
 * `quiz-generation` queue worker concurrently in one terminal.
 */

$baseDir = dirname(__DIR__);
$php = PHP_BINARY;
$host = getenv('ASSESSMENT_HOST') ?: '127.0.0.1';
$port = getenv('ASSESSMENT_PORT') ?: '8002';

$httpCmd = [
    $php,
    '-d', 'upload_max_filesize=25M',
    '-d', 'post_max_size=25M',
    '-d', 'memory_limit=256M',
    '-d', 'max_execution_time=120',
    '-d', 'display_errors=0',
    '-d', 'html_errors=0',
    'artisan',
    'serve',
    "--host={$host}",
    "--port={$port}",
    '--no-reload',
];

$workerCmd = [
    $php,
    'artisan',
    'queue:work',
    'quiz-generation',
    '--queue=quiz-generation,default',
    '--tries=3',
    '--timeout=150',
    '--sleep=1',
    '-v',
];

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

function startChild(array $cmd, string $cwd, array $descriptors): array
{
    $pipes = [];
    $proc = proc_open($cmd, $descriptors, $pipes, $cwd);
    if (! is_resource($proc)) {
        fwrite(STDERR, "Failed to start process: ".implode(' ', $cmd).PHP_EOL);
        exit(1);
    }
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    return ['proc' => $proc, 'stdout' => $pipes[1], 'stderr' => $pipes[2]];
}

function drainStream($stream, string $prefix, $target): void
{
    while (($line = fgets($stream)) !== false) {
        fwrite($target, "[{$prefix}] {$line}");
    }
}

function stopChild(array &$child): void
{
    if (is_resource($child['stdout'] ?? null)) {
        fclose($child['stdout']);
    }
    if (is_resource($child['stderr'] ?? null)) {
        fclose($child['stderr']);
    }
    if (is_resource($child['proc'] ?? null)) {
        $status = proc_get_status($child['proc']);
        if ($status['running']) {
            if (PHP_OS_FAMILY === 'Windows' && ! empty($status['pid'])) {
                @exec('taskkill /T /F /PID '.(int) $status['pid'].' 2>NUL');
            }
            @proc_terminate($child['proc']);
        }
        proc_close($child['proc']);
    }
}

fwrite(STDOUT, "Starting assessment-backend HTTP (http://{$host}:{$port}) + AI quiz-generation worker...\n");
$http = startChild($httpCmd, $baseDir, $descriptors);
$worker = startChild($workerCmd, $baseDir, $descriptors);

$shutdown = false;
register_shutdown_function(static function () use (&$http, &$worker): void {
    stopChild($worker);
    stopChild($http);
});

if (function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGINT, static function () use (&$shutdown): void { $shutdown = true; });
    pcntl_signal(SIGTERM, static function () use (&$shutdown): void { $shutdown = true; });
}

while (! $shutdown) {
    drainStream($http['stdout'], 'http', STDOUT);
    drainStream($http['stderr'], 'http', STDERR);
    drainStream($worker['stdout'], 'worker', STDOUT);
    drainStream($worker['stderr'], 'worker', STDERR);

    $httpStatus = proc_get_status($http['proc']);
    if (! $httpStatus['running']) {
        drainStream($http['stdout'], 'http', STDOUT);
        drainStream($http['stderr'], 'http', STDERR);
        fwrite(STDERR, "[http] Server exited with code {$httpStatus['exitcode']}.\n");
        exit((int) ($httpStatus['exitcode'] ?: 1));
    }

    $workerStatus = proc_get_status($worker['proc']);
    if (! $workerStatus['running']) {
        drainStream($worker['stdout'], 'worker', STDOUT);
        drainStream($worker['stderr'], 'worker', STDERR);
        fwrite(STDERR, "[worker] Queue worker exited ({$workerStatus['exitcode']}); restarting in 2s...\n");
        stopChild($worker);
        sleep(2);
        $worker = startChild($workerCmd, $baseDir, $descriptors);
    }

    usleep(100000);
}

exit(0);
