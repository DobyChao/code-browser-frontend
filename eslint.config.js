import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import js from "@eslint/js";

export default tseslint.config(
  // ESLint 推荐的基本规则
  js.configs.recommended,
  
  // TypeScript 规则
  ...tseslint.configs.recommendedTypeChecked,
  
  // React 推荐规则
  {
    ...pluginReactConfig,
    settings: {
      react: {
        version: "detect", // 自动检测 React 版本
      },
    },
  },

  // 全局配置
  {
    languageOptions: {
      // 解析器选项
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // 全局变量 (浏览器、Node.js、ES2020)
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
      },
    },
    // 忽略 node_modules 和 dist 目录
    ignores: ["node_modules/", "dist/", "eslint.config.js"],
  },

  // React Hooks 插件
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },

  // React Refresh 插件 (用于 Vite)
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-refresh": pluginReactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // 禁用特定规则
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);