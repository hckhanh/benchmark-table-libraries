import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "vite-plugin-babel";

const RC_ENABLED = process.env.VITE_RC === "1";

const ReactCompilerConfig = {
  target: "19",
};

// Bench targets Chrome 147 — ship modern JS and skip legacy polyfills.
export default defineConfig({
  define: {
    __RC_ENABLED__: JSON.stringify(RC_ENABLED),
  },
  build: {
    target: "esnext",
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    modulePreload: { polyfill: false },
    sourcemap: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("ag-grid")) return "vendor-ag-grid";
          if (id.includes("@glideapps/glide-data-grid")) return "vendor-glide";
          if (id.includes("react-data-grid")) return "vendor-rdg";
          if (id.includes("/@tanstack/react-table") || id.includes("/@tanstack/react-virtual")) {
            return "vendor-tanstack";
          }
          if (id.includes("@mui/x-data-grid")) return "vendor-mui-dg";
          if (
            id.includes("@mui/material") ||
            id.includes("@mui/system") ||
            id.includes("@mui/utils") ||
            id.includes("@emotion/")
          ) {
            return "vendor-mui";
          }
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
      "react-data-grid",
    ],
    exclude: [
      // Lazy-loaded heavy libs — keep out of the warm cache so dev start stays fast.
      "ag-grid-community",
      "ag-grid-react",
      "@mui/x-data-grid",
      "@glideapps/glide-data-grid",
    ],
  },
  server: {
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/benchmark/BenchmarkHarness.tsx",
        "./src/benchmark/data.ts",
      ],
    },
  },
  plugins: [
    react(),
    ...(RC_ENABLED
      ? [
          babel({
            filter: /\.[jt]sx?$/,
            babelConfig: {
              babelrc: false,
              configFile: false,
              presets: ["@babel/preset-typescript"],
              plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
            },
          }),
        ]
      : []),
  ],
});
