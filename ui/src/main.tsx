import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'reactflow/dist/style.css';
import './index.css';

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Tell the extension host we are ready to receive graph data
const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'ready' });
