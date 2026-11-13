# dsh-git-suite

DSH Web 的 Git 套件插件：提供提交历史、分支、引用树、提交详情、文件状态/暂存/提交与分支切换，支持提交后可选的修改/推送，后续继续扩展更多 Git 操作。
A Git suite plugin for DSH Web: history, branches, the refs tree, commit details, working-tree staging and commits, and branch switching — with amend/push options and more Git operations planned.

## 截图 / Screenshots

**提交历史 / History**

![提交历史 / History](assets/readme-screenshot-0.png)

**提交与文件状态 / Commit and file status**

![提交与文件状态 / Commit and file status](assets/readme-screenshot-1.png)

## 功能 / Features

- 自动扫描已注册工作区中的 Git 仓库，包括工作区子目录中的嵌套仓库
- 记录并恢复最近打开的仓库
- 分支选择：当前分支、本地分支和远端分支列表
- 提交路线图：显示分叉、汇合和合并提交，支持分支和 Tag 装饰
- 分页加载：每页 25 / 50 / 100 / 200 条，或加载完整历史；滚动到接近底部时自动加载下一页
- 操作栏（第二行）：最左侧是「历史 / 提交」切换，接着是拉取 / 推送 / 获取；提交在「提交」视图的提交表单里完成；拉取会先选择远端和分支（默认跟随当前分支的上游）；推送弹出分支列表，可勾选要推送的本地分支、设置各自的远程分支与跟踪、推送所有标签、强制推送；获取可勾选从全部远端获取、删除已不存在的跟踪分支（prune）、获取所有标签、覆盖本地标签（--force）
- 设置弹窗：点击顶栏的齿轮按钮，设置每页提交数（25 / 50 / 100 / 200 / 全部）
- 提交历史工具栏：下拉选择分支（所有分支 / 当前分支 / 本地分支；可选显示远端）、「显示远端」勾选框，以及「按日期排序 / 按层级排序」；表头不再显示提交数和当前分支
- 控件统一：按钮封装为 `Button` 组件，弹窗底部由 `DialogActions` 统一「取消 → 确认」；输入框/按钮 28px 高、12px 字号
- 文件状态与提交：第二行的「历史 / 提交」切换同一页内的提交历史与提交/文件状态，含已暂存/未暂存文件、全部或所选暂存/取消暂存、逐文件 diff、提交信息、修改最后一次提交、提交后推送到上游（文件级暂存；暂不支持区块级暂存）
- 仓库操作：仓库/路径旁的 **+** 菜单（点击或悬停）可克隆远端仓库（https / ssh / git / file / 本地路径；目标目录必须不存在，克隆对话框的「克隆到」可用「选择」系统目录并自动追加仓库名）或选择本地仓库（系统目录选择器）；两个弹窗都可勾选「加入到 DSH 工作区」（默认不勾选；勾选后会把目录注册为 DSH 工作区，DSH 可能会重新加载）
- AI 生成提交信息：提交按钮左侧的 AI 图标按钮（悬停显示「AI 生成」提示）使用 DSH 配置的默认模型总结已暂存改动（没有暂存时使用未暂存改动），自动填入提交信息，填写后仍可手动编辑
- 提交右键菜单：**标签**（创建/移动标签，可覆盖同名标签）、**分支**（在提交处新建分支）、**检出**（检出本地分支或分离 HEAD；检出前会警告确认，工作区有会被覆盖的改动时 Git 拒绝）
- 提交列表为单行表格（路线图、引用、标题、日期、作者、哈希），提交详情在列表下方分左右两栏：左侧作者/时间/父提交与改动文件，右侧补丁；点击改动文件切换右侧补丁，加载后默认选中最新提交和第一个文件
- 提交列表表头固定在顶部，可拖拽调整图谱、日期、作者、提交列宽；没有额外 maxWidth 上限，列可以一直拖到描述列保留 120px 最小宽度，列宽超过面板时表格横向滚动；图谱列宽固定为手动值，不随分支数自动变宽，宽度不足时超出部分直接隐藏、不缩放，列宽会记住
- 提交列表虚拟滚动：长历史只渲染可视区域和少量 overscan，滚动和加载更多时复用行 DOM，不再一次渲染全部提交
- 提交详情：作者、时间、提交哈希、父提交、本地/远端分支、提交信息、改动文件、补丁
- 左侧引用树：分支按 `/` 分组，含标签、远端、贮藏与子模块；没有标签/贮藏/子模块时不显示对应分组；子模块显示在最下方（有子模块时），点击可打开子模块仓库，仓库选择会显示 `[submodule]名称` 并提供「← 父仓库」按钮返回；右键远端可「获取 / 拉取 / 推送 / 删除」，右键本地分支可「检出 / 合并到当前分支 / 变基 / 获取 / 拉取 / 推送到上游 / 重命名 / 删除」；搜索框固定在顶部，不随列表滚动；当前检出分支加粗并带圈标记
- 区域可调：引用树宽度、日志/详情高度、详情左右两栏宽度，以及详情左栏内提交头/改动文件的上下分配，都可拖拽分割线调整；改动文件内部滚动
- 双击本地分支可切换工作区分支（不 force，工作区有冲突改动时拒绝）
- 中英文界面，跟随 DSH 主题
- 可从右侧「开始」页作为右侧栏标签页打开，窄栏自动切换单列布局

