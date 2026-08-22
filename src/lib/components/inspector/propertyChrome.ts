import AlignLeft from '@lucide/svelte/icons/align-left'
import Calendar from '@lucide/svelte/icons/calendar'
import CircleCheck from '@lucide/svelte/icons/circle-check'
import Hash from '@lucide/svelte/icons/hash'
import Link from '@lucide/svelte/icons/link'
import Tag from '@lucide/svelte/icons/tag'
import ToggleRight from '@lucide/svelte/icons/toggle-right'
import type { Component } from 'svelte'
import type { PropertyType } from '$shared/propertyTypes'

/**
 * The small pieces every property surface is built from.
 *
 * They live together because the panel, the picker, and the editor popover all
 * have to agree on what a type looks like and what a menu row feels like — the
 * editor is reached *from* a row, so a chip that changed size between the two
 * would read as the value having changed.
 *
 * The markup half is next door: `Chip.svelte`, `Swatch.svelte`, `MenuItem.svelte`.
 */

export type IconComponent = Component<{ size?: number | string; strokeWidth?: number | string }>

export const TYPE_ICON: Record<PropertyType, IconComponent> = {
  text: AlignLeft,
  number: Hash,
  date: Calendar,
  boolean: ToggleRight,
  status: CircleCheck,
  url: Link,
  tags: Tag,
}

export const TYPE_LABEL: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Checkbox',
  status: 'Select',
  url: 'URL',
  tags: 'Multi-select',
}

/** Words that look wrong sentence-cased, so they keep their own capitalisation. */
const ACRONYMS = new Set(['url', 'id', 'isbn', 'doi', 'uri', 'api', 'rss'])

/** `due_date` and `Due-Date` should both read as "Due date". */
export function humanize(key: string): string {
  const spaced = key.replace(/^_+/, '').replace(/[_-]+/g, ' ').trim()
  if (ACRONYMS.has(spaced.toLowerCase())) return spaced.toUpperCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
