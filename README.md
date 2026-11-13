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

- Scans registered workspaces for Git projects, including nested projects
- Remembers recently opened projects
- Branch selection for the current branch, all branches (including remotes), all remote branches, and individual local or remote branches
- Commit graph with merges, forks, joins, branch decorations, and tags
- Paged loading (25 / 50 / 100 / 200 per page) or the complete history
- Commit details with author, date, parents, changed files, patch, and copy-hash
- English and Chinese UI, theme-aware styling

## 环境 / Requirements

- DSH Web
- Git available on `PATH`

## 安装 / Installation

Clone the repository, then install the directory as a local bundle through DSH Plugin Manager.

```sh
git clone https://gitee.com/gimholg/dsh-git-log-viewer.git
```

## 使用 / Usage

Open the **Git log** icon in the sidebar. Pick a scanned project, or enter any local Git repository path. Choose a branch and load commits; use **Load next page** to paginate.

## 结构 / Structure

- `index.js` — Host-side read-only route for workspace scanning, branches, logs, and commits
- `client.js` — Client-side project switcher, branch selector, commit graph, and detail panel
- `cordis.patch.yml` — Bundle patch
- `locale/` — English and Chinese display metadata
- `icon.svg` — Plugin icon

## 安全 / Security

The host route is read-only and only runs `git log` / `git show`. Requests must be same-origin and carry the plugin's private request header.
