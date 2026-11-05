import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // three.js / React Three Fiber code mutates scene objects, materials and uniforms imperatively (in
    // effects and useFrame) by design; the React Compiler's immutability rule doesn't model that.
    files: ["src/three/**/*.{ts,tsx}", "src/components/home/HeroScene3D.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  {
    // Pre-rendered WebP frames with explicit sizes and srcset: next/image would only re-encode them.
    files: ["src/components/home/**/*.tsx", "src/app/not-found.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, minified Stockfish build copied from node_modules at dev/build time.
    "public/engine/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
