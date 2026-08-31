import { describe, expect, it } from 'vitest'
import { ICONS, fileIconFor } from '@/components/sidebar/icons'

/**
 * The extension → icon table. The lookup is what breaks silently: a wrong slice
 * gives every row the same generic file, which still renders and still looks
 * plausible.
 */
describe('fileIconFor', () => {
  it('picks by extension, case-insensitively', () => {
    expect(fileIconFor('App.tsx').Icon).toBe(ICONS.code)
    expect(fileIconFor('deploy.SH').Icon).toBe(ICONS.terminal)
    expect(fileIconFor('tsconfig.json').Icon).toBe(ICONS.cog)
    expect(fileIconFor('schema.sql').Icon).toBe(ICONS.database)
  })

  it('leaves notes and unknown names on the neutral default', () => {
    expect(fileIconFor('notes.md')).toEqual({ Icon: ICONS.file, color: 'var(--text-faint)' })
    expect(fileIconFor('Makefile')).toEqual({ Icon: ICONS.file, color: 'var(--text-faint)' })
  })

  it('lets a chosen icon win over the extension', () => {
    expect(fileIconFor('App.tsx', 'rocket').Icon).toBe(ICONS.rocket)
    // A key from a newer build still falls back to the type, not to a hole.
    expect(fileIconFor('App.tsx', 'nonesuch').Icon).toBe(ICONS.code)
  })
})
