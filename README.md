# dsh-git-suite

English | [中文](README.zh.md)

A Git suite plugin for DSH Web: history, branches, the refs tree, commit details, working-tree staging and commits, and branch switching — with amend/push options and more Git operations planned.

## Screenshots

**History**

![History](assets/readme-screenshot-0.png)

**Commit details and diff**

![Commit details and diff](assets/readme-screenshot-2.png)

**Commit and file status**

![Commit and file status](assets/readme-screenshot-1.png)

**Hunk staging and a side-by-side diff**

![Hunk staging and a side-by-side diff](assets/readme-screenshot-3.png)

## Usage

- **Where to find it**: the left sidebar's **Git** entry, the right panel's **Git** card on its Start page, or **Ctrl/Cmd+Shift+G** from anywhere (rebindable in DSH's keyboard settings). Both places render the same panel.
- **Pick a repository**: use the project dropdown (type to search) or the **+** menu beside it to **clone a remote** or **select a local** repository. The right panel opens on the repository of the current session by default.
- **Two views**: the **History / Commit** switch in the second row. History shows the commit graph and details; Commit shows the working tree.
- **Commit**: stage whole files with the row buttons, single hunks with **Stage this hunk**, or a dragged line selection via the right-click menu, then write a message (↑ walks this repository's recent messages) and press **Commit**. **Amend last commit** and **push after committing** are optional.
- **Diffs**: every diff has a layout toggle between unified rows and side-by-side columns.
- **Everything else**: right-click branches, tags, stashes, remotes, commits, and files for their menus (checkout, merge, rebase, cherry-pick, reset, stash, tag, …); the top-right buttons open a terminal, the file manager, or VS Code at the repository.

## Features

- **History**: paged loading, commit graph, commit details, and per-file patches in a unified or side-by-side diff viewer; sticky header, resizable columns, and virtualized rows.
- **Refs tree**: branches, tags, remotes, stashes, and submodules with search; double-click a local branch to switch; open submodules and return to the parent.
- **Working tree and commits**: stage/unstage whole files, single hunks, or a dragged line selection, review diffs, commit or amend, push after committing, and generate commit messages with AI.
- **Remote actions**: the history/commit switch, pull/push/fetch with remote, branch, prune, tag, and force options, merge/rebase, rebase onto any ref, and a commit context menu for tag/branch/checkout/cherry-pick/revert/reset.
- **Right panel**: the same panel in DSH's right sidebar (Ctrl/Cmd+Shift+G), opening on the repository of the current session and keeping its own view, filters, splitters, and draft per repository.
- **Repositories**: the **+** menu clones a remote or selects a local repository; the repository dropdown supports name search.

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


## Docs

- [docs/STRUCTURE.md](docs/STRUCTURE.md) — directory layout, module responsibilities, and build pipeline


## License

MIT © 2026 Gim. See [LICENSE](LICENSE).



