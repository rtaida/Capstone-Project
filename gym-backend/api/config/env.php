<?php
declare(strict_types=1);

/**
 * Load local .env values into the PHP process when Apache does not provide
 * them as real environment variables. Existing process environment values
 * always take precedence.
 */
function capraLoadEnv(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envFile) || !is_readable($envFile)) {
        return;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $name = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        if ($name === '' || preg_match('/[^A-Za-z0-9_]/', $name)) {
            continue;
        }

        if (
            strlen($value) >= 2 &&
            (($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
             ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $existingValue = getenv($name);
        if ($existingValue === false || trim((string) $existingValue) === '') {
            putenv($name . '=' . $value);
        } else {
            putenv($name . '=' . $existingValue);
        }

        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}
