/**
 * The stylesheet is authored in `styles.scss`; the client build compiles it to
 * `styles.generated.css`, which esbuild inlines as text. Rendering that string
 * in the panel keeps the rules scoped to the panel's lifetime.
 */
import css from './styles.generated.css'

export const CSS = css
