import type { RawDetection } from '../../core/normalize';

/**
 * Detect frontend API calls in Next.js / React files.
 *
 * Supported patterns:
 *   fetch("/api/...")
 *   fetch("/api/...", { method: "POST" })
 *   axios.get("/api/...")  axios.post(...)  etc.
 *
 * Returns raw RawDetection[] — no normalization applied here.
 */

// fetch(plainStringUrl)  — with optional { method: "..." } options object
const FETCH_LITERAL_REGEX =
  /fetch\(\s*['"](\/?(?:\/api\/[^'"\s)]+))['"]\s*(?:,\s*\{[^}]*method\s*:\s*['"]([A-Za-z]+)['"][^}]*\})?/g;

// fetch(`/api/...`) — template literal (may contain ${...})
const FETCH_TEMPLATE_REGEX =
  /fetch\(\s*`(\/api\/[^`\s)]+)`/g;

// axios.<method>("/api/...")
const AXIOS_LITERAL_REGEX =
  /axios\.(get|post|put|delete|patch|head|options)\(\s*['"](\/?\/api\/[^'"\s)]+)['"]/g;

const FRONTEND_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.mjs']);
const SKIP_PATH_PATTERNS = [
  /node_modules/,
  /\.next\//,
  /dist\//,
  /build\//,
  /server\//,
  /pages\/api\//,
  /app\/api\//,
];

function isFrontendFile(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop();
  if (!FRONTEND_EXTENSIONS.has(ext)) { return false; }
  if (SKIP_PATH_PATTERNS.some((p) => p.test(filePath))) { return false; }
  return true;
}

export function scanNextJs(content: string, relPath: string): RawDetection[] {
  if (!isFrontendFile(relPath)) { return []; }

  const results: RawDetection[] = [];
  let match: RegExpExecArray | null;

  FETCH_LITERAL_REGEX.lastIndex = 0;
  while ((match = FETCH_LITERAL_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath:    match[1],
      method:     match[2] ? match[2].toUpperCase() : 'GET',
      type:       'frontend',
      pathKind:   'literal',
    });
  }

  FETCH_TEMPLATE_REGEX.lastIndex = 0;
  while ((match = FETCH_TEMPLATE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath:    match[1],
      method:     'GET',           // can't infer method from template alone
      type:       'frontend',
      pathKind:   'template',      // confidence 0.7
    });
  }

  AXIOS_LITERAL_REGEX.lastIndex = 0;
  while ((match = AXIOS_LITERAL_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath:    match[2],
      method:     match[1].toUpperCase(),
      type:       'frontend',
      pathKind:   'literal',
    });
  }

  return results;
}
