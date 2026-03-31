import * as fs from 'fs';
import * as path from 'path';
import { scanNextJs } from '../adapters/nextjs/index';
import { scanExpress } from '../adapters/express/index';
import { normalizeDetections, type ApiCall, type RawDetection } from './normalize';

// Re-export ApiCall so graph/builder and extension code can import from one place
export type { ApiCall };

/**
 * In-memory file cache: absPath → { mtime, normalized ApiCalls }
 * Files that have not changed since the last scan are reused as-is.
 */
const fileCache = new Map<string, { mtime: number; results: ApiCall[] }>();

/** Bust the cache — call this before a user-triggered re-scan. */
export function clearCache(): void {
  fileCache.clear();
}

/**
 * Scan all provided workspace files, normalize detections, deduplicate,
 * and return a clean ApiCall[] ready for the graph builder.
 *
 * @param filePaths     Absolute paths of files to scan
 * @param workspaceRoot Absolute path of the workspace root (for relative paths)
 * @param minConfidence Drop detections below this score (default 0 = keep all)
 */
export async function parseWorkspace(
  filePaths: string[],
  workspaceRoot: string,
  minConfidence = 0.0
): Promise<ApiCall[]> {
  const allCalls: ApiCall[] = [];

  for (const absPath of filePaths) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }

    const mtime = stat.mtimeMs;
    const cached = fileCache.get(absPath);

    if (cached && cached.mtime === mtime) {
      // Unchanged file — reuse cached normalized results
      allCalls.push(...cached.results);
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }

    const sourceFile = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');

    const raw: RawDetection[] = [
      ...scanNextJs(content, sourceFile),
      ...scanExpress(content, sourceFile),
    ];

    const normalized = normalizeDetections(raw, minConfidence);

    if (normalized.length > 0) {
      console.log(`[FlowMap] Detected ${normalized.length} calls in ${sourceFile}`);
      normalized.forEach(c => 
        console.log(`  - [${c.type}] ${c.method} ${c.normalizedPath} (conf: ${c.confidence})`)
      );
    }

    fileCache.set(absPath, { mtime, results: normalized });
    allCalls.push(...normalized);
  }

  // Key: type + sourceFile + method + normalizedPath
  const seen = new Set<string>();
  const unique: ApiCall[] = [];

  for (const call of allCalls) {
    const key = `${call.type}::${call.sourceFile}::${call.method}::${call.normalizedPath}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    }
  }

  return unique;
}
