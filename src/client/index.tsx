import { createPlugin } from './plugin.js'
import { bindReact } from './runtime.js'
import { moduleLoader } from './dsh.js'

const MODULE_ID = '@local/dsh-git-log-viewer'

/**
 * DSH loads this bundle lazily: running it registers a factory, and the module
 * system materializes it (with the `require` table) the first time the plugin
 * is used. React comes from that table, never from the bundle.
 */
moduleLoader().load({
  id: MODULE_ID,
  factory(require) {
    bindReact(require('react'))
    return createPlugin()
  },
})
