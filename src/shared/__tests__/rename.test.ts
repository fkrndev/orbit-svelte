import { describe, expect, it } from 'vitest'
import {
  isOpenableName,
  nameWithoutExtension,
  planFolderRename,
  planRename,
  retargetUnder,
} from '../rename'

const FILE = '/Users/me/notes/plan.md'
const FOLDER = '/Users/me/notes/drafts'

describe('planRename', () => {
  it('resolves a bare name against the file’s own folder', () => {
    expect(planRename(FILE, 'roadmap')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/roadmap.md',
    })
  })

  it('keeps an extension the user typed', () => {
    expect(planRename(FILE, 'roadmap.markdown')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/roadmap.markdown',
    })
  })

  it('reuses the original extension rather than forcing .md', () => {
    // Renaming a .mdx file must not quietly convert it into something the
    // editor would then treat differently.
    expect(planRename('/Users/me/notes/post.mdx', 'article')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/article.mdx',
    })
  })

  it('keeps a code file a code file', () => {
    // The rule that stops a rename from turning source into markdown: the app
    // opens `.tsx`, so the extension is the file's, not a markdown default.
    expect(planRename('/Users/me/app/App.tsx', 'Button')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/app/Button.tsx',
    })
  })

  it('appends an extension so the file cannot vanish from the tree', () => {
    // Every listing and walk filters on the markdown extensions, so an
    // extensionless result would disappear from the sidebar and quick-open.
    const plan = planRename(FILE, 'meeting notes')
    expect(plan).toEqual({ kind: 'ok', nextPath: '/Users/me/notes/meeting notes.md' })
  })

  it('treats the same name as a no-op, with or without the extension', () => {
    expect(planRename(FILE, 'plan').kind).toBe('unchanged')
    expect(planRename(FILE, 'plan.md').kind).toBe('unchanged')
    expect(planRename(FILE, '  plan  ').kind).toBe('unchanged')
  })

  it('rejects an empty name', () => {
    expect(planRename(FILE, '   ').kind).toBe('invalid')
  })

  it('refuses to let a rename become a move', () => {
    // The dangerous case: a separator would relocate the file out of the folder
    // the user was looking at, which is not what "rename" means anywhere.
    expect(planRename(FILE, '../elsewhere').kind).toBe('invalid')
    expect(planRename(FILE, 'sub/plan').kind).toBe('invalid')
    expect(planRename(FILE, '/etc/passwd').kind).toBe('invalid')
  })

  it('rejects the directory aliases', () => {
    expect(planRename(FILE, '.').kind).toBe('invalid')
    expect(planRename(FILE, '..').kind).toBe('invalid')
  })

  it('allows spaces, dashes, and dots inside the name', () => {
    expect(planRename(FILE, '2026-08-14 review v1.2')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/2026-08-14 review v1.2.md',
    })
  })
})

describe('planFolderRename', () => {
  it('resolves the name against the folder’s own parent', () => {
    expect(planFolderRename(FOLDER, 'archive')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/archive',
    })
  })

  it('never attaches a markdown extension', () => {
    expect(planFolderRename(FOLDER, 'archive')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/archive',
    })
    // A folder named like a file stays exactly what the user typed.
    expect(planFolderRename(FOLDER, 'notes.md')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/notes.md',
    })
  })

  it('rejects a leading dot, which would hide the folder from every listing', () => {
    expect(planFolderRename(FOLDER, '.archive')).toMatchObject({ kind: 'invalid' })
  })

  it('rejects separators, so a rename cannot become a move', () => {
    expect(planFolderRename(FOLDER, '../archive')).toMatchObject({ kind: 'invalid' })
    expect(planFolderRename(FOLDER, 'a/b')).toMatchObject({ kind: 'invalid' })
  })

  it('rejects empty and dot names', () => {
    expect(planFolderRename(FOLDER, '   ')).toMatchObject({ kind: 'invalid' })
    expect(planFolderRename(FOLDER, '.')).toMatchObject({ kind: 'invalid' })
    expect(planFolderRename(FOLDER, '..')).toMatchObject({ kind: 'invalid' })
  })

  it('reports the current name as unchanged', () => {
    expect(planFolderRename(FOLDER, 'drafts')).toEqual({ kind: 'unchanged' })
    expect(planFolderRename(FOLDER, '  drafts  ')).toEqual({ kind: 'unchanged' })
  })

  it('treats a change of case as a real rename', () => {
    expect(planFolderRename(FOLDER, 'Drafts')).toEqual({
      kind: 'ok',
      nextPath: '/Users/me/notes/Drafts',
    })
  })
})

describe('retargetUnder', () => {
  const FROM = '/Users/me/notes/drafts'
  const TO = '/Users/me/notes/archive'

  it('moves the folder itself', () => {
    expect(retargetUnder(FROM, FROM, TO)).toBe(TO)
  })

  it('moves everything inside it, at any depth', () => {
    expect(retargetUnder(`${FROM}/a.md`, FROM, TO)).toBe(`${TO}/a.md`)
    expect(retargetUnder(`${FROM}/deep/nested/b.md`, FROM, TO)).toBe(`${TO}/deep/nested/b.md`)
  })

  it('leaves paths outside the move alone', () => {
    expect(retargetUnder('/Users/me/notes/other.md', FROM, TO)).toBeNull()
    expect(retargetUnder('/Users/me/elsewhere/a.md', FROM, TO)).toBeNull()
  })

  it('does not treat a sibling with a shared prefix as being inside', () => {
    // `drafts-old` starts with `drafts`, and a naive prefix test would drag it
    // along — renaming one folder would corrupt every path in its neighbour.
    expect(retargetUnder('/Users/me/notes/drafts-old/a.md', FROM, TO)).toBeNull()
    expect(retargetUnder('/Users/me/notes/draftsy', FROM, TO)).toBeNull()
  })

  it('reports no move when the two paths are the same', () => {
    expect(retargetUnder(`${FROM}/a.md`, FROM, FROM)).toBeNull()
  })
})

describe('nameWithoutExtension', () => {
  it('strips only the markdown extensions', () => {
    expect(nameWithoutExtension('/a/plan.md')).toBe('plan')
    expect(nameWithoutExtension('/a/post.mdx')).toBe('post')
    expect(nameWithoutExtension('/a/notes.markdown')).toBe('notes')
  })

  it('leaves an unfamiliar extension alone, so renaming cannot truncate it', () => {
    expect(nameWithoutExtension('/a/archive.tar.gz')).toBe('archive.tar.gz')
    expect(nameWithoutExtension('/a/README')).toBe('README')
  })
})
