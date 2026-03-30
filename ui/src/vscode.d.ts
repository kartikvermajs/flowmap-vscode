// Type shim so TypeScript knows about the VS Code Webview API
// injected by the VS Code runtime into the Webview's global scope.
declare function acquireVsCodeApi<S = unknown>(): {
  postMessage(message: unknown): void;
  getState(): S | undefined;
  setState(state: S): void;
};
