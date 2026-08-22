import { describe, expect, it } from 'vitest'
import {
  EMPTY_TREE,
  MAX_EXPANDED,
  ancestorsWithin,
  collapse,
  collapseUnder,
  expand,
  expandMany,
  hydrateExpanded,
  isExpanded,
  isUnder,
  movePrefix,
  pruneToRoots,
  reveal,
  serializeExpanded,
  toggle,
} from '../tree'

const ROOT = '/home/me/notes'

const treeOf = (...paths: string[]) => expandMany(EMPTY_TREE, paths)

describe('expand and collapse', () => {
  it('toggles a single folder', () => {
    const opened = toggle(EMPTY_TREE, `${ROOT}/docs`)
    expect(isExpanded(opened, `${ROOT}/docs`)).toBe(true)
    expect(isExpanded(toggle(opened, `${ROOT}/docs`), `${ROOT}/docs`)).toBe(false)
  })

  it('returns the same object when nothing changes', () => {
    const state = treeOf(`${ROOT}/docs`)
    // Identity matters: the store compares by reference, so a no-op that
    // allocates would re-render the whole tree on every click that did nothing.
    expect(expand(state, `${ROOT}/docs`)).toBe(state)
    expect(collapse(state, `${ROOT}/other`)).toBe(state)
    expect(expandMany(state, [`${ROOT}/docs`])).toBe(state)
  })

  it('keeps a child open when its parent closes', () => {
    // The bug this whole module exists to fix: state used to live inside the
    // node, so closing a parent unmounted — and erased — everything below it.
    const state = treeOf(`${ROOT}/docs`, `${ROOT}/docs/adr`)
    const closed = collapse(state, `${ROOT}/docs`)
    expect(isExpanded(closed, `${ROOT}/docs`)).toBe(false)
    expect(isExpanded(closed, `${ROOT}/docs/adr`)).toBe(true)
  })
})

describe('collapseUnder', () => {
  it('closes one root and leaves the others alone', () => {
    const other = '/home/me/work'
    const state = treeOf(`${ROOT}/docs`, `${ROOT}/docs/adr`, `${other}/src`)
    const collapsed = collapseUnder(state, ROOT)
    expect([...collapsed.expanded]).toEqual([`${other}/src`])
  })

  it('does not touch a sibling root that merely shares a prefix', () => {
    // `/home/me/notes-archive` starts with `/home/me/notes` as a string but is
    // not inside it.
    const sibling = '/home/me/notes-archive/old'
    const collapsed = collapseUnder(treeOf(`${ROOT}/docs`, sibling), ROOT)
    expect([...collapsed.expanded]).toEqual([sibling])
  })
})

describe('isUnder', () => {
  it('requires a real path boundary', () => {
    expect(isUnder(`${ROOT}/docs`, ROOT)).toBe(true)
    expect(isUnder(ROOT, ROOT)).toBe(false)
    expect(isUnder('/home/me/notes-archive', ROOT)).toBe(false)
  })
})

describe('ancestorsWithin', () => {
  it('lists the folders between the root and the file, outermost first', () => {
    expect(ancestorsWithin(ROOT, `${ROOT}/docs/adr/0001.md`)).toEqual([
      `${ROOT}/docs`,
      `${ROOT}/docs/adr`,
    ])
  })

  it('excludes the target itself', () => {
    expect(ancestorsWithin(ROOT, `${ROOT}/plan.md`)).toEqual([])
  })

  it('returns nothing for a path outside the root', () => {
    expect(ancestorsWithin(ROOT, '/elsewhere/plan.md')).toEqual([])
  })
})

describe('reveal', () => {
  it('opens every folder on the way to a file', () => {
    const state = reveal(EMPTY_TREE, ROOT, `${ROOT}/a/b/c.md`)
    expect([...state.expanded].sort()).toEqual([`${ROOT}/a`, `${ROOT}/a/b`])
  })
})

describe('movePrefix', () => {
  it('rewrites the folder and everything under it', () => {
    const state = treeOf(`${ROOT}/docs`, `${ROOT}/docs/adr`, `${ROOT}/other`)
    const moved = movePrefix(state, `${ROOT}/docs`, `${ROOT}/documents`)
    expect([...moved.expanded].sort()).toEqual([
      `${ROOT}/documents`,
      `${ROOT}/documents/adr`,
      `${ROOT}/other`,
    ])
  })

  it('leaves a same-prefix sibling untouched', () => {
    const state = treeOf(`${ROOT}/docs`, `${ROOT}/docs-old`)
    const moved = movePrefix(state, `${ROOT}/docs`, `${ROOT}/documents`)
    expect([...moved.expanded].sort()).toEqual([`${ROOT}/docs-old`, `${ROOT}/documents`])
  })
})

describe('pruneToRoots', () => {
  it('drops folders that no longer belong to any root', () => {
    const state = treeOf(`${ROOT}/docs`, '/removed/root/src')
    expect([...pruneToRoots(state, [ROOT]).expanded]).toEqual([`${ROOT}/docs`])
  })
})

describe('persistence', () => {
  it('serializes sorted, so an unchanged tree writes an unchanged file', () => {
    const a = treeOf(`${ROOT}/b`, `${ROOT}/a`)
    const b = treeOf(`${ROOT}/a`, `${ROOT}/b`)
    expect(serializeExpanded(a)).toEqual(serializeExpanded(b))
  })

  it('caps what it writes and what it reads back', () => {
    const many = Array.from({ length: MAX_EXPANDED + 50 }, (_, i) => `${ROOT}/f${i}`)
    expect(serializeExpanded(treeOf(...many))).toHaveLength(MAX_EXPANDED)
    expect(hydrateExpanded(many).expanded.size).toBe(MAX_EXPANDED)
  })

  it('treats a missing setting as an empty tree', () => {
    expect(hydrateExpanded(undefined)).toBe(EMPTY_TREE)
    expect(hydrateExpanded([])).toBe(EMPTY_TREE)
  })
})
