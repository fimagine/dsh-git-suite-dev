/** esbuild's `--loader:.css=text` turns a stylesheet import into its source text. */
declare module '*.css' {
  const css: string
  export default css
}
