import type { RawDetection } from '../../core/normalize';

/**
 * Detect Express route declarations.
 * Supported patterns:
 *   app.get("/api/...")
 *   router.post("/api/...")
 *   app.use("/api/...", handler)   → treated as method ALL
 *
 * Returns raw RawDetection[] — no normalization applied here.
 */

// app|router .<verb>( "path" )
const ROUTE_REGEX =
  /(?:app|router)\.(get|post|put|delete|patch|head|options|use)\(\s*['"](\/?\/[^'"\s)]+)['"]/g;

// app|router .<verb>( `template` )
const ROUTE_TEMPLATE_REGEX =
  /(?:app|router)\.(get|post|put|delete|patch|head|options|use)\(\s*`(\/[^`\s)]+)`/g;

export function scanExpress(content: string, relPath: string): RawDetection[] {
  // Only process JS/TS files
  if (!/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(relPath)) { return []; }

  // Heuristic: skip clear React component files that lack any Express usage
  const hasExpressImport =
    /require\s*\(\s*['"`]express['"`]/.test(content) ||
    /from\s+['"`]express['"`]/.test(content) ||
    /(?:app|router)\s*=\s*(?:express\(\)|Router\(\)|express\.Router\(\))/.test(content);

  if (!hasExpressImport && /\.(tsx|jsx)$/.test(relPath)) { return []; }

  const results: RawDetection[] = [];
  let match: RegExpExecArray | null;

  // Literal string routes
  ROUTE_REGEX.lastIndex = 0;
  while ((match = ROUTE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath:    match[2],
      method:     match[1].toUpperCase() === 'USE' ? 'ALL' : match[1].toUpperCase(),
      type:       'backend',
      pathKind:   'literal',
    });
  }

  // Template literal routes
  ROUTE_TEMPLATE_REGEX.lastIndex = 0;
  while ((match = ROUTE_TEMPLATE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath:    match[2],
      method:     match[1].toUpperCase() === 'USE' ? 'ALL' : match[1].toUpperCase(),
      type:       'backend',
      pathKind:   'template',     // confidence 0.7
    });
  }

  return results;
}
