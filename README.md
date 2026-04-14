# Code Browser Frontend

一个用于"浏览代码仓库 / 搜索 / 跳转定义与引用 / AI 对话"的 Web 前端。前端通过 HTTP API 获取仓库列表、目录树、文件内容与搜索结果，并将当前文件与定位信息写入 URL，便于分享深链路与浏览器前进/后退恢复状态。

## 功能概览

- **仓库列表与筛选**：从后端拉取可浏览的仓库列表
- **多仓库标签页**：在同一页面切换多个仓库工作区，切换时保留各标签页状态
- **文件树浏览与快速打开**：目录树展开、按文件名快速定位
- **代码查看**：Monaco Editor 展示文件内容，支持行高亮、跳转行号、右键菜单
- **搜索**：支持内容搜索与文件名搜索；提供普通模式与 Zoekt 语法模式，支持高级选项（大小写、全词匹配、正则、文件过滤）
- **智能能力**：查询"定义 / 引用"并在面板中展示与跳转
- **AI 助手**：集成 OpenAI 兼容 API 的对话式代码分析助手，支持流式输出、推理过程展示、工具调用（读取文件、搜索代码、获取上下文），可进行多轮 Agentic 循环
- **反馈提交**：对接后端 `/feedback` 接口

## 技术栈

- **框架**：React 18 + TypeScript 5（strict mode）
- **构建**：Vite 5 + pnpm
- **样式**：Tailwind CSS v4（CSS 变量主题系统）
- **编辑器**：Monaco Editor（`@monaco-editor/react`）
- **路由**：react-router-dom v6（HashRouter）
- **布局**：react-resizable-panels
- **图标**：lucide-react
- **Markdown**：react-markdown + remark-gfm
- **E2E 测试**：Playwright

## 快速开始

建议使用 Node.js 18+，包管理器使用 pnpm。

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

默认会读取 `.env` 中的 `VITE_API_BASE_URL`（见下方"配置"）。

### 构建与本地预览

```bash
pnpm build
pnpm preview
```

构建产物输出到 `dist/`。

### 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # TypeScript 类型检查 + Vite 构建
pnpm lint         # ESLint 代码检查
pnpm e2e          # Playwright E2E 测试
pnpm e2e:ui       # Playwright 交互式测试 UI
```

## 配置

### API Base URL

前端请求后端 API 的 base URL 有两层来源（后者优先级更高）：

1. **构建时默认值**：`VITE_API_BASE_URL`
   - 开发环境默认值见 `.env`
   - 生产环境默认值见 `.env.production`（通常配置为同域 `/api`）
2. **运行时覆盖**：`localStorage.apiBaseUrl`
   - 可通过页面"设置"入口写入，用于无需重新构建就切换后端地址

### AI 助手配置

点击 AI 助手面板右上角齿轮图标，配置：
- **API Key**：OpenAI 兼容 API 的密钥
- **Base URL**：API 地址（如 `https://api.openai.com/v1`）
- **Model ID**：模型标识（如 `gpt-4o`）

配置保存在浏览器 `localStorage` 中。

## 后端 API 约定

以下端点均以 "API Base URL" 为前缀：

- `GET /repositories`：仓库列表
- `GET /repositories/:repoId/tree?path=`：目录树
- `GET /repositories/:repoId/blob?path=`：文件内容
- `GET /repositories/:repoId/search?q=&engine=`：内容搜索
- `GET /repositories/:repoId/search-files?q=&engine=`：文件名搜索
- `POST /intelligence/definitions`：定义查询
- `POST /intelligence/references`：引用查询
- `POST /feedback`：反馈提交（接口约定见 [FEEDBACK_API.md](./FEEDBACK_API.md)）

## 架构

### 状态管理：Observable Controller 模式

采用 MVVM 风格的 Controller 模式管理状态。Controller 持有状态对象，通过 `subscribe` / `getSnapshot` / `emit` 暴露给 React 组件，组件通过 `useSyncExternalStore` 订阅变化。

- **RepoUIController** — 管理编辑器状态、面板显隐、搜索、智能结果、URL 同步
- **ChatController** — 管理 AI 对话消息、流式输出、工具调用循环（最多 5 轮）

### 多标签页状态隔离

所有标签页同时挂载，通过 CSS `display` 切换显隐。每个标签页拥有独立的 Controller 实例（以 `repoId` 为键），切换标签页时保留滚动位置、搜索结果和编辑器状态。

### URL 深链路

状态与 URL query 参数双向同步：
- `path` — 当前文件路径
- `line`, `col` — 光标位置
- `rp` — 右侧面板（none / search / chat）
- `intel` — 底部面板（open / closed）

格式：`/#/repo/{repoId}?path=...&line=...&col=...&rp=search&intel=open`

## 项目结构

```
src/
├── api/
│   ├── index.ts          # 统一 API 客户端（基于 fetch）
│   ├── types.ts          # API 响应类型
│   ├── llm-client.ts     # OpenAI 兼容流式聊天客户端（SSE + 工具调用）
│   └── tools.ts          # 工具定义与执行器（read_file, search_code, get_current_context）
├── components/
│   ├── FileExplorer.tsx  # 目录树（递归渲染、懒加载、React.memo 优化）
│   ├── FileEditor.tsx    # Monaco 编辑器封装（行高亮、跳转、右键菜单、光标→URL 同步）
│   ├── SearchPanel.tsx   # Zoekt 搜索（高级选项、树/列表视图切换）
│   ├── ChatPanel.tsx     # AI 助手（流式输出、推理过程折叠、工具调用展开）
│   ├── ActivityBar.tsx   # 右侧面板切换器
│   ├── IntelligenceResults.tsx  # 定义与引用结果面板
│   ├── TabBar.tsx        # 多仓库标签页管理
│   └── ...               # 其他组件（GoToFileSearch, Settings, Feedback 等）
├── controllers/
│   ├── RepoUIController.ts   # 主状态控制器（Observable 模式）
│   └── ChatController.ts     # 对话状态控制器（Agentic 工具调用循环）
├── views/
│   ├── HomePage.tsx      # 仓库列表页
│   └── WorkspaceLayout.tsx  # 主工作区（可调整面板布局）
├── types/
│   └── ui.ts             # UI 状态类型
├── utils/
│   ├── index.ts          # 工具函数（escapeHtml, debounce 等）
│   └── queryBuilder.ts   # Zoekt 查询构建
├── App.tsx               # 根组件（路由、标签页生命周期、Controller Map 管理）
├── main.tsx              # 入口（HashRouter + React root）
└── index.css             # Tailwind v4 主题（@theme 块 + CSS 变量）
```

## 部署

1. 执行 `pnpm build` 生成静态资源到 `dist/`
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
