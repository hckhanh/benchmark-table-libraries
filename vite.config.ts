import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "vite-plugin-babel";

const RC_ENABLED = process.env.VITE_RC === "1";

const ReactCompilerConfig = {
  target: "19",
};

export default defineConfig({
  define: {
    __RC_ENABLED__: JSON.stringify(RC_ENABLED),
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
