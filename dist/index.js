"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// extension/index.ts
var index_exports = {};
__export(index_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(index_exports);
var vscode = __toESM(require("vscode"));
var path2 = __toESM(require("path"));

// core/parser.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// adapters/nextjs/index.ts
var FETCH_REGEX = /fetch\(\s*['"`](\/api\/[^'"`\s)]+)['"`]/g;
var AXIOS_REGEX = /axios\.(get|post|put|delete|patch)\(\s*['"`](\/api\/[^'"`\s)]+)['"`]/g;
var FRONTEND_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
function isFrontendFile(filePath) {
  return FRONTEND_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}
function scanNextJs(content, relPath) {
  if (!isFrontendFile(relPath)) {
    return [];
  }
  const results = [];
  let match;
  while ((match = FETCH_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[1],
      method: "unknown",
      // fetch does not expose method in the URL expression
      type: "frontend"
    });
  }
  while ((match = AXIOS_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[2],
      method: match[1].toUpperCase(),
      type: "frontend"
    });
  }
  return results;
}

// adapters/express/index.ts
var ROUTE_REGEX = /(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`](\/[^'"`\s)]+)['"`]/g;
function scanExpress(content, relPath) {
  if (!/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(relPath)) {
    return [];
  }
  const results = [];
  let match;
  while ((match = ROUTE_REGEX.exec(content)) !== null) {
    results.push({
      from: relPath,
      to: match[2],
      method: match[1].toUpperCase(),
      type: "backend"
    });
  }
  return results;
}

// core/parser.ts
async function parseWorkspace(filePaths, workspaceRoot) {
  const connections = [];
  for (const absPath of filePaths) {
    let content;
    try {
      content = fs.readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }
    const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, "/");
    const nextjsResults = scanNextJs(content, relPath);
    const expressResults = scanExpress(content, relPath);
    connections.push(...nextjsResults, ...expressResults);
  }
  return connections;
}

// graph/builder.ts
function buildGraph(connections) {
  const nodeMap = /* @__PURE__ */ new Map();
  const edges = [];
  let xFrontend = 0;
  let xBackend = 600;
  let yEndpoint = 0;
  const SPACING = 100;
  function getOrCreateNode(id, label, column) {
    if (!nodeMap.has(id)) {
      const x = column === "left" ? 0 : column === "center" ? 300 : 600;
      const y = column === "left" ? xFrontend++ * SPACING : column === "right" ? xBackend++ * SPACING : yEndpoint++ * SPACING;
      nodeMap.set(id, {
        id,
        data: { label },
        position: { x, y }
      });
    }
    return nodeMap.get(id);
  }
  for (const conn of connections) {
    if (conn.type === "frontend") {
      const fileNodeId = `file::${conn.from}`;
      const endpointNodeId = `endpoint::${conn.method}::${conn.to}`;
      getOrCreateNode(fileNodeId, conn.from, "left");
      getOrCreateNode(
        endpointNodeId,
        `${conn.method !== "unknown" ? `[${conn.method}] ` : ""}${conn.to}`,
        "center"
      );
      edges.push({
        id: `edge::${fileNodeId}::${endpointNodeId}`,
        source: fileNodeId,
        target: endpointNodeId,
        animated: true,
        label: conn.method !== "unknown" ? conn.method : void 0
      });
    } else {
      const routeNodeId = `route::${conn.from}`;
      const endpointNodeId = `endpoint::${conn.method}::${conn.to}`;
      getOrCreateNode(routeNodeId, conn.from, "right");
      getOrCreateNode(
        endpointNodeId,
        `${conn.method !== "unknown" ? `[${conn.method}] ` : ""}${conn.to}`,
        "center"
      );
      edges.push({
        id: `edge::${routeNodeId}::${endpointNodeId}`,
        source: endpointNodeId,
        target: routeNodeId,
        animated: false,
        label: conn.method
      });
    }
  }
  return {
    nodes: Array.from(nodeMap.values()),
    edges
  };
}

// extension/index.ts
var currentPanel;
function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "flowmap.scanProject",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          "FlowMap: No workspace folder open. Please open a project first."
        );
        return;
      }
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "FlowMap: Scanning project...",
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 10, message: "Finding files..." });
          const fileUris = await vscode.workspace.findFiles(
            "**/*.{ts,tsx,js,jsx,mjs,cjs}",
            "{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,.git/**}"
          );
          const filePaths = fileUris.map((uri) => uri.fsPath);
          progress.report({ increment: 40, message: `Parsing ${filePaths.length} files...` });
          const connections = await parseWorkspace(filePaths, workspaceRoot);
          progress.report({ increment: 30, message: "Building graph..." });
          const graph = buildGraph(connections);
          console.log("[FlowMap] Connections found:", connections.length);
          connections.forEach(
            (c) => console.log(
              `  [${c.type.toUpperCase()}] ${c.from} \u2192 ${c.method} ${c.to}`
            )
          );
          progress.report({ increment: 20, message: "Opening webview..." });
          showWebview(context, graph);
        }
      );
    }
  );
  context.subscriptions.push(disposable);
}
function showWebview(context, graph) {
  const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : void 0;
  if (currentPanel) {
    currentPanel.reveal(column);
    currentPanel.webview.postMessage({ type: "update", graph });
    return;
  }
  currentPanel = vscode.window.createWebviewPanel(
    "flowmap",
    "FlowMap",
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview")
      ]
    }
  );
  currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);
  currentPanel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === "ready") {
        currentPanel?.webview.postMessage({ type: "update", graph });
      }
    },
    void 0,
    context.subscriptions
  );
  currentPanel.onDidDispose(
    () => {
      currentPanel = void 0;
    },
    null,
    context.subscriptions
  );
}
function getWebviewContent(context, webview) {
  const uiDistPath = path2.join(context.extensionPath, "dist", "webview");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path2.join(uiDistPath, "index.js"))
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path2.join(uiDistPath, "index.css"))
  );
  const nonce = getNonce();
  return (
    /* html */
    `<!DOCTYPE html>
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
</html>`
  );
}
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=index.js.map