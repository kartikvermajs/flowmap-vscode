import * as vscode from 'vscode';
import * as path from 'path';
import { parseWorkspace, clearCache } from '../core/parser';
import { buildGraph } from '../graph/builder';

let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'flowmap.scanProject',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          'FlowMap: No workspace folder open. Please open a project first.'
        );
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'FlowMap: Scanning project...',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ increment: 10, message: 'Finding files...' });

          // Find all relevant source files, excluding noise directories
          const fileUris = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,mjs,cjs}',
            '{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,.git/**}'
          );
          const filePaths = fileUris.map((uri) => uri.fsPath);

          progress.report({ increment: 40, message: `Parsing ${filePaths.length} files...` });

          const connections = await parseWorkspace(filePaths, workspaceRoot);

          progress.report({ increment: 30, message: 'Building graph...' });
          const graph = buildGraph(connections);

          console.log('[FlowMap] Connections found:', connections.length);
          connections.forEach((c) =>
            console.log(`  [${c.type.toUpperCase()}] ${c.sourceFile} → ${c.method} ${c.normalizedPath} (confidence: ${c.confidence})`)
          );

          progress.report({ increment: 20, message: 'Opening webview...' });
          showWebview(context, graph, workspaceRoot);
        }
      );
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

  // Reuse the existing panel if we have one
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

  // Handle messages from the webview
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'ready':
          // Webview is mounted — send the current graph
          currentPanel?.webview.postMessage({ type: 'update', graph });
          break;

        case 'openFile': {
          // User clicked a node — open the file in the editor
          const filePath: string = message.filePath;
          if (!filePath) { break; }
          const absPath = path.join(workspaceRoot, filePath);
          try {
            const doc = await vscode.workspace.openTextDocument(absPath);
            await vscode.window.showTextDocument(doc, { preview: false });
          } catch {
            vscode.window.showWarningMessage(`FlowMap: Cannot open file: ${filePath}`);
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
  const uiDistPath = path.join(context.extensionPath, 'dist', 'webview');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(uiDistPath, 'index.js'))
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(uiDistPath, 'index.css'))
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
