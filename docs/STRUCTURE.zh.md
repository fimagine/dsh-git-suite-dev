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
    remote-url.ts
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
      AddBranchDialog.tsx
      AddRemoteDialog.tsx
      AddTagDialog.tsx
      BranchDialogs.tsx
      BranchMenu.tsx
      Button.tsx
      CommitActions.tsx
      CommitColumnsMenu.tsx
      CommitGraph.tsx
      CommitList.tsx
      CommitRefField.tsx
      CommitRow.tsx
      DeleteRemoteBranchDialog.tsx
      DeleteRemoteDialog.tsx
      DeleteTagDialog.tsx
      DetailPane.tsx
      DialogShell.tsx
      Dropdown.tsx
      EditRemoteDialog.tsx
      EditTagDialog.tsx
      ForcePushTagDialog.tsx
      FetchTagDialog.tsx
      FileActionDialog.tsx
      ErrorState.tsx
      FetchDialog.tsx
      GitLogIcon.tsx
      IgnoreFileDialog.tsx
      PanelControls.tsx
      PushDialog.tsx
      Refs.tsx
      RefsTree.tsx
      RemoteBranchMenu.tsx
      RemoteMenu.tsx
      RepoActions.tsx
      RepositoryMenu.tsx
      SettingsDialog.tsx
      Splitter.tsx
      States.tsx
      SyncDialog.tsx
      TagMenu.tsx
      Toast.tsx
      Tooltip.tsx
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
| `host/workspace-action.ts` | POST `/git-suite/action`：暂存/取消暂存、重置单个文件的未暂存改动（`checkout --`）、删除单个未跟踪文件、提交（可 amend）、可选 push 的 Node handler |
| `host/clone-handler.ts` | POST `/git-suite/clone`：校验远端 URL 与目标目录后，先克隆到目标同级的临时目录，成功后改名到目标目录 |
| `host/commit-actions.ts` | POST `/git-suite/tag`、`/branch`、`/checkout`：校验标签/分支名，创建标签/分支（可指定提交或任意引用作为起点），检出本地分支、指定提交或任意引用（分离 HEAD，不 force） |
| `host/generate-handler.ts` | POST `/git-suite/generate-message`：读取 staged/unstaged diff，调用 `ctx.llm`（默认模型）生成提交信息 |
| `host/pick-handler.ts` | POST `/git-suite/pick-directory`：调用 `ctx.directoryPicker` 的原生选择器；`mode: 'repo'`（默认）解析 Git 根并检查 DSH 工作区，`mode: 'directory'` 返回普通目录供克隆目标使用 |
| `host/sync-handler.ts` | `POST /git-suite/sync`：`fetch` 支持 `fetchAll`/`prune`/`tags`/`forceTags`（对应 `--all`/`--prune`/`--tags`/`--force`），也可只获取指定 `remote`；`pull` 按所选 `remote`/`branch` 拉取；`push` 按 `refs`（本地分支→远程分支，可逐项 `track`）推送，支持单个标签（`tagRefs`）、全部标签（`tags`）与 `force`；`fetch-tag` 用远端覆盖单个本地标签 |
| `host/remote-handler.ts` | `POST /git-suite/remote`：新增（`action: 'add'`）、改名和/或修改地址（`action: 'set-url'`）或删除（`action: 'remove'`）指定远端，会校验名称、地址格式以及是否已存在 |
| `host/branch-action-handler.ts` | `POST /git-suite/branch-action`：本地分支的 `merge`/`rebase`/`rename`/`delete`；以远端分支为起点检出为本地跟踪分支（`track`）；删除远端上的分支（`delete-remote`，即 `push --delete`）；校验分支名/远端名，失败返回 git 错误详情 |
| `host/dsh.ts` | 本插件使用的 DSH host 类型，包括 `webServer`、工作区、`directoryPicker`、`llm` 与 `agentDefaultModel` |
| `host/http.ts` | JSON 响应、错误序列化、同源与私有头校验 |
| `host/git.ts` | 执行只读 git 命令并把失败映射为错误码 |
| `host/repository.ts` | 校验路径并用 `rev-parse` 解析仓库根目录 |
| `host/remote-url.ts` | 接受 https/ssh/git/file 与绝对本地路径，拒绝 `ext::` 之类的命令型传输 |
| `host/reveal-handler.ts` | `POST /git-suite/reveal`：校验路径在仓库内、文件存在，然后在系统文件浏览器中选中该文件 |
| `host/scan.ts` | 有界扫描工作区中的 Git 项目 |
| `host/parsers.ts` | 解析 log、commit header、numstat 和 ref |
| `host/routes/` | 分支、引用树、日志分页、提交详情、文件状态/diff 读取，以及本地分支切换 |
| `host/routes/status.ts` | `git status --porcelain=v2` + staged/unstaged numstat：已暂存/未暂存文件、分支/上游/ahead/behind 与作者 |
| `host/routes/workspace-diff.ts` | 单文件 staged/unstaged diff；未跟踪文件合成新增补丁 |
| `host/routes/switch.ts` | 双击本地分支时执行 `git switch`（POST、仅本地分支、不 force） |
| `host/routes/tag.ts` | `mode=tag`：单个标签指向的提交、短哈希、标题、附注说明，以及是否为附注标签 |
| `host/routes/tag-status.ts` | `mode=tag-status`：把本地标签与某个远端比较（`ls-remote --tags`，附注标签解析到提交），给出 相同/不同/仅本地 与仅远端的标签名 |
| `host/routes/resolve.ts` | `mode=resolve`：把任意引用（`HEAD~2`、分支、标签、短哈希）解析成提交哈希、短哈希、作者、日期与标题 |
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
| `client/components/` | 提交列表、提交行、路线图、提交历史工具栏（分支/远端/排序）、引用树（双击切换分支，分支/远端分组右侧「+」添加分支/远端）、可拖拽分割线、详情、设置弹窗、工作区/提交面板、第二行操作栏（最左侧「历史/提交」切换，接着拉取/推送/获取）、仓库 + 菜单（克隆/选择）、添加/删除远端弹窗、编辑远端弹窗（名称 + 地址）、新建分支弹窗、`Dropdown`（可选搜索：搜索框在控件上，仓库下拉按名字过滤）、提交右键菜单（标签/分支/检出）、标签右键菜单（检出）、远端分支右键菜单（检出/合并/变基/拉取/删除）、提交列表的列显隐菜单、文件右键菜单（在文件资源管理器中显示）、toast 提示、可编辑的提交引用字段（实时解析）、`Button`/`DialogActions` 统一按钮（28px/12px）、错误与状态等展示组件 |
| `client/lib/api.ts` | 带私有头和 `AbortSignal` 的取数封装 |
| `client/lib/graph.ts` | 泳道路由图布局与几何计算 |
| `client/lib/patch.ts` | 把提交的合并补丁拆成每个文件一段，供文件列表切换 |
| `client/lib/refs-tree.ts` | 分支目录折叠、远程/贮藏节点与树搜索过滤 |
| `client/lib/selection.ts` | 选择模型到请求参数、标签文字的映射 |
| `client/lib/projects.ts` | 项目分组、标签、分支标签等纯函数 |
| `client/lib/recent-projects.ts` | 最近项目在 localStorage 与 cookie 间的读写 |
| `client/lib/ui-state.ts` | 面板 UI 状态（视图、排序、页大小、分栏、树展开）在 localStorage 的读写与校验 |
| `client/lib/format.ts` | 绝对日期时间格式化（中文 `2026-10-25 03:10:45`，英文 `Oct 25, 2026, 03:10:45`） |
| `client/locales/` | 英文与中文文案，key 集合由英文定义 |
| `client/styles.scss` | SCSS 样式源文件 |
| `client/styles.ts` | 导出内联进产物的 CSS 字符串 |

