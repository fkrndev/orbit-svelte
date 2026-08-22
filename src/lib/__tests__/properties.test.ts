import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * These operations each write two things — the file and the schema — and the
 * failure mode is not a crash but a quiet disagreement: a panel that says
 * `stage` over a file that still says `status`, or a colour attached to an
 * option no note uses any more.
 *
 * So every test here asserts on *both* halves, and the file half is read back
 * out of the frontmatter rather than out of whatever the action returned.
 */
vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: () => vi.fn(async () => undefined),
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { readProperty, readProperties } = await import('../../shared/frontmatter')
const { EMPTY_PROPERTY_SCHEMA, configFor, resolveType } = await import('../../shared/propertySchema')
const {
  addPropertyOption,
  changePropertyType,
  createProperty,
  deletePropertyOption,
  duplicateProperty,
  renamePropertyOption,
  renamePropertyTo,
  reorderProperties,
  selectPropertyValue,
} = await import('../properties')

const PATH = '/notes/one.md'

const DOC = `---
title: Hello world
status: draft
count: 007
tags: [rust, notes]
---

# Body
`

function content(): string {
  return getState().tabs[0]!.content
}

function entry(key: string) {
  const found = readProperty(content(), key)
  if (!found) throw new Error(`no property ${key}`)
  return found
}

beforeEach(() => {
  setState({
    propertySchema: structuredClone(EMPTY_PROPERTY_SCHEMA),
    tabs: [
      {
        path: PATH,
        name: 'one.md',
        content: DOC,
        savedContent: DOC,
        mtimeMs: 0,
        meta: null,
        conflict: false,
        missing: false,
      },
    ],
  })
})

describe('createProperty', () => {
  it('remembers the property without writing an empty one into the file', () => {
    // Half-finished `owner: ''` is litter in a document the app did not create.
    expect(createProperty('owner', 'text')).toBe(true)
    expect(configFor(getState().propertySchema, 'owner').type).toBe('text')
    expect(readProperty(content(), 'owner')).toBeNull()
  })

  it('gives a new select something to choose from', () => {
    createProperty('stage', 'status')
    expect(configFor(getState().propertySchema, 'stage').options?.length).toBeGreaterThan(0)
  })

  it('refuses a name YAML could not hold', () => {
    expect(createProperty('a: b', 'text')).toBe(false)
    expect(getState().propertySchema.props['a: b']).toBeUndefined()
  })
})

describe('changePropertyType', () => {
  it('locks the type so inference cannot guess the old one back', () => {
    changePropertyType(PATH, entry('count'), 'text')
    expect(resolveType(getState().propertySchema, entry('count'))).toBe('text')
  })

  it('rewrites the value so it is legible in the new editor', () => {
    changePropertyType(PATH, entry('status'), 'tags')
    expect(entry('status').items).toEqual(['draft'])
  })

  it('drops a value the new type cannot hold rather than inventing one', () => {
    changePropertyType(PATH, entry('title'), 'date')
    expect(readProperty(content(), 'title')).toBeNull()
    // The decision itself survives, so the row still offers a date picker.
    expect(configFor(getState().propertySchema, 'title').type).toBe('date')
  })
})

describe('renamePropertyTo', () => {
  it('renames in the file and carries the config across', () => {
    addPropertyOption('status', 'draft')
    expect(renamePropertyTo(PATH, 'status', 'stage')).toBe(true)
    expect(entry('stage').value).toBe('draft')
    expect(readProperty(content(), 'status')).toBeNull()
    expect(configFor(getState().propertySchema, 'stage').options).toEqual([
      { name: 'draft', color: expect.any(String) },
    ])
  })

  it('keeps the property where it was in the block', () => {
    renamePropertyTo(PATH, 'status', 'stage')
    expect(readProperties(content()).map(item => item.key)).toEqual([
      'title',
      'stage',
      'count',
      'tags',
    ])
  })

  it('refuses a collision and leaves both the file and the schema alone', () => {
    const before = content()
    expect(renamePropertyTo(PATH, 'status', 'title')).toBe(false)
    expect(content()).toBe(before)
    expect(configFor(getState().propertySchema, 'title')).toEqual({})
  })

  it('refuses a name YAML could not hold', () => {
    const before = content()
    expect(renamePropertyTo(PATH, 'status', '2 stage')).toBe(false)
    expect(content()).toBe(before)
  })
})

