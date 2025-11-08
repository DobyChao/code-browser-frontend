/** @type {import('tailwindcss').Config} */
export default {
  // content 路径保持不变
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  
  // 在 v4 中，所有 'theme' 和 'plugins'
  // 都可以移到 CSS 文件中。
  // 这个文件现在是最小化的。
  theme: {},
  plugins: [],
}