# 结构与构建 / Structure and build

README 只保留安装与使用说明；本文记录目录布局、模块职责和构建管线。
The README keeps installation and usage; this document records the layout, module responsibilities, and build pipeline.

## 目录 / Layout

```text
src/
  host/
    index.ts
    resource.ts
    http.ts
    git.ts
    repository.ts
    scan.ts
    parsers.ts
    types.ts
    dsh.ts
    errors.ts
    routes/
      branches.ts
      log.ts
      commit.ts
  client/
    index.tsx
    plugin.ts
    runtime.ts
    dsh.ts
    GitLogPanel.tsx
    SidebarPanel.tsx
    hooks/useGitLogView.ts
    components/
      CommitGraph.tsx
      CommitList.tsx
      CommitRow.tsx
      DetailPane.tsx
      ErrorState.tsx
      GitLogIcon.tsx
      PanelControls.tsx
      Refs.tsx
      States.tsx
    lib/
      api.ts
      format.ts
      graph.ts
      projects.ts
      recent-projects.ts
    locales/
      en.ts
      zh.ts
    styles.scss
    styles.ts
scripts/build-client.mjs
tsconfig.json
tsconfig.host.json
cordis.patch.yml
locale/
icon.svg
```

## 宿主端 / Host half

| 文件 / File | 职责 / Responsibility |
|---|---|
| `host/index.ts` | 注册 `/git-log` 只读路由并绑定 host context / Registers the read-only `/git-log` route with the host context |
| `host/resource.ts` | 校验请求、按 `mode` 分发并统一错误响应 / Admits requests, dispatches by `mode`, and maps errors to responses |
| `host/http.ts` | JSON 响应、错误序列化、同源与私有头校验 / JSON responses, error serialization, same-origin and private-header checks |
| `host/git.ts` | 执行只读 git 命令并把失败映射为错误码 / Runs read-only git commands and maps failures to error codes |
| `host/repository.ts` | 校验路径并用 `rev-parse` 解析仓库根目录 / Validates paths and resolves the repository root with `rev-parse` |
| `host/scan.ts` | 有界扫描工作区中的 Git 项目 / Scans workspaces for Git projects with depth and entry limits |
| `host/parsers.ts` | 解析 log、commit header、numstat 和 ref / Parses log output, commit headers, numstat, and refs |
| `host/routes/` | 分支、日志分页、提交详情三个读取入口 / Readers for branches, paged log, and commit detail |
| `host/types.ts` | 宿主端 payload 类型 / Host payload types |
| `host/dsh.ts` | 本插件使用的 DSH host API 声明 / Local declarations for the DSH host API used here |
| `host/errors.ts` | `RouteError`（状态码、错误码、details）/ `RouteError` with status, code, and details |

## 客户端 / Client half

| 文件 / File | 职责 / Responsibility |
|---|---|
| `client/index.tsx` | 向 `window.__ModuleLoader__` 注册惰性工厂 / Registers the lazy factory with `window.__ModuleLoader__` |
| `client/plugin.ts` | 注册 `gitLog` 字典、`main` 面板、`sidebar.panellist` 入口，以及右侧栏 `git-log` 标签页类型 / Registers the `gitLog` dictionaries, the `main` panel, the `sidebar.panellist` entry, and the right-sidebar `git-log` tab type |
| `client/runtime.ts` | 绑定 DSH 提供的 React，提供 `h` 与 hooks 包装 / Binds the React instance from DSH and exposes `h` plus hook wrappers |
| `client/dsh.ts` | 本插件使用的 DSH client API 声明 / Local declarations for the DSH client API used here |
| `client/GitLogPanel.tsx` | 面板骨架：头部、控件、提示与主体 / Panel shell: header, controls, notes, and body |
| `client/SidebarPanel.tsx` | 右侧栏标签页外壳，使用窄栏单列样式 / Right-sidebar tab wrapper with the narrow single-column layout |
| `client/hooks/useGitLogView.ts` | 项目扫描、分支、分页日志、详情选择与分页动作 / Project scan, branches, paged log, detail selection, and actions |
| `client/components/` | 提交列表、提交行、路线图、详情、错误与状态等展示组件 / Presentational components for the list, rows, graph, detail, errors, and states |
| `client/lib/api.ts` | 带私有头和 `AbortSignal` 的取数封装 / Fetch wrapper with the private header and `AbortSignal` |
| `client/lib/graph.ts` | 泳道路由图布局与几何计算 / Lane layout and geometry for the commit graph |
| `client/lib/projects.ts` | 项目分组、标签、分支标签等纯函数 / Pure helpers for project groups, labels, and branch labels |
| `client/lib/recent-projects.ts` | 最近项目在 localStorage 与 cookie 间的读写 / Recent-project persistence across localStorage and a cookie |
| `client/lib/format.ts` | 日期与相对时间格式化 / Date and relative-time formatting |
| `client/locales/` | 英文与中文文案，key 集合由英文定义 / English and Chinese strings, with the English key set as the source of truth |
| `client/styles.scss` | SCSS 样式源文件 / SCSS stylesheet source |
| `client/styles.ts` | 导出内联进产物的 CSS 字符串 / Exports the CSS string inlined into the artifact |

