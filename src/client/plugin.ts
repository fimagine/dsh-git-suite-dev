import { GitLogIcon } from './components/GitLogIcon.js'
import type { ClientContext, ClientPlugin } from './dsh.js'
import { GitLogPanel } from './GitLogPanel.js'
import { en } from './locales/en.js'
import { zh } from './locales/zh.js'
import { SidebarGitLogPanel } from './SidebarPanel.js'


const NS = 'gitSuite'

/** ID of the right-sidebar tab type; also the key its body registers under. */
const TAB_ID = 'dsh-git-suite'

/** Kind the right sidebar opens for this page. */
const TAB_KIND = 'git'

/** After the shipped files (10), terminal (20), and browser (30) entries. */
const GUIDE_ORDER = 40

/** Catalog command that opens the tab; the guide card shows its keycap. */
const OPEN_COMMAND = 'gitSuite.open'

/** The client plugin face DSH mounts: dictionaries, slots, and the right-sidebar tab. */
export function createPlugin(): ClientPlugin {
  return {
    inject: ['slots', 'locale'],
    apply(ctx: ClientContext): void {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-suite: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'git',
          locale: NS,
        }, GitLogPanel)),
        'git-suite: main panel',
      )

      ctx.effect(
        () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'git',
          order: 15,
          label: () => t('panel'),
          locale: NS,
        }, GitLogIcon)),
        'git-suite: sidebar entry',
      )

      // The open shortcut is a DSH catalog command: it can be rebound in the
      // product's keyboard settings and the Start page shows its keycap.
      ctx.inject(['sidebarRight', 'shortcuts'], (scope) => {
        const sidebar = scope.sidebarRight
        const shortcuts = scope.shortcuts
        if (sidebar === undefined || shortcuts === undefined) return
        scope.effect(() => shortcuts.register({
          id: OPEN_COMMAND,
          label: () => t('openCommand'),
          aliases: ['git suite', 'git panel', 'open git'],
          defaults: {
            'desktop:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
            'desktop:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
            'desktop:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
            'web:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
            'web:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
          },
          regions: ['page', 'editable'],
          modals: [],
          resolve: () => {
            try {
              sidebar.openTab(TAB_KIND)
            } catch {
              // No foreground Session yet: the sidebar cannot open.
            }
            return { status: 'handled', run: () => {} }
          },
        }), 'git-suite: open command')
      })

      // Optional: keep the main panel working when the right sidebar is absent.
      ctx.inject(['sidebarRightTabs'], (scope) => {
        const tabs = scope.sidebarRightTabs
        if (tabs === undefined) return

        scope.effect(() => tabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          title: () => t('panel'),
          guide: [{
            id: 'git',
            order: GUIDE_ORDER,
            title: () => t('panel'),
            description: () => t('guideDescription'),
            commandId: OPEN_COMMAND,
            icon: GitLogIcon,
          }],
        }), 'git-suite: right sidebar tab')

        scope.effect(
          () => scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: NS,
          }, SidebarGitLogPanel)),
          'git-suite: right sidebar panel',
        )
      })
    },
  }
}


