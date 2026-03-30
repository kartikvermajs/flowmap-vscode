import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseWorkspace } from '../core/parser';
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

          // Find all relevant source files, excluding common noise directories
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
            console.log(
              `  [${c.type.toUpperCase()}] ${c.from} → ${c.method} ${c.to}`
            )
          );

          progress.report({ increment: 20, message: 'Opening webview...' });
          showWebview(context, graph);
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

function showWebview(
  context: vscode.ExtensionContext,
  graph: { nodes: unknown[]; edges: unknown[] }
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
    }
  );

  currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);

  // Send graph data once the webview signals it's ready
  currentPanel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === 'ready') {
        currentPanel?.webview.postMessage({ type: 'update', graph });
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

  // Load webview assets built by Vite
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
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {}
