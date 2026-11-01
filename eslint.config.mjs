import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";
import panelDom from "./scripts/eslint-panel-dom.mjs";

// Existing oversized files may shrink, but must not grow. Lower or remove each
// ceiling when refactoring; split by responsibility rather than padding exceptions.
const existingFileLineLimits = {
  "apps/web/src/editor-action-bar/ActionBarEditor.tsx": 512,
  "apps/web/src/editor-preview/construct/useConstructEditor.ts": 511,
  "apps/web/src/editor-preview/construct/useConstructionPointerController.ts": 681,
  "apps/web/src/editor-workspace/HomeEditorScene.tsx": 720,
  "packages/catalog/src/device/registry.ts": 1210,
  "packages/catalog/src/furnishing/registry.tsx": 1396,
  "packages/engine/src/HomeAssistantRuntime.tsx": 552,
  "packages/engine/src/SceneActionBar.tsx": 618,
  "packages/engine/src/ValidatedDashboardView.tsx": 700,
  "packages/engine/src/home-assistant-mapping/DeviceMappingInspector.tsx": 560,
  "packages/engine/src/home-editor/construct/draft-reducer.ts": 598,
  "packages/engine/src/home-project/schema.ts": 556,
  "packages/engine/src/types.ts": 709,
};
const fileLineLimit = (max) => ["error", { max, skipBlankLines: true, skipComments: true }];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-panel/**",
      "**/coverage/**",
      "**/screenshots/**",
      "**/test-results/**",
      "**/.vercel/**",
      "**/.worktrees/**",
      "**/.superpowers/**",
    ],
  },
  { ...js.configs.recommended, files: ["**/*.{js,mjs,ts,tsx}"] },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: [
      "apps/**/*.{ts,tsx}",
      "packages/**/*.{ts,tsx}",
      "home/**/*.{ts,tsx}",
      "tests/*.types.ts",
    ],
  })),
  {
    files: [
      "apps/**/*.{ts,tsx}",
      "packages/**/*.{ts,tsx}",
      "home/**/*.{ts,tsx}",
      "tests/*.types.ts",
    ],
    languageOptions: {
      parserOptions: { project: "./tsconfig.json", tsconfigRootDir: process.cwd() },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      // Native TS7 and the TS6 lint API differ in contextual assertion inference.
      // The compiler remains authoritative for these assertions.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      // Async adapters intentionally preserve Promise/error semantics even when
      // an in-memory implementation has no I/O to await.
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
  })),
  {
    files: ["**/*.mjs"],
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "home/**/*.{ts,tsx}"],
    rules: { "max-lines": fileLineLimit(500) },
  },
  ...Object.entries(existingFileLineLimits).map(([file, max]) => ({
    files: [file],
    rules: { "max-lines": fileLineLimit(max) },
  })),
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "packages/engine/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/main.tsx", "apps/web/src/panel/panel-element.ts"],
    plugins: { cabane: panelDom },
    rules: { "cabane/panel-dom": "error" },
  },
  prettier,
];
