import { describe, expect, it } from 'vitest'
import {
  anchorForGroup,
  countDone,
  groupTodos,
  renderTodoLine,
  todos,
  toggleTodoLine,
} from '../todos'

const DOC = `---
title: Test
---

test

- [ ] asdfasd
  - [x] asdfasdf
- [ ] Asdfasdf

## kampus

- [ ] Pastikan skema table sudah terpenuhi.
- [x] Pahami alur flow.
`

describe('todos', () => {
  it('reads every checklist item in reading order', () => {
    expect(todos(DOC).map(item => item.text)).toEqual([
      'asdfasd',
      'asdfasdf',
      'Asdfasdf',
      'Pastikan skema table sudah terpenuhi.',
      'Pahami alur flow.',
    ])
  })

  it('reads the box', () => {
    expect(todos(DOC).map(item => item.checked)).toEqual([false, true, false, false, true])
  })

  it('numbers items by position, which is how the rich editor finds the block', () => {
    expect(todos(DOC).map(item => item.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('reports a line in the whole file, frontmatter included', () => {
    const lines = DOC.split('\n')
    for (const item of todos(DOC)) {
      expect(lines[item.line]).toContain(item.text)
    }
  })

  it('nests by indentation without assuming how wide a step is', () => {
    expect(todos(DOC).map(item => item.depth)).toEqual([0, 1, 0, 0, 0])
    const wide = '- [ ] a\n    - [ ] b\n        - [ ] c\n'
    expect(todos(wide).map(item => item.depth)).toEqual([0, 1, 2])
  })

  it('treats a tab as an indent step', () => {
    expect(todos('- [ ] a\n\t- [ ] b\n').map(item => item.depth)).toEqual([0, 1])
  })

  it('attaches each item to the heading above it', () => {
    expect(todos(DOC).map(item => item.section?.text ?? null)).toEqual([
      null,
      null,
      null,
      'kampus',
      'kampus',
    ])
  })

  it('ignores a checklist inside a code fence', () => {
    // Sample markdown in a code block is documentation, not a task.
    const fenced = '- [ ] real\n\n```md\n- [ ] example\n```\n\n- [x] also real\n'
    expect(todos(fenced).map(item => item.text)).toEqual(['real', 'also real'])
  })

  it('does not mistake a plain bullet for a task', () => {
    expect(todos('- just a bullet\n- [ ] a task\n').map(item => item.text)).toEqual(['a task'])
  })

  it('reads an item that has no text yet', () => {
    const items = todos('- [ ] \n')
    expect(items).toHaveLength(1)
    expect(items[0]!.text).toBe('')
  })

  it('accepts every bullet marker and either case of x', () => {
    expect(todos('* [X] a\n+ [x] b\n- [ ] c\n').map(item => item.checked)).toEqual([
      true,
      true,
      false,
    ])
  })

  it('strips inline markup from the label', () => {
    expect(todos('- [ ] ship `the thing` **now**\n')[0]!.text).toBe('ship the thing now')
  })

  it('starts nesting over after a paragraph breaks the list', () => {
    // Without the reset, the second list would inherit the first one's stack
    // and its top-level items would draw as children of nothing.
    const broken = '  - [ ] deep\n\nA paragraph.\n\n- [ ] top\n'
    expect(todos(broken).map(item => item.depth)).toEqual([0, 0])
  })

  it('starts nesting over after a heading', () => {
    const broken = '  - [ ] deep\n\n## next\n\n- [ ] top\n'
    expect(todos(broken).map(item => item.depth)).toEqual([0, 0])
  })

  it('finds nothing in a document with no checklist', () => {
    expect(todos('# Just prose\n\nNothing to do.\n')).toEqual([])
  })
})

describe('groupTodos', () => {
  it('gathers items under their heading, keeping document order', () => {
    const groups = groupTodos(todos(DOC))
    expect(groups.map(group => group.section?.text ?? null)).toEqual([null, 'kampus'])
    expect(groups.map(group => group.items.length)).toEqual([3, 2])
  })

  it('counts what is done in each group', () => {
    expect(groupTodos(todos(DOC)).map(group => group.done)).toEqual([1, 1])
  })

  it('leaves out a heading with no tasks of its own', () => {
    const doc = '# empty\n\n# has one\n\n- [ ] a\n'
    expect(groupTodos(todos(doc)).map(group => group.section?.text)).toEqual(['has one'])
  })

  it('starts a new group when the same heading text appears twice', () => {
    // Two `## notes` sections are two places in the document, not one group
    // whose items are scattered — jumping to "the" heading would be a guess.
    const doc = '## notes\n\n- [ ] a\n\n## other\n\n- [ ] b\n\n## notes\n\n- [ ] c\n'
    expect(groupTodos(todos(doc))).toHaveLength(3)
  })
})

describe('countDone', () => {
  it('counts across every group', () => {
    expect(countDone(todos(DOC))).toBe(2)
  })
})

describe('anchorForGroup', () => {
  it('anchors on the last item, so a new task joins the bottom of the group', () => {
    const groups = groupTodos(todos(DOC))
    expect(anchorForGroup(groups[1]!)).toEqual({ at: 'todo', index: 4 })
  })

  it('skips past a trailing sub-task so a new one is not silently nested', () => {
    const doc = '## a\n\n- [ ] one\n- [ ] two\n  - [ ] sub\n'
    expect(anchorForGroup(groupTodos(todos(doc))[0]!)).toEqual({ at: 'todo', index: 1 })
  })

  it('anchors on the heading when the section has no items yet', () => {
    const group = { section: { level: 2, text: 'x', line: 3, index: 1 }, items: [], done: 0 }
    expect(anchorForGroup(group)).toEqual({ at: 'heading', index: 1 })
  })

  it('anchors at the end when there is neither a heading nor an item', () => {
    expect(anchorForGroup({ section: null, items: [], done: 0 })).toEqual({ at: 'end' })
  })
})

describe('toggleTodoLine', () => {
  it('flips the box both ways', () => {
    expect(toggleTodoLine('- [ ] a')).toBe('- [x] a')
    expect(toggleTodoLine('- [x] a')).toBe('- [ ] a')
    expect(toggleTodoLine('- [X] a')).toBe('- [ ] a')
  })

  it('keeps the indent, the marker, and the text exactly', () => {
    expect(toggleTodoLine('   * [ ] ship `it` **now**')).toBe('   * [x] ship `it` **now**')
  })

  it('leaves an empty item empty rather than adding a trailing space', () => {
    expect(toggleTodoLine('- [ ] ')).toBe('- [x]')
  })

  it('leaves a line that is not a task alone', () => {
    expect(toggleTodoLine('- just a bullet')).toBe('- just a bullet')
  })
})

describe('renderTodoLine', () => {
  it('writes an unchecked item at the asked-for depth', () => {
    expect(renderTodoLine('  ship it  ')).toBe('- [ ] ship it')
    expect(renderTodoLine('nested', 2)).toBe('    - [ ] nested')
  })

  it('round-trips back through the scanner', () => {
    const items = todos(`${renderTodoLine('a')}\n${renderTodoLine('b', 1)}\n`)
    expect(items.map(item => [item.text, item.depth])).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })
})
