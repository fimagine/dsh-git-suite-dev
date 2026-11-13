import { GitLogIcon } from './components/GitLogIcon.js'
import type { ClientContext, ClientPlugin } from './dsh.js'
import { GitLogPanel } from './GitLogPanel.js'
import { en } from './locales/en.js'
import { zh } from './locales/zh.js'
import { SidebarGitLogPanel } from './SidebarPanel.js'

const NS = 'gitLog'

/** ID of the right-sidebar tab type; also the key its body registers under. */
const TAB_ID = '@local/dsh-git-log-viewer'

/** Kind the right sidebar opens for this page. */
const TAB_KIND = 'git-log'

/** After the shipped files (10), terminal (20), and browser (30) entries. */
const GUIDE_ORDER = 40

/** The client plugin face DSH mounts: dictionaries, slots, and the right-sidebar tab. */
export function createPlugin(): ClientPlugin {
  return {
    inject: ['slots', 'locale'],
    apply(ctx: ClientContext): void {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-log-viewer: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'git-log',
          locale: NS,
        }, GitLogPanel)),
        'git-log-viewer: main panel',
      )

      ctx.effect(
        () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'git-log',
          order: 15,
          label: () => t('panel'),
          locale: NS,
        }, GitLogIcon)),
        'git-log-viewer: sidebar entry',
      )

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
            id: 'git-log',
            order: GUIDE_ORDER,
            title: () => t('panel'),
            description: () => t('subtitle'),
            icon: GitLogIcon,
          }],
        }), 'git-log-viewer: right sidebar tab')

        scope.effect(
          () => scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: NS,
          }, SidebarGitLogPanel)),
          'git-log-viewer: right sidebar panel',
        )
      })
    },
  }
}
