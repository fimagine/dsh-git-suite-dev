# 结构与构建

[English](STRUCTURE.md) | 中文

README 只保留安装与使用说明；本文记录目录布局、模块职责和构建管线。

## 目录

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
    sync-handler.ts
    remote-handler.ts
    branch-action-handler.ts
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
    hooks/
      useGitLogView.ts
      useWorkspace.ts
    components/
      BranchDialogs.tsx
      BranchMenu.tsx
      Button.tsx
      CommitActions.tsx
      CommitGraph.tsx
      CommitList.tsx
      CommitRow.tsx
      DeleteRemoteDialog.tsx
      DetailPane.tsx
      DialogShell.tsx
      Dropdown.tsx
      ErrorState.tsx
      FetchDialog.tsx
      GitLogIcon.tsx
      PanelControls.tsx
      PushDialog.tsx
      Refs.tsx
      RefsTree.tsx
      RemoteMenu.tsx
      RepoActions.tsx
      RepositoryMenu.tsx
      SettingsDialog.tsx
      Splitter.tsx
      States.tsx
      SyncDialog.tsx
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
      ui-state.ts
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
docs/
  STRUCTURE.md
  STRUCTURE.zh.md
README.md
README.zh.md
LICENSE
```

## 宿主端

| 文件 | 职责 |
|---|---|
| `host/index.ts` | 注册 `/git-suite` 只读资源路由，以及 switch / action / clone / generate-message / pick-directory / tag / branch / checkout / sync / remote / branch-action POST handler |
| `host/resource.ts` | 校验请求、按 `mode` 分发只读请求并统一错误响应 |
| `host/switch-handler.ts` | 分支切换的 Node handler（DSH resource 路由只接受 GET/HEAD；POST 必须走 handler） |
| `host/workspace-action.ts` | POST `/git-suite/action`：暂存/取消暂存、提交（可 amend）、可选 push 的 Node handler |
| `host/clone-handler.ts` | POST `/git-suite/clone`：校验远端 URL 与目标目录后执行 `git clone` |
| `host/commit-actions.ts` | POST `/git-suite/tag`、`/branch`、`/checkout`：校验标签/分支名，创建标签/分支，检出分支或分离 HEAD（不 force） |
| `host/generate-handler.ts` | POST `/git-suite/generate-message`：读取 staged/unstaged diff，调用 `ctx.llm`（默认模型）生成提交信息 |
| `host/pick-handler.ts` | POST `/git-suite/pick-directory`：调用 `ctx.directoryPicker` 的原生选择器；`mode: 'repo'`（默认）解析 Git 根并检查 DSH 工作区，`mode: 'directory'` 返回普通目录供克隆目标使用 |
| `host/sync-handler.ts` | `POST /git-suite/sync`：`fetch` 支持 `fetchAll`/`prune`/`tags`/`forceTags`（对应 `--all`/`--prune`/`--tags`/`--force`），也可只获取指定 `remote`；`pull` 按所选 `remote`/`branch` 拉取；`push` 按 `refs`（本地分支→远程分支，可逐项 `track`）推送，可带 `tags`/`force` |
| `host/remote-handler.ts` | `POST /git-suite/remote`：删除指定远端（`git remote remove`），会先校验远端存在 |
| `host/branch-action-handler.ts` | `POST /git-suite/branch-action`：本地分支的 `merge`/`rebase`/`rename`/`delete`；校验分支名，失败返回 git 错误详情 |
| `host/dsh.ts` | 本插件使用的 DSH host 类型，包括 `webServer`、工作区、`directoryPicker`、`llm` 与 `agentDefaultModel` |
| `host/http.ts` | JSON 响应、错误序列化、同源与私有头校验 |
| `host/git.ts` | 执行只读 git 命令并把失败映射为错误码 |
| `host/repository.ts` | 校验路径并用 `rev-parse` 解析仓库根目录 |
| `host/scan.ts` | 有界扫描工作区中的 Git 项目 |
| `host/parsers.ts` | 解析 log、commit header、numstat 和 ref |
| `host/routes/` | 分支、引用树、日志分页、提交详情、文件状态/diff 读取，以及本地分支切换 |
| `host/routes/status.ts` | `git status --porcelain=v2` + staged/unstaged numstat：已暂存/未暂存文件、分支/上游/ahead/behind 与作者 |
| `host/routes/workspace-diff.ts` | 单文件 staged/unstaged diff；未跟踪文件合成新增补丁 |
| `host/routes/switch.ts` | 双击本地分支时执行 `git switch`（POST、仅本地分支、不 force） |
| `host/types.ts` | 宿主端 payload 类型 |
| `host/errors.ts` | `RouteError`（状态码、错误码、details） |

## 客户端

| 文件 | 职责 |
|---|---|
| `client/index.tsx` | 向 `window.__ModuleLoader__` 注册惰性工厂 |
| `client/plugin.ts` | 注册 `gitSuite` 字典、`main` 面板、`sidebar.panellist` 入口，以及右侧栏 `git` 标签页类型 |
| `client/runtime.ts` | 绑定 DSH 提供的 React，提供 `h` 与 hooks 包装 |
| `client/dsh.ts` | 本插件使用的 DSH client API 声明 |
| `client/GitLogPanel.tsx` | 面板骨架：头部、控件、提示、历史/提交视图切换与主体 |
| `client/SidebarPanel.tsx` | 右侧栏标签页外壳，使用窄栏单列样式 |
| `client/hooks/useGitLogView.ts` | 项目扫描、引用树、分页日志、详情选择与分页动作 |
| `client/hooks/useWorkspace.ts` | 工作区状态、单文件 diff、暂存/取消暂存、提交动作与 AI 生成提交信息 |
| `client/components/` | 提交列表、提交行、路线图、提交历史工具栏（分支/远端/排序）、引用树（双击切换分支）、可拖拽分割线、详情、设置弹窗、工作区/提交面板、第二行操作栏（最左侧「历史/提交」切换，接着拉取/推送/获取）、仓库 + 菜单（克隆/选择）、`Dropdown`（可选搜索：搜索框在控件上，仓库下拉按名字过滤）、提交右键菜单（标签/分支/检出）、`Button`/`DialogActions` 统一按钮（28px/12px）、错误与状态等展示组件 |
| `client/lib/api.ts` | 带私有头和 `AbortSignal` 的取数封装 |
| `client/lib/graph.ts` | 泳道路由图布局与几何计算 |
| `client/lib/patch.ts` | 把提交的合并补丁拆成每个文件一段，供文件列表切换 |
| `client/lib/refs-tree.ts` | 分支目录折叠、远程/贮藏节点与树搜索过滤 |
| `client/lib/selection.ts` | 选择模型到请求参数、标签文字的映射 |
| `client/lib/projects.ts` | 项目分组、标签、分支标签等纯函数 |
| `client/lib/recent-projects.ts` | 最近项目在 localStorage 与 cookie 间的读写 |
| `client/lib/ui-state.ts` | 面板 UI 状态（视图、排序、页大小、分栏、树展开）在 localStorage 的读写与校验 |
| `client/lib/format.ts` | 日期与相对时间格式化 |
| `client/locales/` | 英文与中文文案，key 集合由英文定义 |
| `client/styles.scss` | SCSS 样式源文件 |
| `client/styles.ts` | 导出内联进产物的 CSS 字符串 |

## 引用树

`mode=tree` 返回本地分支、标签、远程分组、贮藏和子模块。客户端 `buildRefSections` 把 `feat/x` 这样的分支名折叠成目录，`filterTree` 负责搜索过滤；标签、贮藏或子模块为空时不生成对应分组，子模块分组位于最后。点击引用节点产生一个 `Selection`（`head` / `all` / `remotes` / `branch` / `tag` / `stash`），`selectionParams` 再把它变成日志请求参数；点击子模块节点则打开子模块目录（`openPath`）。日志接口通过 `git rev-parse --show-superproject-working-tree` 返回 `superproject`；打开子模块后，项目选择显示 `[submodule]名称`，并出现「← 父仓库」按钮切回父仓库。

- 分支、标签 → `ref=<ref>`；标签允许 `refs/tags/*`。
- 贮藏 → `scope=stash&ref=<commit hash>`，宿主用 `--no-walk -n 1` 只取该提交；详情仍走 `mode=commit`。
- 分支分组直接列出本地分支；远端分组直接列出各远端分支；树中不再提供“所有分支/所有远端”入口。

查看 HEAD 时，树会高亮当前分支（`head` 本身没有节点）。

## 分支切换

双击引用树中的**本地分支**会向 `/git-suite/switch` 发 POST 请求：

- 只接受 `refs/heads/*`；远程分支、标签和贮藏不会触发切换。
- 宿主执行 `git switch <branch>`，从不加 `--force`；工作区有会被覆盖的改动时返回 409 `worktree-dirty`，分支保持不变。
- 成功后客户端重新加载 HEAD 提交和引用树，选择回到 `head`，当前分支高亮移动。
- 该路由只接受 POST（GET 返回 405），并且仍受同源校验与私有请求头保护。

## 文件状态与提交

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

## 提交右键操作

提交列表的每一行右键打开「标签 / 分支 / 检出」菜单（`CommitActions`）：

- **标签** → `POST /git-suite/tag`：`git check-ref-format refs/tags/<name>` 校验名称；`message` 非空时用 `git tag -a -m`，否则轻量标签；只有 `force: true`（勾选「覆盖同名标签」）才加 `-f`。
- **分支** → `POST /git-suite/branch`：`git check-ref-format --branch` 校验后执行 `git branch <name> <hash>`。
- **检出** → `POST /git-suite/checkout`：`branch` 走 `git switch <branch>`，`hash` 走 `git switch --detach <hash>`；不 force；工作区有会被覆盖的改动时返回 409 `worktree-dirty`。客户端在检出前显示确认弹窗，分离 HEAD 会明确警告，分支也会提示工作区改动风险。
- 标签/分支/检出成功后刷新日志和引用树；检出后选择回到 HEAD。
- 三个路由仍是 POST + 同源 + 私有请求头。

## 右侧栏标签页

右侧栏的「开始」页由 `ui-sidebar-right` 提供。插件用 DSH 的两阶段注册接入：

1. `ctx.sidebarRightTabs.register(...)` 注册页类型（`id` 为包名、`kind: 'git'`）和「开始」页入口；`guide` 的 `order: 40` 排在 files（10）、terminal（20）、browser（30）之后。
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitSuite' }, SidebarGitLogPanel)` 注册标签页内容；`key` 必须等于页类型的 `id`。

注册包在 `ctx.inject(['sidebarRightTabs'], …)` 里，右侧栏因此是**可选依赖**：未启用右侧栏时，主面板和左侧栏入口仍然工作。`SidebarGitLogPanel` 的外层 `.dsh-gitlog-sidebar` 把面板切换为窄栏布局（更小的内边距、单列列表/详情、路径输入占满一行）。

## 构建管线

`pnpm build` 依次执行：

1. `tsc -p tsconfig.json` 做全量类型检查（`noEmit`）。
2. `tsc -p tsconfig.host.json` 把 `src/host/` 编译到 `dist/`，入口是 `dist/index.js`。
3. `node scripts/build-client.mjs`：先用 `sass.compile()` 把 `src/client/styles.scss` 编译为 `src/client/styles.generated.css`，再调用 esbuild 把 `src/client/index.tsx` 打包为 `dist/client.js`（含 source map），CSS 通过 `--loader:.css=text` 内联进产物。

### 为什么客户端仍要打包

DSH 每个包只通过 `exports["./client"]` 加载一个惰性工厂（`window.__ModuleLoader__.load({ id, factory })`），浏览器不会按 ESM 去解析插件内部的相对导入，所以拆分后的 `src/client/` 必须打包成单个 `dist/client.js`。React 来自工厂收到的 `require('react')`，即 DSH 的模块表，不进入产物。

### 产物与开发

- `dist/` 和 `src/client/styles.generated.css` 都是构建产物，已被 Git 忽略；克隆后先 `pnpm install && pnpm build`，DSH 插件管理器不会替你构建。
- `pnpm watch:client` 监听 `src/client/` 与 `styles.scss`，SCSS 改动会重新编译并触发 esbuild 重建；DSH HMR 监听 `dist/client.js`，重建后页面会重新加载该插件。
- 修改 `package.json` 的入口路径后，需要重启 DSH（或在插件页禁用再启用该插件），因为运行中的 Host 会缓存插件清单。
