/**
 * Sits between adapters and the graph builder.
 * Adapters emit raw RawDetection objects; this module normalizes them into
 * well-typed ApiCall objects that the graph builder can safely consume.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Raw output from any adapter — minimal, no normalization applied. */
export interface RawDetection {
  sourceFile: string;               // relative path to the file
  rawPath: string;                  // the path string exactly as found in source
  method?: string;                  // HTTP verb as found; undefined = unknown
  type: 'frontend' | 'backend';

  /**
   * Hint about how the path was detected.
   * Adapters set this so the normalizer can assign the right confidence score.
   *   'literal'  — a plain quoted string, e.g. "/api/users"
   *   'template' — a template literal, e.g. `/api/${id}`
   *   'variable' — a variable reference, e.g. fetch(url)
   */
  pathKind: 'literal' | 'template' | 'variable';
}

/** Normalized, confidence-scored API call ready for the graph builder. */
export type ApiCall = {
  sourceFile: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'ALL' | 'unknown';
  rawPath: string;
  normalizedPath: string;
  confidence: number;               // 0.0 – 1.0
  type: 'frontend' | 'backend';
};

// ─── Confidence scoring ───────────────────────────────────────────────────────

const CONFIDENCE: Record<RawDetection['pathKind'], number> = {
  literal:  1.0,
  template: 0.7,
  variable: 0.4,
};

// ─── Path normalization ───────────────────────────────────────────────────────

/**
 * Normalize a raw API path:
 *  1. Strip query string (everything from '?' onward)
 *  2. Strip fragment   (everything from '#' onward)
 *  3. Collapse duplicate slashes  (//foo → /foo)
 *  4. Ensure it starts with '/'
 *  5. Remove trailing slash (except bare '/')
 */
export function normalizePath(raw: string): string {
  let p = raw;

  // 1 & 2 — strip query / fragment
  p = p.split('?')[0].split('#')[0];

  // 3 — collapse duplicate slashes
  p = p.replace(/\/\/+/g, '/');

  // 4 — ensure leading slash
  if (!p.startsWith('/')) { p = '/' + p; }

  // 5 — remove trailing slash (unless root)
  if (p.length > 1) { p = p.replace(/\/+$/, ''); }

  return p;
}

// ─── Coerce method string to the ApiCall union ───────────────────────────────

type AllowedMethod = ApiCall['method'];
const ALLOWED_METHODS = new Set<string>([
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL',
]);

function coerceMethod(raw: string | undefined): AllowedMethod {
  if (!raw) { return 'unknown'; }
  const upper = raw.toUpperCase();
  return ALLOWED_METHODS.has(upper) ? (upper as AllowedMethod) : 'unknown';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an array of raw adapter detections into normalized ApiCall objects.
 *
 * Detections with a confidence below `minConfidence` are filtered out,
 * making it easy for the caller to drop speculative matches.
 */
export function normalizeDetections(
  detections: RawDetection[],
  minConfidence = 0.0
): ApiCall[] {
  const calls: ApiCall[] = [];

  for (const d of detections) {
    const confidence = CONFIDENCE[d.pathKind] ?? 0.4;
    if (confidence < minConfidence) { continue; }

    calls.push({
      sourceFile:     d.sourceFile,
      method:         coerceMethod(d.method),
      rawPath:        d.rawPath,
      normalizedPath: normalizePath(d.rawPath),
      confidence,
      type:           d.type,
    });
  }

  return calls;
}
