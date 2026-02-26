# Code Browser Frontend

一个用于“浏览代码仓库 / 搜索 / 跳转定义与引用”的 Web 前端。前端通过 HTTP API 获取仓库列表、目录树、文件内容与搜索结果，并将当前文件与定位信息写入 URL，便于分享深链路与浏览器前进/后退恢复状态。

## 功能概览

- 仓库列表与筛选：从后端拉取可浏览的仓库列表
- 多仓库标签页：在同一页面切换多个仓库工作区
- 文件树浏览与快速打开：目录树展开、按文件名快速定位
- 代码查看：Monaco Editor 展示文件内容
- 搜索：支持内容搜索与文件名搜索；提供普通模式与 Zoekt 语法模式
- 智能能力：查询“定义 / 引用”并在面板中展示与跳转
- 反馈提交：对接后端 `/feedback` 接口

## 技术栈

- React 18 + TypeScript
- 路由：react-router-dom（HashRouter）
- 构建：Vite
- 样式：Tailwind CSS
- 编辑器：Monaco Editor
- E2E：Playwright（@playwright/test）

## 快速开始

建议使用 Node.js 18+。

### 安装依赖

```bash
npm install
```

如使用 pnpm：

```bash
pnpm install
```

### 启动开发环境

```bash
npm run dev
```

默认会读取 `.env` 中的 `VITE_API_BASE_URL`（见下方“配置”）。

### 构建与本地预览

```bash
npm run build
npm run preview
```

构建产物输出到 `dist/`。

### 常用命令

```bash
# 本地开发
npm run dev

# 生产构建 / 预览构建产物
npm run build
npm run preview

# 代码检查
npm run lint
```

## 配置

### API Base URL

前端请求后端 API 的 base URL 有两层来源（后者优先级更高）：

1. 构建时默认值：`VITE_API_BASE_URL`
   - 开发环境默认值见 `.env`
   - 生产环境默认值见 `.env.production`（通常配置为同域 `/api`）
2. 运行时覆盖：`localStorage.apiBaseUrl`
   - 可通过页面“设置”入口写入，用于无需重新构建就切换后端地址

## 后端 API 约定

以下端点均以 “API Base URL” 为前缀：

- `GET /repositories`：仓库列表
- `GET /repositories/:repoId/tree?path=`：目录树
- `GET /repositories/:repoId/blob?path=`：文件内容
- `GET /repositories/:repoId/search?q=&engine=`：内容搜索
- `GET /repositories/:repoId/search-files?q=&engine=`：文件名搜索
- `POST /intelligence/definitions`：定义查询
- `POST /intelligence/references`：引用查询
- `POST /feedback`：反馈提交（接口约定见 [FEEDBACK_API.md](./FEEDBACK_API.md)）

## 部署

1. 执行 `npm run build` 生成静态资源到 `dist/`
2. 使用任意静态站点服务器托管 `dist/`
3. 推荐将后端 API 通过同域路径 `/api` 反代到后端服务（避免跨域问题）

示例 Nginx 配置（按需替换后端地址与端口）：

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://backend:8088/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 项目结构

- `src/api/`：后端 API 封装与类型
- `src/components/`：主要 UI 组件（文件树、编辑器、搜索、设置、反馈等）
- `src/controllers/`：工作区状态管理与 URL 同步（如 `rp/intel/path/line/col`）
- `src/views/`：页面级视图（首页、仓库工作区）
- `e2e/`：Playwright E2E 用例

## 路由与深链路

项目使用 HashRouter，URL 形如 `/#/...`。工作区会把当前文件与定位信息写入 query，便于分享与回退恢复，例如：

`/#/repo/<repoId>?path=src/main.tsx&line=10&col=1`