- Scans registered workspaces for Git repositories, including nested repositories
- Remembers recently opened repositories
- Branch selection for the current branch, and individual local or remote branches
- Commit graph with merges, forks, joins, branch decorations, and tags
- Paged loading (25 / 50 / 100 / 200 per page) or the complete history; the next page loads automatically near the bottom
- Action row (second line): the history / commit switch on the far left, then pull / push / fetch; commits happen in the commit form of the commit view; pull first asks for a remote and branch (defaulting to the current branch's upstream); push opens a branch list where you tick local branches, set each remote branch and tracking, push all tags, or force push; fetch offers fetch-all, prune tracking branches, fetch all tags, and force local tags
- Settings dialog (gear button) for the number of commits per page (25 / 50 / 100 / 200 / all)
- History toolbar: branch dropdown (all / current / local branches, with an optional remote display), a **Show remotes** checkbox, and **Sort by date / Sort topologically**; the table header no longer shows the commit count or current branch
- Unified controls: buttons use a `Button` component and dialogs use `DialogActions` for the cancel → confirm order; inputs and buttons are 28px tall with 12px text- Working tree and commits: switch between history and the commit/file-status view with **History / Commit** in the second row; staged/unstaged files, stage/unstage all or selected, per-file diffs, commit messages, amend, and push after committing (file-level staging; hunk-level staging is not available yet)
- Repositories: the **+** menu beside the repository/path controls (click or hover) clones a remote repository (https / ssh / git / file / local path; the destination must not exist, and the clone dialog's destination field can pick a parent folder with the OS chooser and append the repository name) or selects a local repository with the OS directory chooser; both dialogs have an **Add to DSH workspace** checkbox (off by default; checking it registers the directory as a DSH workspace, which may reload DSH)
- AI commit messages: the sparkle icon button left of Submit (with an **AI 生成** tooltip) summarizes the staged changes (or unstaged changes when nothing is staged) with DSH's configured default model and fills the message, which remains editable
- Commit context menu: **Tag** (create or move a tag, optionally forcing an existing one), **Branch** (create a local branch at the commit), and **Checkout** (a local branch or a detached HEAD, with a confirmation warning; Git refuses when the working tree has changes it would overwrite)
- Single-line log rows (graph, refs, subject, date, author, hash) with the commit detail below the list: metadata and changed files on the left, patch on the right; click a changed file to show its patch, with the newest commit and first file selected after loading
- Sticky commit-list header with drag-resizable graph, date, author, and commit columns; there is no extra max-width cap, so a column can grow until the description reaches its 120px minimum, and the table scrolls horizontally when the columns exceed the panel; the graph stays at the chosen width instead of growing with the lane count, overflow is clipped rather than scaled, and all widths are remembered locally
- Virtualized commit list: only the visible rows plus a small overscan are rendered, and row DOM is reused while scrolling and paging
- Commit details with author, date, commit hash, parents, local/remote branches, commit message, changed files, and patch
- Left refs tree with branches grouped by `/`, plus tags, remotes, stashes, and submodules; the tags/stashes/submodules groups are hidden when empty; submodules appear at the bottom when present and open their repository on click, showing `[submodule]name` in the repository selector with a **← Parent** button back to the superproject; right-clicking a remote offers fetch / pull / push / remove and right-clicking a local branch offers checkout / merge / rebase / fetch / pull / push-to-upstream / rename / delete; the search box stays fixed while the tree scrolls; the checked-out branch is bold with a ring marker
- Resizable panes: drag the dividers to resize the refs tree, the log/detail split, the detail's two columns, and the summary/changed-files blocks inside the detail's left column; the files scroll on their own
- Double-click a local branch to switch the working tree (never forced; conflicting changes are rejected)
- English and Chinese UI, theme-aware styling
- Opens as a right-sidebar tab from the right sidebar's Start page, with a single-column layout in the narrow column

## 环境 / Requirements

- DSH Web
- Git available on `PATH`
- 从源码构建时需要 Node.js 20+ 与 pnpm / Node.js 20+ and pnpm when building from source

## 安装 / Installation

Clone the repository, build it once, then install the directory as a local bundle through DSH Plugin Manager.

```sh
git clone https://github.com/gimhol/dsh-git-suite.git
cd dsh-git-suite
pnpm install
pnpm build
```

也可以从 Gitee 镜像克隆 / A Gitee mirror is also available:

```sh
git clone https://gitee.com/gimholg/dsh-git-suite.git
cd dsh-git-suite
```

DSH 只加载构建产物（`dist/`），不会编译 TypeScript；插件管理器安装本地目录时也不会替你构建。`dist/` 是构建产物，已被 Git 忽略：克隆后请先执行上面的 `pnpm install && pnpm build`，再安装该目录。修改源码后重新执行 `pnpm build`。

DSH loads built artifacts from `dist/` and never compiles TypeScript; installing a local directory through Plugin Manager does not build it either. `dist/` is a build artifact and is ignored by Git: after cloning, run `pnpm install && pnpm build` above before installing the directory. Rerun `pnpm build` after editing sources.

修改 `package.json` 中的入口后，需要重启 DSH（或在插件页禁用再启用该插件），让新的入口路径生效。

After changing entry paths in `package.json`, restart DSH (or disable and re-enable the plugin row) so the new entry paths are read.

## 构建 / Build

```sh
pnpm build         # 类型检查 + 宿主端 tsc + 客户端 esbuild
pnpm typecheck     # 仅类型检查
pnpm watch:client  # 监听客户端源码，DSH HMR 会重新加载产物
pnpm watch:host    # 监听宿主端源码
```

构建管线（`tsc` / `esbuild` / Sass 的分工）见 [docs/STRUCTURE.md](docs/STRUCTURE.md)。

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for how `tsc`, esbuild, and Sass fit together.

## 使用 / Usage

Open the **Git** icon in the sidebar. Pick a scanned repository, or enter any local Git repository path. Choose a branch and load commits; scrolling near the bottom loads the next page automatically. Set the page size from the **Settings** gear in the header.

左侧引用树可以在分支、标签、远端、贮藏和子模块之间切换；搜索框可过滤引用。没有标签、贮藏或子模块时对应分组隐藏；子模块位于最下方，点击打开子模块仓库，仓库选择显示 `[submodule]名称`，并出现「← 父仓库」按钮可返回父仓库。

The left refs tree switches between branches, tags, remotes, stashes, and submodules; the search box filters refs. Groups with no tags, stashes, or submodules are hidden; submodules sit at the bottom and open their repository on click, with the repository selector showing `[submodule]name` and a **← Parent** button to return to the superproject.

双击引用树中的本地分支可将工作区切换到该分支；工作区有会被覆盖的改动时操作会被拒绝。

Double-click a local branch in the tree to switch the working tree to it; a switch that would overwrite local changes is rejected.

点击第二行的 **提交** 切换到提交/文件状态，点 **历史** 返回提交历史：勾选文件后暂存所选或暂存所有，已暂存文件可取消暂存；点击文件在右侧查看 diff；填写提交信息后点 **提交**，可勾选「修改最后一次提交」或「立即推送变更到上游」。

Click **Commit** in the second row to switch to the commit/file-status view, and **History** to return: check files to stage selected or stage all, unstage staged files, view a file's diff on the right, write a commit message, and commit; amend last commit and push to the upstream are optional.

点击仓库/路径旁的 **+**，选择「克隆远端仓库」填写远端地址和本地目录（目录必须不存在，也可点「选择」用系统目录选择器选父目录并自动追加仓库名）；勾选「加入到 DSH 工作区」时克隆完成后会同时注册工作区并打开，DSH 可能会重新加载。选择「选择本地仓库」会打开弹窗，可点「选择目录」用系统选择器选 Git 仓库，也可从已扫描仓库选择或直接输入路径；默认只在当前面板打开仓库，勾选「加入到 DSH 工作区」后点「打开」才会同时注册工作区（DSH 可能会重新加载）；已存在工作区时勾选框禁用并提示。

提交按钮左侧的 AI 图标（悬停提示「AI 生成」）会用默认模型根据改动自动填写提交信息；没有配置默认模型、或工作区没有改动时按钮会报错提示。

在提交列表右键任意提交，可打开「标签 / 分支 / 检出」菜单：标签弹窗填写标签名和可选说明（勾选覆盖同名标签）；分支弹窗填写新分支名；检出弹窗选择本地分支或分离 HEAD，分离 HEAD 会明确警告，确认后才执行。

Click **+** beside the repository/path controls, choose **Clone remote repository** and enter the remote URL and a local destination (which must not exist; **Choose** opens the OS folder chooser for a parent folder and appends the repository name); with **Add to DSH workspace** checked, the clone also registers the workspace and opens it (DSH may reload). **Select local repository** opens a dialog where **Choose folder** uses the OS picker (or pick a scanned repository / enter a path); by default it only opens the repository in this panel — checking **Add to DSH workspace** and pressing **Open** registers the workspace too (DSH may reload), and the checkbox is disabled when it already is one.

The sparkle icon button left of Submit (with a tooltip) fills the message from the changes with the default model; it reports an error when no default model is configured or the working tree has no changes.

Right-click any commit in the log for **Tag / Branch / Checkout**: the tag dialog takes a name and optional message (with a force checkbox); the branch dialog takes a new branch name; the checkout dialog picks a local branch or a detached HEAD, with an explicit warning before confirming.

也可以在右侧栏的「开始」页选择 **Git**，将它作为右侧标签页打开。每页条数在顶栏的 **设置**（齿轮）弹窗中调整。

You can also pick **Git** on the right sidebar's Start page to open the suite as a right-sidebar tab. Set the page size from the **Settings** gear in the header.

## 文档 / Docs

- [docs/STRUCTURE.md](docs/STRUCTURE.md) — 目录布局、模块职责、构建管线 / Directory layout, module responsibilities, and build pipeline

## 安全 / Security

读取路由（日志、详情、文件状态、diff）只执行 `git log` / `git show` / `git status` / `git diff`；其余 POST 路由（切换分支、暂存、取消暂存、提交、拉取/推送/获取、删除远端、分支合并/变基/重命名/删除、克隆、AI 生成、选择目录、新建工作区、标签、分支、检出）都要求同源并携带插件的私有请求头。切换分支只接受本地分支、不 force；暂存使用 `git add`，取消暂存使用 `git reset`；提交使用 `git commit`，可 `--amend`；拉取/推送可指定远端与分支；推送的强制模式只在明确勾选「强制推送」时使用；提交后的推送仍只推送到已配置的上游。克隆只接受 https / ssh / git / file / 绝对本地路径（拒绝 `ext::` / `fd::` 等执行本地命令的传输），目标必须是绝对路径、父目录存在且目标不存在；克隆目标可用系统目录选择器选择父目录。AI 生成只执行 `git diff` / `git status` 读取改动，将文件列表与 diff 发送给 DSH 配置的默认模型提供方，不写入仓库。选择本地仓库通过 DSH 的原生目录选择器（`ctx.directoryPicker`）打开系统对话框；克隆或选择弹窗勾选「加入到 DSH 工作区」后，才会调用 `ctx.workspaceRegistry.create` 注册该目录为 DSH 工作区。标签/分支名都经 `git check-ref-format` 校验；标签只有勾选「覆盖同名标签」时才加 `-f`；分支合并/变基在当前工作区执行，冲突时返回 Git 错误；重命名使用 `git branch -m`，删除使用 `git branch -d`；删除远端使用 `git remote remove`；检出支持本地分支或提交哈希 `git switch --detach`，不 force，工作区有会被覆盖的改动时返回 409。

Read routes (log, commit detail, working-tree status, diff) only run `git log` / `git show` / `git status` / `git diff`; all other POST routes (branch switch, stage, unstage, commit, pull/push/fetch, remote removal, branch merge/rebase/rename/delete, clone, AI generation, directory picking, workspace creation, tag, branch, checkout) require the same-origin check and the plugin's private request header. A switch accepts local branches only and is never forced; staging uses `git add`, unstaging uses `git reset`, committing uses `git commit` (optionally `--amend`), pull/push take an explicit remote and branch, and push's force mode is used only when **Force push** is checked; the push after committing still targets the configured upstream only. Cloning accepts https / ssh / git / file / absolute local paths only (rejecting `ext::` / `fd::` and other transports that execute local commands); the destination must be absolute, its parent must exist, and it must not already exist; the clone destination can pick its parent with the OS chooser. AI generation only reads `git diff` / `git status` and sends the file list and diff to DSH's configured default model provider; it never writes to the repository. Selecting a local repository opens the OS chooser through DSH's native directory picker (`ctx.directoryPicker`); only when **Add to DSH workspace** is checked in the clone or select dialog does the plugin call `ctx.workspaceRegistry.create` to register the directory as a DSH workspace. Tag and branch names pass `git check-ref-format`; tags add `-f` only when **Force an existing tag** is checked; merge/rebase run in the current working tree and return Git errors on conflicts; rename uses `git branch -m` and delete uses `git branch -d`; removing a remote uses `git remote remove`; checkout switches to a local branch or detaches HEAD at a commit, never forces, and returns 409 when the working tree has changes it would overwrite.

## 许可证 / License

MIT © 2026 Gim. 详见 [LICENSE](LICENSE) / See [LICENSE](LICENSE).