## 引用树

`mode=tree` 返回本地分支、标签、远程分组、贮藏和子模块。客户端 `buildRefSections` 把 `feat/x` 这样的分支名折叠成目录，`filterTree` 负责搜索过滤；标签、贮藏或子模块为空时不生成对应分组，子模块分组位于最后。点击引用节点产生一个 `Selection`（`head` / `all` / `remotes` / `branch` / `tag` / `stash`），`selectionParams` 再把它变成日志请求参数；点击子模块节点则打开子模块目录（`openPath`）。日志接口通过 `git rev-parse --show-superproject-working-tree` 返回 `superproject`；打开子模块后，项目选择显示 `[submodule]名称`，并出现「← 父仓库」按钮切回父仓库。

- 分支、标签 → `ref=<ref>`；标签允许 `refs/tags/*`。
- 贮藏 → `scope=stash&ref=<commit hash>`，宿主用 `--no-walk -n 1` 只取该提交；详情仍走 `mode=commit`。
- 分支分组直接列出本地分支；远端分组直接列出各远端分支；树中不再提供“所有分支/所有远端”入口。
- 本地分支领先/落后上游时，名称后显示 `↑N` / `↓N`（取自 `%(upstream:track)`）；上游已不存在时显示「上游已删除」。
- 标签会自动与上游所属远端（没有上游则第一个远端）比较：树加载完成后自动比对一次，标签集合变化时再自动比对；标签分组行不再放对比按钮，改放「+」打开新建标签弹窗。仅本地存在的标签显示上传箭头图标，提交与远端不同的显示不等号图标；不再显示汇总行。远端不可达时静默失败。
- 远端分组行尾有「+」按钮：打开添加远端弹窗，向 `/git-suite/remote` POST `{ action: 'add', name, url }`；添加成功后该分组会自动展开。
- 分支分组行尾有同样的「+」按钮：打开新建分支弹窗，向 `/git-suite/branch` POST `{ name, base }`；`base` 留空表示 `HEAD`，也可以填分支、标签或任意版本表达式。
- 远端分支右键菜单：检出为本地跟踪分支、合并/变基到当前分支、拉取到当前分支（走 `/git-suite/sync`）、删除远端分支（二次确认，`push --delete`）。
- 远端分组右键打开菜单：获取 / 拉取 / 推送、**编辑远端**（可改名并改地址，`POST /git-suite/remote { action: 'set-url', newName }`）、删除；悬停该行会显示已配置的远端地址。
- 右键提交列表表头打开复选菜单，选择显示图表 / 日期 / 作者 / 提交列（描述列始终显示）；选择会持久化，面板宽度小于 760px 时自动隐藏作者与提交列并在菜单中禁用这两项。
- 行内提示（远端地址、子模块路径、切换分支提示、被截断的分支名）使用插件自己的 `useTooltip` 绘制，而不是浏览器原生 `title` 气泡，保证 Windows、macOS 与内嵌 WebView 下表现一致。
- 标签节点右键菜单：「检出 {tag}」「编辑 {tag}」「推送 {tag}」「强制推送 {tag}」「用远端覆盖本地 {tag}」（仅当自动比对发现不一致时出现）「删除 {tag}」。检出通过 `POST /git-suite/checkout { ref }` 分离 HEAD；编辑先用 `mode=tag` 读取该标签，再保存改名、改提交或改说明；推送走 `/git-suite/sync { action: 'push', tagRefs: [名称] }`；强制推送与「用远端覆盖本地」（`fetch-tag`）都会改写标签指向，因此各自先进警告确认框；删除经二次确认后执行 `POST /git-suite/tag { action: 'delete' }`。

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
- 暂存以文件为单位（暂不提供 hunk/区块级暂存）；每个文件行最右侧有 **+**（暂存该文件）或 **−**（取消暂存）按钮，双击文件行也会在已暂存/未暂存之间切换（行文字 `user-select: none`，双击不会选中文本）；提交成功后刷新状态并重新加载 HEAD/引用树。工具栏的拉取/推送可选择远端与分支，强制推送仅在明确勾选时使用；提交后的推送仍只推送到当前上游。
- 提交信息旁的 **AI 生成** 通过 `POST /git-suite/generate-message` 读取 staged（无暂存时 unstaged）diff，调用 `ctx.llm.stream()`（provider/model 来自 `ctx.agentDefaultModel.currentSelection()`）生成提交信息；文件列表与 diff 会发送给配置的模型提供方，生成结果只填入输入框，不写仓库。没有默认模型、没有改动或模型失败时返回明确错误。
- 仓库/路径旁的 **+** 菜单（点击或悬停）提供「克隆远端仓库」和「选择本地仓库」：克隆通过 `POST /git-suite/clone` 校验 URL（https / ssh / git / file / 绝对本地路径，拒绝 `ext::` 等）与目标（绝对路径、父目录存在、目标不存在）后执行 `git clone`；克隆对话框的「克隆到」可用 `POST /git-suite/pick-directory` 的 `mode: 'directory'` 选择父目录并自动追加仓库名。选择本地仓库弹窗提供「选择目录」（`mode: 'repo'` 的原生选择器）、已扫描仓库和手动路径；点「打开」只在当前面板打开仓库。如需加入 DSH 工作区，请使用 DSH 自带的 Workspaces 添加入口。目录选择器不是 native 时提示手动输入路径。
- 改动文件右键菜单在「在文件资源管理器中显示」之外多一项危险操作：未暂存的已修改文件是「重置更改」（`git checkout --`，带警告确认），未跟踪文件是「删除文件」（带警告确认；宿主对已跟踪路径返回 `409 tracked-file`）。未跟踪文件还提供「忽略」：向 `.gitignore` 追加一条规则，可选仅该路径、仅同名文件（任意目录）、或 `*.后缀`；已暂存文件只提供定位。
- 改动文件右键打开菜单，提供「在文件资源管理器中显示」（`POST /git-suite/reveal`）：宿主拒绝仓库外路径，文件不存在时返回 `404 file-missing`，否则用系统文件浏览器选中该文件（`explorer /select,`、`open -R`、`xdg-open`）。文件缺失时以 toast 提示，不占用行内错误区。
- 所有写入仍是 POST + 同源 + 私有请求头；错误以 JSON 返回并在工作区显示。

