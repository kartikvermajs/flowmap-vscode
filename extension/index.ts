import * as vscode from 'vscode';
import * as path from 'path';
import { parseWorkspace, clearCache } from '../core/parser';
import { buildGraph } from '../graph/builder';

let currentPanel: vscode.WebviewPanel | undefined;
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[FlowMap] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[FlowMap] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[FlowMap] ${msg}`, ...args),
};

export function activate(context: vscode.ExtensionContext) {
  logger.info('Extension activated');
  const disposable = vscode.commands.registerCommand(
    'flowmap.scanProject',
    async () => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage(
            'FlowMap: No workspace folder open. Please open a project first.'
          );
          return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        logger.info('Scan started for:', workspaceRoot);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'FlowMap: Scanning project...',
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 10, message: 'Finding files...' });

            const fileUris = await vscode.workspace.findFiles(
              '**/*.{ts,tsx,js,jsx,mjs,cjs}',
              '{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,.git/**}'
            );
            const filePaths = fileUris.map((uri) => uri.fsPath);
            logger.info(`Found ${filePaths.length} files to scan`);

            progress.report({ increment: 40, message: `Parsing ${filePaths.length} files...` });

            const connections = await parseWorkspace(filePaths, workspaceRoot);
            logger.info(`Parsed connections: ${connections.length}`);

            progress.report({ increment: 30, message: 'Building graph...' });
            const graph = buildGraph(connections);

            progress.report({ increment: 20, message: 'Opening webview...' });
            showWebview(context, graph, workspaceRoot);
            logger.info('Scan completed');
          }
        );
      } catch (err: any) {
        logger.error('Scan failed:', err);
        vscode.window.showErrorMessage(`FlowMap: Scan failed. ${err.message || err}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function showWebview(
  context: vscode.ExtensionContext,
  graph: ReturnType<typeof buildGraph>,
  workspaceRoot: string
) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    currentPanel.reveal(column);
    currentPanel.webview.postMessage({ type: 'update', graph });
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'flowmap',
    'FlowMap',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
      ],
      retainContextWhenHidden: true,
    }
  );

  currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);

  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'ready':
          // Webview is mounted — send the current graph
          currentPanel?.webview.postMessage({ type: 'update', graph });
          break;

        case 'openFile': {
          const sourceFile: string = message.sourceFile;
          if (!sourceFile) { break; }
          const absPath = path.join(workspaceRoot, sourceFile);
          try {
            const doc = await vscode.workspace.openTextDocument(absPath);
            await vscode.window.showTextDocument(doc, { preview: false });
          } catch {
            vscode.window.showWarningMessage(`FlowMap: Cannot open file: ${sourceFile}`);
          }
          break;
        }

        case 'rescan':
          // User requested a re-scan from the webview
          clearCache();
          await vscode.commands.executeCommand('flowmap.scanProject');
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  currentPanel.onDidDispose(
    () => { currentPanel = undefined; },
    null,
    context.subscriptions
  );
}

function getWebviewContent(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'index.css')
  );

  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${styleUri}" />
    <title>FlowMap</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {}
