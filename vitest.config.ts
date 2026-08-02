import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone test config: the app's Vite config wires the full TanStack
// Start/Nitro pipeline, which tests do not need.
//
// Two projects share this file:
//   unit — pure logic and server modules, node environment (*.test.ts)
//   ui   — component and route tests, jsdom + Testing Library (*.test.tsx)
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup-ui.ts"],
newline_placeholder
        },
      },
    ],
  },
});