## 提交右键操作

提交列表的每一行右键打开「标签 / 分支 / 检出」菜单（`CommitActions`）：

- **标签** → `POST /git-suite/tag`（弹窗标题为「新建标签」）：`git check-ref-format refs/tags/<name>` 校验名称；`message` 非空时用 `git tag -a -m`，否则轻量标签；只有 `force: true`（勾选「覆盖同名标签」）才加 `-f`。它的提交字段预填右键选中的提交、可编辑，并像分支弹窗一样实时解析。
- **分支** → `POST /git-suite/branch`：`git check-ref-format --branch` 校验后执行 `git branch <name> <起点>`。弹窗的「起点」预填右键选中的提交且可编辑；改成别的引用时会通过 `mode=resolve` 实时解析，并在输入框下方显示该提交的短哈希与标题；清空则回退到该提交。
- **检出** → `POST /git-suite/checkout`：`branch` 走 `git switch <branch>`，`hash` 走 `git switch --detach <hash>`；不 force；工作区有会被覆盖的改动时返回 409 `worktree-dirty`。客户端在检出前显示确认弹窗，分离 HEAD 会明确警告，分支也会提示工作区改动风险。
- 标签/分支/检出成功后刷新日志和引用树；检出后选择回到 HEAD。
- 提交行里的分支/标签 **chip** 右键打开与引用树相同的菜单（本地分支菜单、远端分支菜单，或标签的 检出/编辑/推送/用远端覆盖/删除）；无法归类的装饰仍落到提交菜单。
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
