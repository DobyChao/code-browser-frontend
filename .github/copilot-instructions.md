# AI Agent Instructions for code-browser-beta

## Project Overview
This is a React + TypeScript web application that provides a code browsing interface similar to VS Code. The application connects to a backend API to browse and search code repositories.

## Architecture & Data Flow

### Key Components
- **App.tsx**: Main application container managing global state (tabs, views, repositories)
- **Views**:
  - `HomePage`: Repository listing
  - `RepoView`: Code browser for a specific repository
- **Components**:
  - `FileExplorer`: Tree view of repository files
  - `FileEditor`: Code editor with syntax highlighting
  - `SearchPanel`: File/content search interface
  - `ActivityBar`: Navigation sidebar
  - `TabBar`: Multi-tab management

### API Integration
- API client is centralized in `src/api/index.ts`
- Base URL is configurable through settings (stored in localStorage)
- Key endpoints:
  ```typescript
  /repositories            // List repositories
  /repositories/:id/tree   // Get directory structure
  /repositories/:id/blob   // Get file content
  /repositories/:id/search // Search content
  ```

## Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

### Technology Stack
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Prism.js for syntax highlighting

## Project Conventions

### State Management
- React hooks for local component state
- Props drilling for component communication
- API client maintains base URL in localStorage

### Type System
- All API types defined in `src/api/types.ts`
- Strict TypeScript checking enabled
- Use `import type` for type-only imports

### Component Organization
- Views (`src/views/`): Full-page components
- Components (`src/components/`): Reusable UI elements
- API (`src/api/`): Backend integration
- Utils (`src/utils/`): Shared utilities

### Error Handling
- API errors are caught and displayed in a banner at the top
- Error messages include instructions for common issues (e.g., "Check service address")

## Key Integration Points
1. Backend API connection (configurable through settings)
2. File system navigation via `FileExplorer`
3. Search functionality supporting multiple search engines
4. Tab-based navigation system

## Common Tasks
- Adding a new view: Create component in `src/views/`, add routing in `App.tsx`
- Adding API endpoints: Extend `api` object in `src/api/index.ts`
- Adding new tab types: Update `Tab` interface in `types.ts`
- Styling: Use TailwindCSS classes following the existing color scheme