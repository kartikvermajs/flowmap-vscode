import type { ApiConnection } from '../../core/parser';

/**
 * Patterns to detect frontend API calls in Next.js files.
 * Captures: fetch("/api/..."), axios.get/post/put/delete/patch("/api/...")
 */
const FETCH_REGEX = /fetch\(\s*['"`](\/api\/[^'"`\s)]+)['"`]/g;
const AXIOS_REGEX = /axios\.(get|post|put|delete|patch)\(\s*['"`](\/api\/[^'"`\s)]+)['"`]/g;

const FRONTEND_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

function isFrontendFile(filePath: string): boolean {
  return FRONTEND_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Scan a single file's content for Next.js frontend API calls.
 * Returns an empty array for files that are unlikely to be frontend files.
 */
export function scanNextJs(content: string, relPath: string): ApiConnection[] {
  if (!isFrontendFile(relPath)) {
    return [];
  }

  const results: ApiConnection[] = [];

  // Detect fetch() calls
  let match: RegExpExecArray | null;
  while ((match = FETCH_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[1],
      method: 'unknown', // fetch does not expose method in the URL expression
      type: 'frontend',
    });
  }

  // Detect axios calls
  while ((match = AXIOS_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[2],
      method: match[1].toUpperCase(),
      type: 'frontend',
    });
  }

  return results;
}
