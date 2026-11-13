# dsh-git-log-viewer

DSH Web 的 Git 日志查看器插件 / A Git log viewer plugin for DSH Web.

## 功能 / Features

- 自动扫描已注册工作区中的 Git 项目，包括工作区子目录中的嵌套项目
- 记录并恢复最近打开的项目
- 分支选择：当前分支、所有分支（含远端）、所有远端分支、本地分支和远端分支列表
- 提交路线图：显示分叉、汇合和合并提交，支持分支和 Tag 装饰
- 分页加载：每页 25 / 50 / 100 / 200 条，或加载完整历史
- 提交详情：作者、时间、父提交、改动文件、补丁，支持复制完整哈希
- 中英文界面，跟随 DSH 主题
- 可从右侧「开始」页作为右侧栏标签页打开，窄栏自动切换单列布局

- Scans registered workspaces for Git projects, including nested projects
- Remembers recently opened projects
- Branch selection for the current branch, all branches (including remotes), all remote branches, and individual local or remote branches
- Commit graph with merges, forks, joins, branch decorations, and tags
- Paged loading (25 / 50 / 100 / 200 per page) or the complete history
- Commit details with author, date, parents, changed files, patch, and copy-hash
- English and Chinese UI, theme-aware styling
- Opens as a right-sidebar tab from the right sidebar's Start page, with a single-column layout in the narrow column

## 环境 / Requirements

- DSH Web
- Git available on `PATH`
- 从源码构建时需要 Node.js 20+ 与 pnpm / Node.js 20+ and pnpm when building from source

## 安装 / Installation

Clone the repository, build it once, then install the directory as a local bundle through DSH Plugin Manager.

```sh
git clone https://gitee.com/gimholg/dsh-git-log-viewer.git
cd dsh-git-log-viewer
pnpm install
pnpm build
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

Open the **Git log** icon in the sidebar. Pick a scanned project, or enter any local Git repository path. Choose a branch and load commits; use **Load next page** to paginate.

也可以在右侧栏的「开始」页选择 **Git 日志**，将它作为右侧标签页打开。

You can also pick **Git log** on the right sidebar's Start page to open the viewer as a right-sidebar tab.

## 文档 / Docs

- [docs/STRUCTURE.md](docs/STRUCTURE.md) — 目录布局、模块职责、构建管线 / Directory layout, module responsibilities, and build pipeline

## 安全 / Security

The host route is read-only and only runs `git log` / `git show`. Requests must be same-origin and carry the plugin's private request header.
