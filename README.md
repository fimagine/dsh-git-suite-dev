# dsh-git-suite

English | [中文](README.zh.md)

A Git suite plugin for DSH Web: history, branches, the refs tree, commit details, working-tree staging and commits, and branch switching — with amend/push options and more Git operations planned.

## Screenshots

**History**

![History](assets/readme-screenshot-0.png)

**Commit and file status**

![Commit and file status](assets/readme-screenshot-1.png)

## Features

- Scans registered workspaces for Git repositories, including nested repositories
- Remembers recently opened repositories
- Branch selection for the current branch, and individual local or remote branches
- Commit graph with merges, forks, joins, branch decorations, and tags
- Paged loading (25 / 50 / 100 / 200 per page) or the complete history; the next page loads automatically near the bottom
- Action row (second line): the history / commit switch on the far left, then pull / push / fetch; commits happen in the commit form of the commit view; pull first asks for a remote and branch (defaulting to the current branch's upstream); push opens a branch list where you tick local branches, set each remote branch and tracking, push all tags, or force push; fetch offers fetch-all, prune tracking branches, fetch all tags, and force local tags
- Settings dialog (gear button) for the number of commits per page (25 / 50 / 100 / 200 / all)
- History toolbar: branch dropdown (all / current / local branches, with an optional remote display), a **Show remotes** checkbox, and **Sort by date / Sort topologically**; the table header no longer shows the commit count or current branch
- Unified controls: buttons use a `Button` component and dialogs use `DialogActions` for the cancel → confirm order; inputs and buttons are 28px tall with 12px text
- Working tree and commits: switch between history and the commit/file-status view with **History / Commit** in the second row; staged/unstaged files, stage/unstage all or selected, per-file diffs, commit messages, amend, and push after committing (file-level staging; hunk-level staging is not available yet)
- Repositories: the **+** menu beside the repository/path controls (click or hover) clones a remote repository (https / ssh / git / file / local path; the destination must not exist, and the clone dialog's destination field can pick a parent folder with the OS chooser and append the repository name) or selects a local repository with the OS directory chooser; both dialogs only open the repository in this panel; use DSH's own Workspaces add flow to register a DSH workspace; the repository dropdown supports name search
- Persistence: leaving/returning or reloading keeps the last repository, history/commit view, sort, show-remotes, page size, tree/commit splitter widths, detail ratio, and tree expansion
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

## Requirements

- DSH Web
- Git available on `PATH`
- Node.js 20+ and pnpm when building from source

## Installation

### From npm (no build)

Install the published **`dsh-git-suite`** bundle through DSH Plugin Manager (or `plugin_manager` `install_bundle` with the package name). The npm package ships the prebuilt `dist/`, so no Node.js, pnpm, or source build is needed.

### From a prebuilt archive

Download the `pnpm pack` / GitHub release tarball (it contains `dist/`), extract it, and add the extracted directory in DSH Plugin Manager (**Plugins → Add plugin**). No build is needed either.

### From source (development)

Clone the repository, build it once, then install the directory as a local bundle through DSH Plugin Manager.

```sh
git clone https://github.com/gimhol/dsh-git-suite.git
cd dsh-git-suite
pnpm install
pnpm build
```

A Gitee mirror is also available:

```sh
git clone https://gitee.com/gimholg/dsh-git-suite.git
cd dsh-git-suite
```

DSH loads built artifacts from `dist/` and never compiles TypeScript; installing a local directory through Plugin Manager does not build it either. `dist/` is a build artifact and is ignored by Git: after cloning, run `pnpm install && pnpm build` above before installing the directory. Rerun `pnpm build` after editing sources.

After changing entry paths in `package.json`, restart DSH (or disable and re-enable the plugin row) so the new entry paths are read.

## Build

```sh
pnpm build         # typecheck + host tsc + client esbuild
pnpm typecheck     # typecheck only
pnpm watch:client  # watch client sources; DSH HMR reloads the bundle
pnpm watch:host    # watch host sources
```

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for how `tsc`, esbuild, and Sass fit together.

## Usage

Open the **Git** icon in the sidebar. Pick a scanned repository, or enter any local Git repository path. Choose a branch and load commits; scrolling near the bottom loads the next page automatically. Set the page size from the **Settings** gear in the header.

The left refs tree switches between branches, tags, remotes, stashes, and submodules; the search box filters refs. Groups with no tags, stashes, or submodules are hidden; submodules sit at the bottom and open their repository on click, with the repository selector showing `[submodule]name` and a **← Parent** button to return to the superproject.

Double-click a local branch in the tree to switch the working tree to it; a switch that would overwrite local changes is rejected.

Click **Commit** in the second row to switch to the commit/file-status view, and **History** to return: check files to stage selected or stage all, unstage staged files, view a file's diff on the right, write a commit message, and commit; amend last commit and push to the upstream are optional.

Click **+** beside the repository/path controls, choose **Clone remote repository** and enter the remote URL and a local destination (which must not exist; **Choose** opens the OS folder chooser for a parent folder and appends the repository name); after cloning, the repository opens in this panel. **Select local repository** opens a dialog where **Choose folder** uses the OS picker (or pick a scanned repository / enter a path); **Open** only opens the repository in this panel. Use DSH's own Workspaces add flow to register a DSH workspace.

The sparkle icon button left of Submit (with a tooltip) fills the message from the changes with the default model; it reports an error when no default model is configured or the working tree has no changes.

Right-click any commit in the log for **Tag / Branch / Checkout**: the tag dialog takes a name and optional message (with a force checkbox); the branch dialog takes a new branch name; the checkout dialog picks a local branch or a detached HEAD, with an explicit warning before confirming.

You can also pick **Git** on the right sidebar's Start page to open the suite as a right-sidebar tab. Set the page size from the **Settings** gear in the header.

## Docs

- [docs/STRUCTURE.md](docs/STRUCTURE.md) — directory layout, module responsibilities, and build pipeline

## Security

Read routes (log, commit detail, working-tree status, diff) only run `git log` / `git show` / `git status` / `git diff`; all other POST routes (branch switch, stage, unstage, commit, pull/push/fetch, remote removal, branch merge/rebase/rename/delete, clone, AI generation, directory picking, tag, branch, checkout) require the same-origin check and the plugin's private request header. A switch accepts local branches only and is never forced; staging uses `git add`, unstaging uses `git reset`, committing uses `git commit` (optionally `--amend`), pull/push take an explicit remote and branch, and push's force mode is used only when **Force push** is checked; the push after committing still targets the configured upstream only. Cloning accepts https / ssh / git / file / absolute local paths only (rejecting `ext::` / `fd::` and other transports that execute local commands); the destination must be absolute, its parent must exist, and it must not already exist; the clone destination can pick its parent with the OS chooser. AI generation only reads `git diff` / `git status` and sends the file list and diff to DSH's configured default model provider; it never writes to the repository. Selecting a local repository opens the OS chooser through DSH's native directory picker (`ctx.directoryPicker`) and only returns the result to the plugin; it does not register a DSH workspace. Tag and branch names pass `git check-ref-format`; tags add `-f` only when **Force an existing tag** is checked; merge/rebase run in the current working tree and return Git errors on conflicts; rename uses `git branch -m` and delete uses `git branch -d`; removing a remote uses `git remote remove`; checkout switches to a local branch or detaches HEAD at a commit, never forces, and returns 409 when the working tree has changes it would overwrite.

## License

MIT © 2026 Gim. See [LICENSE](LICENSE).
