import { describe, expect, it, vi } from 'vitest'
import { filterSlashGroups, type SlashGroup } from '@/components/edra/tiptap/extensions/slash/index'
import { richExtensions } from '../richExtensions'

/**
 * "Link to file" in the `/` menu.
 *
 * The item is contributed by the app rather than living in Edra's own groups, so
 * two things can break quietly: the extension can stop reading `extraGroups`
 * (the item just never appears), and the matcher can stop reading `aliases` (the
 * item appears, but only for people who already type its exact name — which is
 * the audience that has `⌘K` and does not need the menu).
 */

/** The `extraGroups` the real extension was configured with. */
function configuredGroups(options: Parameters<typeof richExtensions>[0]): SlashGroup[] {
  const slash = richExtensions(options).find(
    extension => extension.name === 'slashCommand',
  ) as unknown as { options: { extraGroups: SlashGroup[] } }
  return slash.options.extraGroups
}

describe('the “Link to file” slash item', () => {
  it('is offered, and opens the picker rather than inserting anything itself', () => {
    const onLinkFile = vi.fn()
    const groups = configuredGroups({ onLinkFile })

    const item = groups.flatMap(group => group.actions).find(action => action.name === 'linkFile')
    expect(item?.tooltip).toBe('Link to file')

    // The editor is passed but unused: the picker inserts through
    // `app:insert-link`, the same route ⌘K takes.
    item?.onClick?.(null as never)
    expect(onLinkFile).toHaveBeenCalledOnce()
  })

  it('is absent without a picker to open — the round-trip test builds it that way', () => {
    expect(configuredGroups({})).toEqual([])
  })

  it('is found by the words people arrive typing, not just its own name', () => {
    const groups = configuredGroups({ onLinkFile: () => {} })
    const titles = (query: string) =>
      filterSlashGroups(groups, query).flatMap(group =>
        group.commands.map(command => command.tooltip),
      )

    for (const query of ['lin', 'Link', 'note', 'wikilink', 'page', '']) {
      expect(titles(query), `query: ${query || '(empty)'}`).toContain('Link to file')
    }
    expect(titles('mermaid')).toEqual([])
  })
})

describe('the slash matcher', () => {
  const groups: SlashGroup[] = [
    {
      name: 'format',
      title: 'Format',
      actions: [
        { name: 'a', icon: null as never, tooltip: 'Bold' },
        { name: 'b', icon: null as never, tooltip: 'Callout', aliases: ['admonition'] },
      ],
    },
  ]

  it('drops groups that match nothing rather than showing an empty heading', () => {
    expect(filterSlashGroups(groups, 'admonition')).toEqual([
      { ...groups[0], commands: [groups[0]!.actions[1]] },
    ])
    expect(filterSlashGroups(groups, 'nothing here')).toEqual([])
  })

  it('ignores case and the space a typed query tends to end with', () => {
    expect(filterSlashGroups(groups, '  BOLD ')[0]?.commands).toHaveLength(1)
  })
})
