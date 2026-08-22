import { describe, expect, it } from 'vitest'
import { linkAction, linkTargets, linksToFile, resolveLink } from '../links'

describe('linkTargets', () => {
  it('finds inline links and images, with absolute line numbers', () => {
    const content = ['# Title', '', 'See [the plan](./plan.md).', '', '![shot](assets/a.png)'].join('\n')
    expect(linkTargets(content)).toEqual([
      { target: './plan.md', line: 2, text: 'See [the plan](./plan.md).', image: false },
      { target: 'assets/a.png', line: 4, text: '![shot](assets/a.png)', image: true },
    ])
  })

  it('counts frontmatter lines, so a line number matches the file', () => {
    const content = ['---', 'title: x', '---', '', '[plan](./plan.md)'].join('\n')
    expect(linkTargets(content).map(ref => ref.line)).toEqual([4])
  })

  it('ignores links inside fenced code, which are sample text', () => {
    const content = ['```md', '[not a link](./nope.md)', '```', '[real](./yes.md)'].join('\n')
    expect(linkTargets(content).map(ref => ref.target)).toEqual(['./yes.md'])
  })

  it('reads reference definitions, which are links written elsewhere', () => {
    const content = ['Text [plan][1].', '', '[1]: ./plan.md'].join('\n')
    expect(linkTargets(content).map(ref => ref.target)).toEqual(['./plan.md'])
  })

  it('drops a title after the target rather than taking it as part of the path', () => {
    expect(linkTargets('[a](./plan.md "The plan")')[0]?.target).toBe('./plan.md')
  })

  it('unwraps an angle-bracketed target, which is how a path with spaces is written', () => {
    expect(linkTargets('[a](<./my plan.md>)')[0]?.target).toBe('./my plan.md')
  })

  it('finds two links on one line', () => {
    expect(linkTargets('[a](./a.md) and [b](./b.md)').map(ref => ref.target)).toEqual([
      './a.md',
      './b.md',
    ])
  })
})

describe('resolveLink', () => {
  const from = '/notes/clients/acme.md'

  it('resolves a sibling', () => {
    expect(resolveLink(from, './brief.md')).toBe('/notes/clients/brief.md')
  })

  it('resolves a bare relative target', () => {
    expect(resolveLink(from, 'brief.md')).toBe('/notes/clients/brief.md')
  })

  it('walks up out of the folder', () => {
    expect(resolveLink(from, '../plan.md')).toBe('/notes/plan.md')
  })

  it('collapses interior . and .. segments', () => {
    expect(resolveLink(from, '../clients/./sub/../brief.md')).toBe('/notes/clients/brief.md')
  })

  it('keeps an absolute target as it is', () => {
    expect(resolveLink(from, '/other/plan.md')).toBe('/other/plan.md')
  })

  it('drops the anchor, so a link to a heading still points at the file', () => {
    expect(resolveLink(from, './brief.md#budget')).toBe('/notes/clients/brief.md')
  })

  it('decodes percent-encoding, because a space is often written %20', () => {
    expect(resolveLink(from, './my%20brief.md')).toBe('/notes/clients/my brief.md')
  })

  it('survives a malformed percent-escape instead of throwing', () => {
    expect(resolveLink(from, './100%.md')).toBe('/notes/clients/100%.md')
  })

  it('refuses anything with a URL scheme', () => {
    expect(resolveLink(from, 'https://example.com/plan.md')).toBeNull()
    expect(resolveLink(from, 'mailto:someone@example.com')).toBeNull()
  })

  it('refuses a bare anchor, which points inside the same file', () => {
    expect(resolveLink(from, '#budget')).toBeNull()
  })

  it('refuses an empty target', () => {
    expect(resolveLink(from, '')).toBeNull()
  })
})

describe('linksToFile', () => {
  const from = '/notes/clients/acme.md'
  const target = '/notes/plan.md'

  it('matches a link that resolves to the target', () => {
    const hits = linksToFile('See [plan](../plan.md).', from, target)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.line).toBe(0)
  })

  it('ignores a link to a different file with the same name', () => {
    expect(linksToFile('[plan](./plan.md)', from, target)).toEqual([])
  })

  it('matches every occurrence, so the count is the real one', () => {
    const content = ['[a](../plan.md)', '', '[b](../plan.md#top)'].join('\n')
    expect(linksToFile(content, from, target).map(hit => hit.line)).toEqual([0, 2])
  })

  it('ignores images, which point at assets rather than notes', () => {
    expect(linksToFile('![plan](../plan.md)', from, target)).toEqual([])
  })
})

describe('linkAction', () => {
  const from = '/notes/clients/acme.md'

  it('opens a markdown link as a note', () => {
    expect(linkAction(from, '../plan.md')).toEqual({ kind: 'note', path: '/notes/plan.md' })
  })

  it('treats every markdown extension as a note', () => {
    expect(linkAction(from, './a.markdown').kind).toBe('note')
    expect(linkAction(from, './a.mdx').kind).toBe('note')
  })

  it('opens a link with an anchor as the note it names', () => {
    expect(linkAction(from, '../plan.md#budget')).toEqual({ kind: 'note', path: '/notes/plan.md' })
  })

  it('treats anything else on disk as a file rather than a note', () => {
    expect(linkAction(from, './assets/shot.png')).toEqual({
      kind: 'file',
      path: '/notes/clients/assets/shot.png',
    })
  })

  it('sends http, https, and mailto outside', () => {
    expect(linkAction(from, 'https://example.com')).toEqual({
      kind: 'external',
      url: 'https://example.com',
    })
    expect(linkAction(from, 'http://example.com').kind).toBe('external')
    expect(linkAction(from, 'mailto:a@example.com').kind).toBe('external')
  })

  // A note can arrive from a repository, a download, or another person, so the
  // scheme it names must never be enough to decide which program runs.
  it('refuses every other scheme, so a document cannot choose what launches', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vscode://file/etc/passwd',
      'slack://open',
      'JavaScript:alert(1)',
    ]) {
      expect(linkAction(from, url).kind).toBe('blocked')
    }
  })

  it('explains a refusal instead of doing nothing', () => {
    const action = linkAction(from, 'javascript:alert(1)')
    expect(action.kind === 'blocked' && action.reason).toContain('javascript:')
  })

  it('refuses a bare anchor, which is not another file', () => {
    expect(linkAction(from, '#budget').kind).toBe('blocked')
  })

  it('refuses an empty target', () => {
    expect(linkAction(from, '   ').kind).toBe('blocked')
  })
})
