# 结构与构建 / Structure and build

README 只保留安装与使用说明；本文记录目录布局、模块职责和构建管线。
The README keeps installation and usage; this document records the layout, module responsibilities, and build pipeline.

## 目录 / Layout

```text
src/
  host/
    index.ts
    resource.ts
    switch-handler.ts
    workspace-action.ts
    clone-handler.ts
    commit-actions.ts
    generate-handler.ts
    pick-handler.ts
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
      refs.ts
      log.ts
      commit.ts
      status.ts
      workspace-diff.ts
      switch.ts
  client/
    index.tsx
    plugin.ts
    runtime.ts
    dsh.ts
    GitLogPanel.tsx
    SidebarPanel.tsx
    hooks/useGitLogView.ts
    hooks/useWorkspace.ts
    components/
      CommitGraph.tsx
      CommitList.tsx
      CommitRow.tsx
      DetailPane.tsx
      ErrorState.tsx
      GitLogIcon.tsx
      PanelControls.tsx
      Refs.tsx
      RefsTree.tsx
      RepositoryMenu.tsx
      CommitActions.tsx
      DialogShell.tsx
      SettingsDialog.tsx
      Splitter.tsx
      States.tsx
      TreeIcons.tsx
      WorkspacePane.tsx
    lib/
      api.ts
      format.ts
      graph.ts
      patch.ts
      projects.ts
      recent-projects.ts
      refs-tree.ts
      selection.ts
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
| `host/index.ts` | 注册 `/git-suite` 只读资源路由，以及 switch / action / clone / generate-message / pick-directory / tag / branch / checkout / sync / remote / branch-action POST handler / Registers the read-only `/git-suite` route and the POST handlers for switch, actions, clone, message generation, directory picking, tag, branch, checkout, sync, remote, and branch actions |
| `host/resource.ts` | 校验请求、按 `mode` 分发只读请求并统一错误响应 / Admits requests, dispatches read modes, and maps errors to responses |
| `host/switch-handler.ts` | 分支切换的 Node handler（DSH resource 路由只接受 GET/HEAD；POST 必须走 handler）/ Node handler for branch switching (DSH resource routes are GET/HEAD only; a POST needs a handler) |
| `host/workspace-action.ts` | POST `/git-suite/action`：暂存/取消暂存、提交（可 amend）、可选 push 的 Node handler / Node handler for stage/unstage, commit (optionally amend), and the optional push |
| `host/clone-handler.ts` | POST `/git-suite/clone`：校验远端 URL 与目标目录后执行 `git clone` / Node handler that validates the remote URL and destination, then runs `git clone` |
| `host/commit-actions.ts` | POST `/git-suite/tag`、`/branch`、`/checkout`：校验标签/分支名，创建标签/分支，检出分支或分离 HEAD（不 force）/ Validates names, creates tags/branches, and checks out a branch or detached HEAD (never forced) |
| `host/generate-handler.ts` | POST `/git-suite/generate-message`：读取 staged/unstaged diff，调用 `ctx.llm`（默认模型）生成提交信息 / Node handler that reads the staged/unstaged diff and calls `ctx.llm` with the default model |
| `host/pick-handler.ts` | POST `/git-suite/pick-directory`：调用 `ctx.directoryPicker` 的原生选择器；`mode: 'repo'`（默认）解析 Git 根并检查 DSH 工作区，`mode: 'directory'` 返回普通目录供克隆目标使用 / Opens the native `ctx.directoryPicker`; `mode: 'repo'` (default) resolves the Git root and checks the DSH workspace, while `mode: 'directory'` returns a plain directory for clone destinations |
| `host/dsh.ts` | 本插件使用的 DSH host 类型，包括 `webServer`、工作区、`directoryPicker`、`llm` 与 `agentDefaultModel` / Local DSH host types, including `webServer`, workspaces, `directoryPicker`, `llm`, and `agentDefaultModel` |
| `host/http.ts` | JSON 响应、错误序列化、同源与私有头校验 / JSON responses, error serialization, same-origin and private-header checks |
| `host/git.ts` | 执行只读 git 命令并把失败映射为错误码 / Runs read-only git commands and maps failures to error codes |
| `host/repository.ts` | 校验路径并用 `rev-parse` 解析仓库根目录 / Validates paths and resolves the repository root with `rev-parse` |
| `host/scan.ts` | 有界扫描工作区中的 Git 项目 / Scans workspaces for Git projects with depth and entry limits |
| `host/parsers.ts` | 解析 log、commit header、numstat 和 ref / Parses log output, commit headers, numstat, and refs |
| `host/routes/` | 分支、引用树、日志分页、提交详情、文件状态/diff 读取，以及本地分支切换 / Readers for branches, the refs tree, paged log, commit detail, working-tree status/diff, plus local branch switching |
| `host/routes/status.ts` | `git status --porcelain=v2` + staged/unstaged numstat：已暂存/未暂存文件、分支/上游/ahead/behind 与作者 / Working-tree status: staged/unstaged files, branch/upstream/ahead/behind, and the Git author |
| `host/routes/workspace-diff.ts` | 单文件 staged/unstaged diff；未跟踪文件合成新增补丁 / Per-file staged/unstaged diff; synthesizes an added-file patch for untracked files |
| `host/routes/switch.ts` | 双击本地分支时执行 `git switch`（POST、仅本地分支、不 force）/ Runs `git switch` for a local-branch double-click (POST, local-only, never forced) |
| `host/types.ts` | 宿主端 payload 类型 / Host payload types |
| `host/dsh.ts` | 本插件使用的 DSH host API 声明 / Local declarations for the DSH host API used here |
| `host/errors.ts` | `RouteError`（状态码、错误码、details）/ `RouteError` with status, code, and details |

## 客户端 / Client half

| 文件 / File | 职责 / Responsibility |
|---|---|
| `client/index.tsx` | 向 `window.__ModuleLoader__` 注册惰性工厂 / Registers the lazy factory with `window.__ModuleLoader__` |
| `client/plugin.ts` | 注册 `gitSuite` 字典、`main` 面板、`sidebar.panellist` 入口，以及右侧栏 `git` 标签页类型 / Registers the `gitSuite` dictionaries, the `main` panel, the `sidebar.panellist` entry, and the right-sidebar `git` tab type |
| `client/runtime.ts` | 绑定 DSH 提供的 React，提供 `h` 与 hooks 包装 / Binds the React instance from DSH and exposes `h` plus hook wrappers |
| `client/dsh.ts` | 本插件使用的 DSH client API 声明 / Local declarations for the DSH client API used here |
| `client/GitLogPanel.tsx` | 面板骨架：头部、控件、提示、历史/提交视图切换与主体 / Panel shell: header, controls, notes, history/commit view switch, and body |
| `client/SidebarPanel.tsx` | 右侧栏标签页外壳，使用窄栏单列样式 / Right-sidebar tab wrapper with the narrow single-column layout |
| `client/hooks/useGitLogView.ts` | 项目扫描、引用树、分页日志、详情选择与分页动作 / Project scan, refs tree, paged log, detail selection, and actions |
| `client/hooks/useWorkspace.ts` | 工作区状态、单文件 diff、暂存/取消暂存、提交动作与 AI 生成提交信息 / Working-tree status, per-file diff, stage/unstage, commit actions, and AI message generation |
| `host/sync-handler.ts` | `POST /git-suite/sync`：`fetch` 支持 `fetchAll`/`prune`/`tags`/`forceTags`（对应 `--all`/`--prune`/`--tags`/`--force`），也可只获取指定 `remote`；`pull` 按所选 `remote`/`branch` 拉取；`push` 按 `refs`（本地分支→远程分支，可逐项 `track`）推送，可带 `tags`/`force` / `POST /git-suite/sync`: fetch supports fetchAll/prune/tags/forceTags (or one remote), pull a chosen remote branch, and push per-ref local→remote mappings with optional tracking, tags, and force |
| `host/remote-handler.ts` | `POST /git-suite/remote`：删除指定远端（`git remote remove`），会先校验远端存在 / `POST /git-suite/remote`: remove one configured remote after validating it exists |
| `host/branch-action-handler.ts` | `POST /git-suite/branch-action`：本地分支的 `merge`/`rebase`/`rename`/`delete`；校验分支名，失败返回 git 错误详情 / `POST /git-suite/branch-action`: merge, rebase, rename, or delete one local branch with validation and git error details |
| `client/components/` | 提交列表、提交行、路线图、提交历史工具栏（分支/远端/排序）、引用树（双击切换分支）、可拖拽分割线、详情、设置弹窗、工作区/提交面板、第二行操作栏（最左侧「历史/提交」切换，接着拉取/推送/获取）、仓库 + 菜单（克隆/选择）、`Dropdown`（可选搜索：搜索框在控件上，仓库下拉按名字过滤）、提交右键菜单（标签/分支/检出）、`Button`/`DialogActions` 统一按钮（28px/12px）、错误与状态等展示组件 / Presentational components for the list, rows, graph, history toolbar (branch/remotes/sort), refs tree (double-click switches branches), draggable splitters, detail, settings dialog, working-tree/commit pane, second-line action row (history/commit switch then pull/push/fetch), repository + menu (clone/select), `Dropdown` (optional name search, enabled for repositories), commit context menu (tag/branch/checkout), shared `Button`/`DialogActions` (28px/12px), errors, and states |
| `client/lib/api.ts` | 带私有头和 `AbortSignal` 的取数封装 / Fetch wrapper with the private header and `AbortSignal` |
| `client/lib/graph.ts` | 泳道路由图布局与几何计算 / Lane layout and geometry for the commit graph |
| `client/lib/patch.ts` | 把提交的合并补丁拆成每个文件一段，供文件列表切换 / Splits a commit's combined patch into one section per file for the file list |
| `client/lib/refs-tree.ts` | 分支目录折叠、远程/贮藏节点与树搜索过滤 / Branch folder folding, remote/stash nodes, and tree search filtering |
| `client/lib/selection.ts` | 选择模型到请求参数、标签文字的映射 / Maps the selection model to request parameters and labels |
| `client/lib/projects.ts` | 项目分组、标签、分支标签等纯函数 / Pure helpers for project groups, labels, and branch labels |
| `client/lib/recent-projects.ts` | 最近项目在 localStorage 与 cookie 间的读写 / Recent-project persistence across localStorage and a cookie |
| `client/lib/format.ts` | 日期与相对时间格式化 / Date and relative-time formatting |
| `client/locales/` | 英文与中文文案，key 集合由英文定义 / English and Chinese strings, with the English key set as the source of truth |
| `client/styles.scss` | SCSS 样式源文件 / SCSS stylesheet source |
| `client/styles.ts` | 导出内联进产物的 CSS 字符串 / Exports the CSS string inlined into the artifact |

## 引用树 / Refs tree

`mode=tree` 返回本地分支、标签、远程分组、贮藏和子模块。客户端 `buildRefSections` 把 `feat/x` 这样的分支名折叠成目录，`filterTree` 负责搜索过滤；标签、贮藏或子模块为空时不生成对应分组，子模块分组位于最后。点击引用节点产生一个 `Selection`（`head` / `all` / `remotes` / `branch` / `tag` / `stash`），`selectionParams` 再把它变成日志请求参数；点击子模块节点则打开子模块目录（`openPath`）。日志接口通过 `git rev-parse --show-superproject-working-tree` 返回 `superproject`；打开子模块后，项目选择显示 `[submodule]名称`，并出现「← 父仓库」按钮切回父仓库。

- 分支、标签 → `ref=<ref>`；标签允许 `refs/tags/*`。
- 贮藏 → `scope=stash&ref=<commit hash>`，宿主用 `--no-walk -n 1` 只取该提交；详情仍走 `mode=commit`。
- 分支分组直接列出本地分支；远端分组直接列出各远端分支；树中不再提供“所有分支/所有远端”入口。

查看 HEAD 时，树会高亮当前分支（`head` 本身没有节点）。

The tree reads `mode=tree`, which returns local branches, tags, remote groups, stashes, and submodules. On the client, `buildRefSections` folds names like `feat/x` into folders and `filterTree` implements search; tags, stashes, or submodules with no entries produce no section, and the submodule section sits last. Clicking a ref node produces a `Selection` (`head` / `all` / `remotes` / `branch` / `tag` / `stash`) that `selectionParams` turns into log request parameters; clicking a submodule node opens that submodule directory (`openPath`). The log payload reports `superproject` via `git rev-parse --show-superproject-working-tree`; opening a submodule shows `[submodule]name` in the project selector and a **← Parent** button back to the superproject.

- Branches and tags → `ref=<ref>`; tags may use `refs/tags/*`.
- Stashes → `scope=stash&ref=<commit hash>`; the host runs `--no-walk -n 1` to load only that commit, and its detail still uses `mode=commit`.
- Branch groups list local branches directly; remote groups list their remote branches directly; the tree no longer offers "all branches" or "all remotes" entries.

While viewing HEAD, the tree highlights the checked-out branch (`head` itself has no node).

## 分支切换 / Branch switching

双击引用树中的**本地分支**会向 `/git-suite/switch` 发 POST 请求：

- 只接受 `refs/heads/*`；远程分支、标签和贮藏不会触发切换。
- 宿主执行 `git switch <branch>`，从不加 `--force`；工作区有会被覆盖的改动时返回 409 `worktree-dirty`，分支保持不变。
- 成功后客户端重新加载 HEAD 提交和引用树，选择回到 `head`，当前分支高亮移动。
- 该路由只接受 POST（GET 返回 405），并且仍受同源校验与私有请求头保护。

Double-clicking a **local branch** in the tree POSTs to `/git-suite/switch`:

- Only `refs/heads/*` is accepted; remote branches, tags, and stashes never switch.
- The host runs `git switch <branch>` and never adds `--force`; a switch that would overwrite local changes returns 409 `worktree-dirty` and leaves the branch unchanged.
- On success the client reloads HEAD and the refs tree, resets the selection to `head`, and moves the current-branch highlight.
- The route accepts POST only (GET returns 405) and still requires the same-origin check and the private request header.

## 文件状态与提交 / Working tree and commits

第二行的「历史 / 提交」在同一页内切换提交历史与提交/文件状态（`WorkspacePane` + `useWorkspace`），共用仓库/路径、引用树和分支切换：

- `GET /git-suite?mode=status` 读取 `git status --porcelain=v2 -z --branch -uall`，加上 staged/unstaged numstat 和未跟踪文件行数，返回已暂存/未暂存列表、当前分支、上游、ahead/behind 与 Git 用户。
- `GET /git-suite?mode=workspace-diff&file=…&scope=staged|unstaged|untracked` 返回单个文件的 diff；未跟踪文件由宿主合成 `/dev/null → file` 补丁，单文件补丁上限 400k 字符。
- `POST /git-suite/action`（Node handler，因为 DSH resource 路由只接受 GET/HEAD）接受 JSON：
  - `stage` / `unstage`，带 `paths` 或 `all`，分别执行 `git add -A` / `git reset -q HEAD`。
  - `commit`，带 `message`、`amend`、`push`，执行 `git commit -m`（可选 `--amend`），可选 `git push` 到当前上游。
- 暂存以文件为单位（暂不提供 hunk/区块级暂存）；提交成功后刷新状态并重新加载 HEAD/引用树。工具栏的拉取/推送可选择远端与分支，强制推送仅在明确勾选时使用；提交后的推送仍只推送到当前上游。
- 提交信息旁的 **AI 生成** 通过 `POST /git-suite/generate-message` 读取 staged（无暂存时 unstaged）diff，调用 `ctx.llm.stream()`（provider/model 来自 `ctx.agentDefaultModel.currentSelection()`）生成提交信息；文件列表与 diff 会发送给配置的模型提供方，生成结果只填入输入框，不写仓库。没有默认模型、没有改动或模型失败时返回明确错误。
- 仓库/路径旁的 **+** 菜单（点击或悬停）提供「克隆远端仓库」和「选择本地仓库」：克隆通过 `POST /git-suite/clone` 校验 URL（https / ssh / git / file / 绝对本地路径，拒绝 `ext::` 等）与目标（绝对路径、父目录存在、目标不存在）后执行 `git clone`；克隆对话框的「克隆到」可用 `POST /git-suite/pick-directory` 的 `mode: 'directory'` 选择父目录并自动追加仓库名。选择本地仓库弹窗提供「选择目录」（`mode: 'repo'` 的原生选择器）、已扫描仓库和手动路径；点「打开」只在当前面板打开仓库。如需加入 DSH 工作区，请使用 DSH 自带的 Workspaces 添加入口。目录选择器不是 native 时提示手动输入路径。
- 所有写入仍是 POST + 同源 + 私有请求头；错误以 JSON 返回并在工作区显示。

The second row's **History / Commit** switch changes between history and the commit/file-status view in the same page (`WorkspacePane` + `useWorkspace`), sharing the repository/path controls, refs tree, and branch switching:

- `GET /git-suite?mode=status` reads `git status --porcelain=v2 -z --branch -uall`, plus staged/unstaged numstat and untracked line counts, returning staged/unstaged files, the branch, upstream, ahead/behind, and the Git author.- `GET /git-suite?mode=workspace-diff&file=…&scope=staged|unstaged|untracked` returns one file's diff; untracked files get a synthesized `/dev/null → file` patch, capped at 400k characters per file.
- `POST /git-suite/action` (a Node handler, because DSH resource routes are GET/HEAD only) accepts JSON:
  - `stage` / `unstage` with `paths` or `all`, running `git add -A` / `git reset -q HEAD`.
  - `commit` with `message`, `amend`, and `push`, running `git commit -m` (optionally `--amend`) and optionally `git push` to the configured upstream.
- Staging is file-level (hunk-level staging is not available yet); a successful commit refreshes the status and reloads HEAD/the refs tree. The toolbar's pull/push can pick a remote and branch, and force push is used only when explicitly checked; the push after committing still targets the configured upstream only.
- **Generate with AI** beside the commit message POSTs to `/git-suite/generate-message`, which reads the staged (otherwise unstaged) diff and calls `ctx.llm.stream()` with the provider/model from `ctx.agentDefaultModel.currentSelection()`; the file list and diff are sent to the configured model provider, and the generated text only fills the input. Missing default model, no changes, and model failures return explicit errors.
- The **+** menu beside the repository/path controls (click or hover) offers **Clone remote repository** and **Select local repository**: cloning POSTs to `/git-suite/clone`, which validates the URL (https / ssh / git / file / absolute local paths, rejecting `ext::` and similar) and the destination (absolute, existing parent, not already present), runs `git clone`; the clone dialog's destination can use `POST /git-suite/pick-directory` with `mode: 'directory'` to pick a parent folder and append the repository name. The select-local dialog offers **Choose folder** (`mode: 'repo'` native picker), scanned repositories, and a manual path; **Open** only opens the repository in this panel. Use DSH's own Workspaces add flow to register a DSH workspace. A non-native picker asks for a typed path.
- Every write remains POST + same-origin + private request header; errors return as JSON and render in the workspace.

## 提交右键操作 / Commit context actions

提交列表的每一行右键打开「标签 / 分支 / 检出」菜单（`CommitActions`）：

- **标签** → `POST /git-suite/tag`：`git check-ref-format refs/tags/<name>` 校验名称；`message` 非空时用 `git tag -a -m`，否则轻量标签；只有 `force: true`（勾选「覆盖同名标签」）才加 `-f`。
- **分支** → `POST /git-suite/branch`：`git check-ref-format --branch` 校验后执行 `git branch <name> <hash>`。
- **检出** → `POST /git-suite/checkout`：`branch` 走 `git switch <branch>`，`hash` 走 `git switch --detach <hash>`；不 force；工作区有会被覆盖的改动时返回 409 `worktree-dirty`。客户端在检出前显示确认弹窗，分离 HEAD 会明确警告，分支也会提示工作区改动风险。
- 标签/分支/检出成功后刷新日志和引用树；检出后选择回到 HEAD。
- 三个路由仍是 POST + 同源 + 私有请求头。

Right-clicking a commit row opens the **Tag / Branch / Checkout** menu (`CommitActions`):

- **Tag** → `POST /git-suite/tag`: validates with `git check-ref-format refs/tags/<name>`; a non-empty message uses `git tag -a -m`, otherwise a lightweight tag; `-f` is added only when `force: true` (the **Force an existing tag** checkbox) is set.
- **Branch** → `POST /git-suite/branch`: validates with `git check-ref-format --branch`, then runs `git branch <name> <hash>`.
- **Checkout** → `POST /git-suite/checkout`: `branch` runs `git switch <branch>`, `hash` runs `git switch --detach <hash>`; never forced; a working tree that would be overwritten returns 409 `worktree-dirty`. The client asks for confirmation first, warns explicitly for a detached HEAD, and mentions the working-tree risk for a branch.
- Tag/branch/checkout refresh the log and refs tree; checkout resets the selection to HEAD.
- All three routes are POST + same-origin + the private request header.

## 右侧栏标签页 / Right-sidebar tab

右侧栏的「开始」页由 `ui-sidebar-right` 提供。插件用 DSH 的两阶段注册接入：

1. `ctx.sidebarRightTabs.register(...)` 注册页类型（`id` 为包名、`kind: 'git'`）和「开始」页入口；`guide` 的 `order: 40` 排在 files（10）、terminal（20）、browser（30）之后。
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitSuite' }, SidebarGitLogPanel)` 注册标签页内容；`key` 必须等于页类型的 `id`。

注册包在 `ctx.inject(['sidebarRightTabs'], …)` 里，右侧栏因此是**可选依赖**：未启用右侧栏时，主面板和左侧栏入口仍然工作。`SidebarGitLogPanel` 的外层 `.dsh-gitlog-sidebar` 把面板切换为窄栏布局（更小的内边距、单列列表/详情、路径输入占满一行）。

The right sidebar's Start page belongs to `ui-sidebar-right`. The plugin joins it through the same two-stage registration any tab type uses:

1. `ctx.sidebarRightTabs.register(...)` registers the page type (`id` is the package name, `kind: 'git'`) and its Start-page entry; the entry's `order: 40` places it after files (10), terminal (20), and browser (30).
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitSuite' }, SidebarGitLogPanel)` registers the tab body; `key` must equal the type's `id`.

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

