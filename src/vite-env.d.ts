/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // 在这里添加您在 .env 文件中定义的其他变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}