## 右侧栏标签页 / Right-sidebar tab

右侧栏的「开始」页由 `ui-sidebar-right` 提供。插件用 DSH 的两阶段注册接入：

1. `ctx.sidebarRightTabs.register(...)` 注册页类型（`id` 为包名、`kind: 'git-log'`）和「开始」页入口；`guide` 的 `order: 40` 排在 files（10）、terminal（20）、browser（30）之后。
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitLog' }, SidebarGitLogPanel)` 注册标签页内容；`key` 必须等于页类型的 `id`。

注册包在 `ctx.inject(['sidebarRightTabs'], …)` 里，右侧栏因此是**可选依赖**：未启用右侧栏时，主面板和左侧栏入口仍然工作。`SidebarGitLogPanel` 的外层 `.dsh-gitlog-sidebar` 把面板切换为窄栏布局（更小的内边距、单列列表/详情、路径输入占满一行）。

The right sidebar's Start page belongs to `ui-sidebar-right`. The plugin joins it through the same two-stage registration any tab type uses:

1. `ctx.sidebarRightTabs.register(...)` registers the page type (`id` is the package name, `kind: 'git-log'`) and its Start-page entry; the entry's `order: 40` places it after files (10), terminal (20), and browser (30).
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitLog' }, SidebarGitLogPanel)` registers the tab body; `key` must equal the type's `id`.

The registration runs inside `ctx.inject(['sidebarRightTabs'], …)`, so the right sidebar is an optional dependency: without it, the main panel and the left-sidebar entry still work. The wrapper class `.dsh-gitlog-sidebar` switches the panel to the narrow layout (smaller padding, single-column list and detail, full-width path field).

## 构建管线 / Build pipeline

`pnpm build` 依次执行：

1. `tsc -p tsconfig.json` 做全量类型检查（`noEmit`）。
2. `tsc -p tsconfig.host.json` 把 `src/host/` 编译到 `dist/`，入口是 `dist/index.js`。
3. `node scripts/build-client.mjs`：先用 `sass.compile()` 把 `src/client/styles.scss` 编译为 `src/client/styles.generated.css`，再调用 esbuild 把 `src/client/index.tsx` 打包为 `dist/client.js`（含 source map），CSS 通过 `--loader:.css=text` 内联进产物。

`pnpm build` runs, in order:

1. `tsc -p tsconfig.json` typechecks everything (`noEmit`).
2. `tsc -p tsconfig.host.json` compiles `src/host/` into `dist/`, with `dist/index.js` as the entry.
3. `node scripts/build-client.mjs` compiles `src/client/styles.scss` to `src/client/styles.generated.css` with `sass.compile()`, then bundles `src/client/index.tsx` into `dist/client.js` (plus a source map) with esbuild; `--loader:.css=text` inlines the CSS into the artifact.

### 为什么客户端仍要打包 / Why the client is still bundled

DSH 每个包只通过 `exports["./client"]` 加载一个惰性工厂（`window.__ModuleLoader__.load({ id, factory })`），浏览器不会按 ESM 去解析插件内部的相对导入，所以拆分后的 `src/client/` 必须打包成单个 `dist/client.js`。React 来自工厂收到的 `require('react')`，即 DSH 的模块表，不进入产物。

DSH loads exactly one lazy factory per package through `exports["./client"]` (`window.__ModuleLoader__.load({ id, factory })`), and the browser does not resolve the plugin's internal relative imports as ESM. The split `src/client/` sources therefore have to be bundled into a single `dist/client.js`. React comes from the factory's `require('react')` (DSH's module table) and is not bundled.

### 产物与开发 / Artifacts and development

- `dist/` 和 `src/client/styles.generated.css` 都是构建产物，已被 Git 忽略；克隆后先 `pnpm install && pnpm build`，DSH 插件管理器不会替你构建。
- `pnpm watch:client` 监听 `src/client/` 与 `styles.scss`，SCSS 改动会重新编译并触发 esbuild 重建；DSH HMR 监听 `dist/client.js`，重建后页面会重新加载该插件。
- 修改 `package.json` 的入口路径后，需要重启 DSH（或在插件页禁用再启用该插件），因为运行中的 Host 会缓存插件清单。

- `dist/` and `src/client/styles.generated.css` are build artifacts and are ignored by Git. After cloning, run `pnpm install && pnpm build` first; DSH Plugin Manager does not build a local directory for you.
- `pnpm watch:client` watches `src/client/` and `styles.scss`; a SCSS change recompiles it and triggers an esbuild rebuild, and DSH HMR watches `dist/client.js` to reload the plugin on the page.
- Changing entry paths in `package.json` requires restarting DSH (or disabling and re-enabling the plugin row), because the running Host caches the plugin manifest.
