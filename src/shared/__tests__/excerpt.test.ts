import { describe, expect, it } from 'vitest'
import { EXCERPT_MAX_CHARS, excerptFromMarkdown } from '../excerpt'

describe('excerptFromMarkdown', () => {
  it('skips the frontmatter block', () => {
    const raw = ['---', 'title: Plan', 'tags: [a, b]', '---', '', 'The body starts here.'].join('\n')
    expect(excerptFromMarkdown(raw)).toBe('The body starts here.')
  })

  it('drops a leading heading, which the row already shows as the name', () => {
    expect(excerptFromMarkdown('# Weekly plan\n\nShip the thing.')).toBe('Ship the thing.')
  })

  it('keeps a heading that is not the first line', () => {
    expect(excerptFromMarkdown('Intro.\n\n## Details\n\nMore.')).toBe('Intro. Details More.')
  })

  it('strips list markers, task boxes, and quotes', () => {
    const raw = '- [ ] buy milk\n- [x] call back\n> a quote\n1. first'
    expect(excerptFromMarkdown(raw)).toBe('buy milk call back a quote first')
  })

  it('unwraps links and wikilinks, and drops images', () => {
    const raw = 'See [the docs](https://x.dev) and [[notes/plan|the plan]] ![shot](a.png) and [[raw]].'
    expect(excerptFromMarkdown(raw)).toBe('See the docs and the plan and raw.')
  })

  it('removes emphasis but leaves underscores inside words alone', () => {
    expect(excerptFromMarkdown('**bold** `code` ~~gone~~ snake_case')).toBe(
      'bold code gone snake_case',
    )
  })

  it('drops rules and table separators', () => {
    expect(excerptFromMarkdown('Intro.\n\n---\n\n| --- | --- |\n\nOutro.')).toBe('Intro. Outro.')
  })

  it('reads a table row as words, without its grid', () => {
    expect(excerptFromMarkdown('| Bahan | Jumlah |\n| --- | --- |\n| Kopi | 5 L |')).toBe(
      'Bahan Jumlah Kopi 5 L',
    )
  })

  it('leaves a pipe inside a sentence alone', () => {
    expect(excerptFromMarkdown('Run a | b to pipe it.')).toBe('Run a | b to pipe it.')
  })

  it('prefers prose over fenced code, wherever the code sits', () => {
    const raw = '```mermaid\nflowchart LR\n  A --> B\n```\n\nWhat the diagram means.'
    expect(excerptFromMarkdown(raw)).toBe('What the diagram means.')
  })

  it('falls back to the code when the note has no prose at all', () => {
    expect(excerptFromMarkdown('```ts\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('collapses blank lines and runs of whitespace into single spaces', () => {
    expect(excerptFromMarkdown('one\n\n\ntwo   three')).toBe('one two three')
  })

  it('returns an empty string for a file with nothing but frontmatter', () => {
    expect(excerptFromMarkdown('---\ntitle: Empty\n---\n')).toBe('')
    expect(excerptFromMarkdown('')).toBe('')
  })

  it('drops the replacement glyph a truncated read leaves behind', () => {
    expect(excerptFromMarkdown('caf�')).toBe('caf')
  })

  it('clips to the budget and marks the cut', () => {
    const result = excerptFromMarkdown('word '.repeat(200))
    expect(result.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS + 1)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toContain('wor…')
  })

  it('honours a caller-supplied budget', () => {
    expect(excerptFromMarkdown('abcdefghij klmnopqrst', 10)).toBe('abcdefghij…')
  })

  it('stops reading once it has enough, however long the file is', () => {
    const raw = Array.from({ length: 5000 }, (_, index) => `line ${index}`).join('\n')
    expect(excerptFromMarkdown(raw).startsWith('line 0 line 1 ')).toBe(true)
  })
})
