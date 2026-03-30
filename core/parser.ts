import * as fs from 'fs';
import * as path from 'path';
import { scanNextJs } from '../adapters/nextjs/index';
import { scanExpress } from '../adapters/express/index';

export interface ApiConnection {
  from: string;   // source file (relative to workspace root)
  to: string;     // API endpoint path, e.g. /api/users
  method: string; // GET, POST, etc. or 'unknown'
  type: 'frontend' | 'backend';
}

/**
 * Parse all provided workspace files and return discovered API connections.
 * @param filePaths   Absolute paths to all workspace files
 * @param workspaceRoot  Absolute path to the workspace root (for relative path display)
 */
export async function parseWorkspace(
  filePaths: string[],
  workspaceRoot: string
): Promise<ApiConnection[]> {
  const connections: ApiConnection[] = [];

  for (const absPath of filePaths) {
    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch {
      continue; // skip unreadable files
    }

    const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');

    // Run both adapters on every file – each one ignores files it doesn't care about
    const nextjsResults = scanNextJs(content, relPath);
    const expressResults = scanExpress(content, relPath);

    connections.push(...nextjsResults, ...expressResults);
  }

  return connections;
}
