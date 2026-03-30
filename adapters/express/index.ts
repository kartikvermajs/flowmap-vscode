import type { ApiConnection } from '../../core/parser';

/**
 * Patterns to detect Express route declarations.
 * Covers: app.get/post/put/delete/patch() and router.get/post/put/delete/patch()
 */
const ROUTE_REGEX =
  /(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`](\/[^'"`\s)]+)['"`]/g;

/**
 * Scan a single file's content for Express route definitions.
 */
export function scanExpress(content: string, relPath: string): ApiConnection[] {
  // Only look at JS/TS files
  if (!/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(relPath)) {
    return [];
  }

  const results: ApiConnection[] = [];
  let match: RegExpExecArray | null;

  while ((match = ROUTE_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[2],
      method: match[1].toUpperCase(),
      type: 'backend',
    });
  }

  return results;
}
