# Contributing to FlowMap 🗺️

Thanks for your interest in FlowMap! Every contribution, from bug fixes to new framework adapters, helps developers better understand their codebase.

## 🛠️ How to Get Started

### Local Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/flowmap.git
    cd flowmap
    ```
2.  Install all dependencies:
    ```bash
    npm install
    ```
3.  Build the extension and UI:
    ```bash
    npm run build
    ```
4.  Open the project in VS Code:
    ```bash
    code .
    ```
5.  Press **F5** to start the Extension Development Host.

### Rules for Contributors
-   Use **TypeScript** for all new code.
-   Follow the existing **naming conventions**:
    -   `sourceFile` should always refer to the relative path of the file containing the API call/route.
    -   `normalizedPath` should be used after passing raw paths through the `core/normalize.ts` module.
-   Keep functions small and focused on a single responsibility.
-   Avoid redundant comments that describe obvious code behavior.
-   Include clear comments for **complex regex patterns**.
-   Explain architectural decisions or non-trivial normalization logic.



## 🧩 How to Add a New Adapter

Adapters are the heart of FlowMap's detection logic. To add support for a new framework (e.g., Fastify, Django, Axios-only projects):

1.  Create a new directory in `/adapters/[your-framework]`.
2.  Implement a `scan[Framework]` function that takes `content: string` and `sourceFile: string` as input.
3.  Return an array of `RawDetection` objects.

### `RawDetection` Interface
Your function must return individual findings in this format:
```typescript
interface RawDetection {
  sourceFile: string;      // relative path
  rawPath: string;         // exactly as found in code
  method?: string;         // e.g., 'GET', 'POST'
  type: 'frontend' | 'backend';
  pathKind: 'literal' | 'template' | 'variable';
}
```

4.  Register your new adapter in `core/parser.ts`:
    ```typescript
    import { scanYourFramework } from '../adapters/your-framework/index';
    // ...
    const raw: RawDetection[] = [
      ...scanNextJs(content, sourceFile),
      ...scanExpress(content, sourceFile),
      ...scanYourFramework(content, sourceFile), // Add yours here
    ];
    ```

## 🧪 Testing Your Changes

We currently prioritize manual verification via the **Extension Development Host**. When adding a new feature or adapter:
-   Provide a small sample project that demonstrates the use case.
-   Ensure the graph still renders correctly without regressions.
-   Verify that clicking nodes leads to the correct source file locations.
