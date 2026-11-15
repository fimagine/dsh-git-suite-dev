import type * as React from 'react'
import { h, useMemo } from '../runtime.js'
import { highlightLines, languageForAlias } from '../lib/highlight.js'

export interface MarkdownProps {
  text: string
  className?: string
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'rule' }

const SAFE_LINK = /^https?:\/\//i
const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/

function inline(text: string, prefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /`([^`]+)`|(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|(?<![\w])__([^_]+)__(?![\w])|\*([^*]+)\*|(?<![\w])_([^_]+)_(?![\w])|~~([^~]+)~~/g
  let last = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const key = `${prefix}-${index++}`
    if (match[1] !== undefined) {
      nodes.push(<code key={key}>{match[1]}</code>)
    } else if (match[3] !== undefined) {
      const label = match[3]
      const url = match[4] ?? ''
      if (match[2] === '!') {
        nodes.push(...inline(label, key))
      } else if (SAFE_LINK.test(url)) {
        nodes.push(
          <a key={key} href={url} target="_blank" rel="noreferrer noopener">
            {inline(label, key)}
          </a>,
        )
      } else {
        nodes.push(...inline(label, key))
      }
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(<strong key={key}>{inline(match[5] ?? match[6] ?? '', key)}</strong>)
    } else if (match[7] !== undefined || match[8] !== undefined) {
      nodes.push(<em key={key}>{inline(match[7] ?? match[8] ?? '', key)}</em>)
    } else if (match[9] !== undefined) {
      nodes.push(<del key={key}>{inline(match[9], key)}</del>)
    }
    last = pattern.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? ''
  if (/^\s*$/.test(line)) return true
  if (/^(?:```|~~~)/.test(line)) return true
  if (/^#{1,6}\s+/.test(line)) return true
  if (/^>\s?/.test(line)) return true
  if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)) return true
  if (RULE.test(line)) return true
  if (line.includes('|') && TABLE_DIVIDER.test(lines[index + 1] ?? '')) return true
  return false
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = /^(```|~~~)\s*([\w#+.-]*)\s*$/.exec(line)
    if (fence !== null) {
      const marker = fence[1] ?? '```'
      const language = fence[2] ?? ''
      index += 1
      const code: string[] = []
      while (index < lines.length && !(lines[index] ?? '').startsWith(marker)) {
        code.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ kind: 'code', language, code: code.join('\n') })
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      blocks.push({ kind: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' })
      index += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'quote', text: quote.join('\n') })
      continue
    }

    if (line.includes('|') && TABLE_DIVIDER.test(lines[index + 1] ?? '')) {
      const header = splitRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length) {
        const row = lines[index] ?? ''
        if (row.trim() === '' || !row.includes('|')) break
        rows.push(splitRow(row))
        index += 1
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    const listItem = LIST_ITEM.exec(line)
    if (listItem !== null) {
      const ordered = listItem[2] !== undefined
      const items: string[] = []
      while (index < lines.length) {
        const next = LIST_ITEM.exec(lines[index] ?? '')
        if (next === null) break
        items.push(next[3] ?? '')
        index += 1
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') })
  }
  return blocks
}

function CodeBlock({ block }: { block: Extract<Block, { kind: 'code' }> }): React.ReactElement {
  const language = block.language === '' ? null : languageForAlias(block.language)
  const highlighted = useMemo(
    () => language === null ? null : highlightLines(block.code.split('\n'), language),
    [block.code, language],
  )
  return (
    <pre className="dsh-gitlog-md-code">
      <code>
        {highlighted === null
          ? block.code
          : highlighted.map((line, lineIndex) => (
              <span key={lineIndex} className="dsh-gitlog-md-code-line">
                {line.map((token, tokenIndex) => token.type === null
                  ? token.text
                  : <span key={tokenIndex} className={`dsh-gitlog-tok-${token.type}`}>{token.text}</span>)}
                {lineIndex < highlighted.length - 1 ? '\n' : ''}
              </span>
            ))}
      </code>
    </pre>
  )
}

function renderBlock(block: Block, key: string): React.ReactNode {
  if (block.kind === 'heading') {
    return (
      <h3 key={key} className={`dsh-gitlog-md-heading md-level-${block.level}`}>
        {inline(block.text, key)}
      </h3>
    )
  }
  if (block.kind === 'paragraph') return <p key={key}>{inline(block.text, key)}</p>
  if (block.kind === 'code') return <CodeBlock key={key} block={block} />
  if (block.kind === 'list') {
    const children = block.items.map((item, index) => <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>)
    return block.ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>
  }
  if (block.kind === 'quote') return <blockquote key={key}>{inline(block.text, key)}</blockquote>
  if (block.kind === 'rule') return <hr key={key} />
  return (
    <table key={key}>
      <thead>
        <tr>
          {block.header.map((cell, index) => <th key={`${key}-h-${index}`}>{inline(cell, `${key}-h-${index}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={`${key}-r-${rowIndex}`}>
            {row.map((cell, cellIndex) => (
              <td key={`${key}-r-${rowIndex}-${cellIndex}`}>{inline(cell, `${key}-r-${rowIndex}-${cellIndex}`)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Safe Markdown for discussion comments and AI reviews; no raw HTML is rendered. */
export function Markdown({ text, className }: MarkdownProps): React.ReactElement {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <div className={`dsh-gitlog-markdown${className === undefined ? '' : ` ${className}`}`}>
      {blocks.map((block, index) => renderBlock(block, `md-${index}`))}
    </div>
  )
}
