# FlowMap 🗺️

Visualizes the API connections between your Frontend (Next.js) and Backend (Express) directly inside VS Code.

FlowMap crawls your workspace to detect API calls in your frontend, matching them to route definitions in your backend, and rendering an interactive graph.

## ✨ Features
- **Automated Scanning**: Quickly crawls your workspace to find API connections.
- **Interactive Graph**: Visualizes connections as nodes (File → API → Route) using React Flow.
- **Smart Normalization**: Correctly handles query parameters, trailing slashes, and path inconsistencies.
- **Deep Linking**: Click any node in the graph to jump to the corresponding code.

## 🏗️ How it Works
1. **Scanning**: Adapters use regex to find raw API calls and route definitions.
2. **Normalization**: Raw paths are cleaned and assigned a Confidence Score based on detection method.
3. **Graph Construction**: Normalized calls are transformed into a structured graph (Frontend → Endpoint → Backend).
4. **Visualization**: A React Flow Webview renders the interactive map.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- VS Code (v1.80+)

### Running Locally (Extension Development)
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-username/flowmap.git
   cd flowmap
   npm install
   ```
2. Build the project sequentially:
   ```bash
   npm run build
   ```
3. Open the project in VS Code:
   ```bash
   code .
   ```
4. Press **F5** to launch the **Extension Development Host**.
5. In the new window, open a project containing Next.js/Express files and run `FlowMap: Scan Project`.

## 🤝 Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup guides, adapter tutorials, and contribution rules.
