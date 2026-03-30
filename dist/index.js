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
var FETCH_LITERAL_REGEX = /fetch\(\s*['"](\/?(?:\/api\/[^'"\s)]+))['"]\s*(?:,\s*\{[^}]*method\s*:\s*['"]([A-Za-z]+)['"][^}]*\})?/g;
var FETCH_TEMPLATE_REGEX = /fetch\(\s*`(\/api\/[^`\s)]+)`/g;
var AXIOS_LITERAL_REGEX = /axios\.(get|post|put|delete|patch|head|options)\(\s*['"](\/?\/api\/[^'"\s)]+)['"]/g;
var FRONTEND_EXTENSIONS = /* @__PURE__ */ new Set([".tsx", ".ts", ".jsx", ".js", ".mjs"]);
var SKIP_PATH_PATTERNS = [
  /node_modules/,
  /\.next\//,
  /dist\//,
  /build\//,
  /server\//,
  /pages\/api\//,
  /app\/api\//
];
function isFrontendFile(filePath) {
  const ext = "." + filePath.split(".").pop();
  if (!FRONTEND_EXTENSIONS.has(ext)) {
    return false;
  }
  if (SKIP_PATH_PATTERNS.some((p) => p.test(filePath))) {
    return false;
  }
  return true;
}
function scanNextJs(content, relPath) {
  if (!isFrontendFile(relPath)) {
    return [];
  }
  const results = [];
  let match;
  FETCH_LITERAL_REGEX.lastIndex = 0;
  while ((match = FETCH_LITERAL_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath: match[1],
      method: match[2] ? match[2].toUpperCase() : "GET",
      type: "frontend",
      pathKind: "literal"
    });
  }
  FETCH_TEMPLATE_REGEX.lastIndex = 0;
  while ((match = FETCH_TEMPLATE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath: match[1],
      method: "GET",
      // can't infer method from template alone
      type: "frontend",
      pathKind: "template"
      // confidence 0.7
    });
  }
  AXIOS_LITERAL_REGEX.lastIndex = 0;
  while ((match = AXIOS_LITERAL_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath: match[2],
      method: match[1].toUpperCase(),
      type: "frontend",
      pathKind: "literal"
    });
  }
  return results;
}

// adapters/express/index.ts
var ROUTE_REGEX = /(?:app|router)\.(get|post|put|delete|patch|head|options|use)\(\s*['"](\/?\/[^'"\s)]+)['"]/g;
var ROUTE_TEMPLATE_REGEX = /(?:app|router)\.(get|post|put|delete|patch|head|options|use)\(\s*`(\/[^`\s)]+)`/g;
function scanExpress(content, relPath) {
  if (!/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(relPath)) {
    return [];
  }
  const hasExpressImport = /require\s*\(\s*['"`]express['"`]/.test(content) || /from\s+['"`]express['"`]/.test(content) || /(?:app|router)\s*=\s*(?:express\(\)|Router\(\)|express\.Router\(\))/.test(content);
  if (!hasExpressImport && /\.(tsx|jsx)$/.test(relPath)) {
    return [];
  }
  const results = [];
  let match;
  ROUTE_REGEX.lastIndex = 0;
  while ((match = ROUTE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath: match[2],
      method: match[1].toUpperCase() === "USE" ? "ALL" : match[1].toUpperCase(),
      type: "backend",
      pathKind: "literal"
    });
  }
  ROUTE_TEMPLATE_REGEX.lastIndex = 0;
  while ((match = ROUTE_TEMPLATE_REGEX.exec(content)) !== null) {
    results.push({
      sourceFile: relPath,
      rawPath: match[2],
      method: match[1].toUpperCase() === "USE" ? "ALL" : match[1].toUpperCase(),
      type: "backend",
      pathKind: "template"
      // confidence 0.7
    });
  }
  return results;
}

// core/normalize.ts
var CONFIDENCE = {
  literal: 1,
  template: 0.7,
  variable: 0.4
};
function normalizePath(raw) {
  let p = raw;
  p = p.split("?")[0].split("#")[0];
  p = p.replace(/\/\/+/g, "/");
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  if (p.length > 1) {
    p = p.replace(/\/+$/, "");
  }
  return p;
}
var ALLOWED_METHODS = /* @__PURE__ */ new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "ALL"
]);
function coerceMethod(raw) {
  if (!raw) {
    return "unknown";
  }
  const upper = raw.toUpperCase();
  return ALLOWED_METHODS.has(upper) ? upper : "unknown";
}
function normalizeDetections(detections, minConfidence = 0) {
  const calls = [];
  for (const d of detections) {
    const confidence = CONFIDENCE[d.pathKind] ?? 0.4;
    if (confidence < minConfidence) {
      continue;
    }
    calls.push({
      sourceFile: d.sourceFile,
      method: coerceMethod(d.method),
      rawPath: d.rawPath,
      normalizedPath: normalizePath(d.rawPath),
      confidence,
      type: d.type
    });
  }
  return calls;
}

// core/parser.ts
var fileCache = /* @__PURE__ */ new Map();
function clearCache() {
  fileCache.clear();
}
async function parseWorkspace(filePaths, workspaceRoot, minConfidence = 0) {
  const allCalls = [];
  for (const absPath of filePaths) {
    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }
    const mtime = stat.mtimeMs;
    const cached = fileCache.get(absPath);
    if (cached && cached.mtime === mtime) {
      allCalls.push(...cached.results);
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }
    const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, "/");
    const raw = [
      ...scanNextJs(content, relPath),
      ...scanExpress(content, relPath)
    ];
    const normalized = normalizeDetections(raw, minConfidence);
    fileCache.set(absPath, { mtime, results: normalized });
    allCalls.push(...normalized);
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const call of allCalls) {
    const key = `${call.type}::${call.sourceFile}::${call.method}::${call.normalizedPath}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    }
  }
  return unique;
}

// graph/builder.ts
function shortLabel(relPath) {
  const parts = relPath.split("/");
  if (parts.length <= 2) {
    return relPath;
  }
  return parts.slice(-2).join("/");
}
var COL = { left: 50, center: 350, right: 650 };
var ROW_SPACING = 90;
function buildGraph(connections) {
  const nodeMap = /* @__PURE__ */ new Map();
  const edgeSet = /* @__PURE__ */ new Set();
  const edges = [];
  let frontendRow = 0;
  let endpointRow = 0;
  let backendRow = 0;
  function addNode(id, data, col) {
    if (nodeMap.has(id)) {
      return;
    }
    let y;
    if (col === "left") {
      y = frontendRow++ * ROW_SPACING;
    } else if (col === "right") {
      y = backendRow++ * ROW_SPACING;
    } else {
      y = endpointRow++ * ROW_SPACING;
    }
    nodeMap.set(id, {
      id,
      type: "flowmapNode",
      data,
      position: { x: COL[col], y }
    });
  }
  function addEdge(id, source, target, label, animated) {
    if (edgeSet.has(id)) {
      return;
    }
    edgeSet.add(id);
    edges.push({
      id,
      source,
      target,
      label,
      animated,
      style: { stroke: animated ? "#7c3aed" : "#45475a", strokeWidth: 2 }
    });
  }
  for (const conn of connections) {
    const endpointId = `endpoint::${conn.method}::${conn.normalizedPath}`;
    if (conn.type === "frontend") {
      const fileId = `file::${conn.sourceFile}`;
      addNode(fileId, {
        label: shortLabel(conn.sourceFile),
        filePath: conn.sourceFile,
        kind: "frontend"
      }, "left");
      addNode(endpointId, {
        label: `${conn.method} ${conn.normalizedPath}`,
        endpoint: conn.normalizedPath,
        method: conn.method,
        confidence: conn.confidence,
        kind: "endpoint"
      }, "center");
      addEdge(
        `fedge::${fileId}::${endpointId}`,
        fileId,
        endpointId,
        conn.method !== "unknown" ? conn.method : void 0,
        true
      );
    } else {
      const routeId = `route::${conn.sourceFile}`;
      addNode(routeId, {
        label: shortLabel(conn.sourceFile),
        filePath: conn.sourceFile,
        kind: "backend"
      }, "right");
      addNode(endpointId, {
        label: `${conn.method} ${conn.normalizedPath}`,
        endpoint: conn.normalizedPath,
        method: conn.method,
        confidence: conn.confidence,
        kind: "endpoint"
      }, "center");
      addEdge(
        `bedge::${endpointId}::${routeId}`,
        endpointId,
        routeId,
        conn.method,
        false
      );
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
            (c) => console.log(`  [${c.type.toUpperCase()}] ${c.sourceFile} \u2192 ${c.method} ${c.normalizedPath} (confidence: ${c.confidence})`)
          );
          progress.report({ increment: 20, message: "Opening webview..." });
          showWebview(context, graph, workspaceRoot);
        }
      );
    }
  );
  context.subscriptions.push(disposable);
}
function showWebview(context, graph, workspaceRoot) {
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
      ],
      retainContextWhenHidden: true
    }
  );
  currentPanel.webview.html = getWebviewContent(context, currentPanel.webview);
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case "ready":
          currentPanel?.webview.postMessage({ type: "update", graph });
          break;
        case "openFile": {
          const filePath = message.filePath;
          if (!filePath) {
            break;
          }
          const absPath = path2.join(workspaceRoot, filePath);
          try {
            const doc = await vscode.workspace.openTextDocument(absPath);
            await vscode.window.showTextDocument(doc, { preview: false });
          } catch {
            vscode.window.showWarningMessage(`FlowMap: Cannot open file: ${filePath}`);
          }
          break;
        }
        case "rescan":
          clearCache();
          await vscode.commands.executeCommand("flowmap.scanProject");
          break;
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