describe('duplicateProperty', () => {
  it('copies the value onto a name nothing else is using', () => {
    expect(duplicateProperty(PATH, entry('status'))).toBe('status 2')
    expect(entry('status 2').value).toBe('draft')
    expect(entry('status').value).toBe('draft')
  })

  it('copies the config too, so the duplicate looks like its original', () => {
    addPropertyOption('status', 'draft')
    duplicateProperty(PATH, entry('status'))
    expect(configFor(getState().propertySchema, 'status 2').options).toEqual(
      configFor(getState().propertySchema, 'status').options,
    )
  })

  it('duplicates a list without flattening it', () => {
    duplicateProperty(PATH, entry('tags'))
    expect(entry('tags 2').items).toEqual(['rust', 'notes'])
  })
})

describe('selectPropertyValue', () => {
  it('remembers a value picked for the first time as an option', () => {
    selectPropertyValue(PATH, 'status', 'status', 'shipped')
    expect(configFor(getState().propertySchema, 'status').options).toEqual([
      { name: 'shipped', color: expect.any(String) },
    ])
    expect(entry('status').value).toBe('shipped')
  })

  it('removes the property rather than leaving an empty one behind', () => {
    selectPropertyValue(PATH, 'status', 'status', '')
    expect(readProperty(content(), 'status')).toBeNull()
  })

  it('remembers every tag of a multi-select at once', () => {
    selectPropertyValue(PATH, 'tags', 'tags', ['rust', 'bun'])
    expect(
      configFor(getState().propertySchema, 'tags').options?.map(option => option.name),
    ).toEqual(['rust', 'bun'])
    expect(entry('tags').items).toEqual(['rust', 'bun'])
  })
})

describe('option edits reach the open file', () => {
  it('renames the option and the value that used it', () => {
    selectPropertyValue(PATH, 'status', 'status', 'draft')
    renamePropertyOption(PATH, 'status', 'status', 'draft', 'writing')
    expect(entry('status').value).toBe('writing')
    expect(configFor(getState().propertySchema, 'status').options).toEqual([
      { name: 'writing', color: expect.any(String) },
    ])
  })

  it('renames only the matching item of a multi-select', () => {
    selectPropertyValue(PATH, 'tags', 'tags', ['rust', 'notes'])
    renamePropertyOption(PATH, 'tags', 'tags', 'rust', 'systems')
    expect(entry('tags').items).toEqual(['systems', 'notes'])
  })

  it('deleting an option takes the value with it', () => {
    selectPropertyValue(PATH, 'tags', 'tags', ['rust', 'notes'])
    deletePropertyOption(PATH, 'tags', 'tags', 'rust')
    expect(entry('tags').items).toEqual(['notes'])
    expect(
      configFor(getState().propertySchema, 'tags').options?.map(option => option.name),
    ).toEqual(['notes'])
  })

  it('deleting the only value of a select removes the property', () => {
    selectPropertyValue(PATH, 'status', 'status', 'draft')
    deletePropertyOption(PATH, 'status', 'status', 'draft')
    expect(readProperty(content(), 'status')).toBeNull()
  })

  it('leaves the file alone when the option it removed was never used here', () => {
    addPropertyOption('status', 'shipped')
    const before = content()
    deletePropertyOption(PATH, 'status', 'status', 'shipped')
    expect(content()).toBe(before)
  })
})

describe('reorderProperties', () => {
  it('records the order in the schema and not in the file', () => {
    const before = content()
    reorderProperties(['tags', 'status', 'title'])
    expect(getState().propertySchema.order).toEqual(['tags', 'status', 'title'])
    expect(content()).toBe(before)
  })
})
