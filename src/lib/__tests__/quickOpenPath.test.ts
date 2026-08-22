import { describe, expect, it } from 'vitest'
import type { PathCompletion } from '$shared/types'
import {
  displayPath,
  isPathStart,
  parentQuery,
  pathEmptyMessage,
  typedPathAction,
} from '../quickOpenPath'

/**
 * The palette must never be a dead end. A fully typed path with an unresponsive
 * completion behind it still has to open on Enter — that failure mode is what
 * this whole module exists for.
 */

const HOME = '/Users/me'

function completion(patch: Partial<PathCompletion> & { resolved: string }): PathCompletion {
  return {
    dir: '/Users/me/project',
    dirExists: true,
    kind: 'file',
    openable: true,
    entries: [],
    hiddenCount: 0,
    ...patch,
  }
}

describe('typedPathAction', () => {
  it('opens a typed path when no completion came back at all', () => {
    expect(typedPathAction('/Users/me/project/README.md', HOME, null)).toEqual({
      kind: 'open',
      path: '/Users/me/project/README.md',
    })
  })

  it('expands ~ for that blind attempt', () => {
    expect(typedPathAction('~/project/README.md', HOME, null)).toEqual({
      kind: 'open',
      path: '/Users/me/project/README.md',
    })
  })

  it('waits rather than guessing when the home directory is unknown', () => {
    expect(typedPathAction('~/project/README.md', '', null)).toEqual({ kind: 'none' })
  })

  it('does nothing for a path that is still being typed', () => {
    expect(typedPathAction('/Users/me/project/', HOME, null)).toEqual({ kind: 'none' })
    expect(typedPathAction('~', HOME, null)).toEqual({ kind: 'none' })
    expect(typedPathAction('/', HOME, null)).toEqual({ kind: 'none' })
  })

  it('leaves a name search alone', () => {
    expect(typedPathAction('readme', HOME, null)).toEqual({ kind: 'none' })
  })

  it('walks into a folder the completion identified', () => {
    const result = typedPathAction(
      '/Users/me/project',
      HOME,
      completion({ resolved: '/Users/me/project', kind: 'directory', openable: false }),
    )
    expect(result).toEqual({ kind: 'descend', query: '/Users/me/project/' })
  })

  it('refuses a file the app cannot render', () => {
    expect(
      typedPathAction(
        '/Users/me/project/logo.png',
        HOME,
        completion({ resolved: '/Users/me/project/logo.png', openable: false }),
      ),
    ).toEqual({ kind: 'none' })
  })

  it('ignores a completion left over from an earlier keystroke', () => {
    // Acting on it would open whatever was under the cursor two characters ago.
    const stale = completion({ resolved: '/Users/me/project/OLD.md' })
    expect(typedPathAction('/Users/me/project/NEW.md', HOME, stale)).toEqual({
      kind: 'open',
      path: '/Users/me/project/NEW.md',
    })
  })
})

describe('pathEmptyMessage', () => {
  it('offers Enter as the way out of a failed completion', () => {
    expect(pathEmptyMessage(null, true)).toMatch(/Enter/)
  })

  it('distinguishes a missing folder from an empty one', () => {
    expect(pathEmptyMessage(completion({ resolved: '/x', dirExists: false }), false)).toMatch(
      /folder does not exist/,
    )
    expect(
      pathEmptyMessage(completion({ resolved: '/x', kind: 'directory', openable: false }), false),
    ).toMatch(/No markdown files/)
  })

  it('says so when the file is not one the app opens', () => {
    expect(pathEmptyMessage(completion({ resolved: '/x.png', openable: false }), false)).toBe(
      'Not a markdown file',
    )
  })
})

describe('isPathStart', () => {
  it('is true while no folder has been named', () => {
    // This is what decides between forty folders nobody asked for and the
    // handful you actually use.
    expect(isPathStart('~/', HOME)).toBe(true)
    expect(isPathStart('~', HOME)).toBe(true)
    expect(isPathStart('/', HOME)).toBe(true)
  })

  it('is false the moment one is', () => {
    expect(isPathStart('~/project', HOME)).toBe(false)
    expect(isPathStart('~/p', HOME)).toBe(false)
  })

  it('is false for a name search', () => {
    expect(isPathStart('plan', HOME)).toBe(false)
  })
})

describe('parentQuery', () => {
  it('climbs out of a folder you are looking inside', () => {
    expect(parentQuery('/Users/me/project/docs/', HOME)).toBe('/Users/me/project/')
  })

  it('drops a half-typed name before it climbs anything', () => {
    // One step at a time: the name you were typing goes first, and the folder
    // you were typing it in stays. `←` never reaches this case — it is reserved
    // for moving the caret unless the path already ends in a slash.
    expect(parentQuery('/Users/me/project/RE', HOME)).toBe('/Users/me/project/')
  })

  it('always lands inside the parent, never editing its name', () => {
    expect(parentQuery('~/project/', HOME)?.endsWith('/')).toBe(true)
  })

  it('stops at the root instead of looping', () => {
    expect(parentQuery('/', HOME)).toBeNull()
    expect(parentQuery('/Users', HOME)).toBe('/')
  })

  it('leaves a name search alone', () => {
    expect(parentQuery('plan', HOME)).toBeNull()
  })
})

describe('displayPath', () => {
  it('shortens the home directory', () => {
    expect(displayPath('/Users/me/project/a.md', HOME)).toBe('~/project/a.md')
    expect(displayPath(HOME, HOME)).toBe('~')
  })

  it('leaves anything outside it alone', () => {
    expect(displayPath('/etc/hosts', HOME)).toBe('/etc/hosts')
    // A sibling that merely starts with the same characters is not inside it.
    expect(displayPath('/Users/mel/x.md', HOME)).toBe('/Users/mel/x.md')
  })

  it('does nothing useful, and nothing wrong, without a home', () => {
    expect(displayPath('/Users/me/x.md', '')).toBe('/Users/me/x.md')
  })
})
