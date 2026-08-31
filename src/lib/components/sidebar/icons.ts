import Archive from '@lucide/svelte/icons/archive'
import Bell from '@lucide/svelte/icons/bell'
import Book from '@lucide/svelte/icons/book'
import Bookmark from '@lucide/svelte/icons/bookmark'
import Briefcase from '@lucide/svelte/icons/briefcase'
import Calendar from '@lucide/svelte/icons/calendar'
import Camera from '@lucide/svelte/icons/camera'
import ChartBar from '@lucide/svelte/icons/chart-bar'
import Check from '@lucide/svelte/icons/check'
import Code from '@lucide/svelte/icons/code'
import Coffee from '@lucide/svelte/icons/coffee'
import Cog from '@lucide/svelte/icons/cog'
import Compass from '@lucide/svelte/icons/compass'
import Database from '@lucide/svelte/icons/database'
import File from '@lucide/svelte/icons/file'
import Flag from '@lucide/svelte/icons/flag'
import Flame from '@lucide/svelte/icons/flame'
import Folder from '@lucide/svelte/icons/folder'
import Gift from '@lucide/svelte/icons/gift'
import Globe from '@lucide/svelte/icons/globe'
import Grid from '@lucide/svelte/icons/grid-3x3'
import Heart from '@lucide/svelte/icons/heart'
import House from '@lucide/svelte/icons/house'
import Image from '@lucide/svelte/icons/image'
import Inbox from '@lucide/svelte/icons/inbox'
import Key from '@lucide/svelte/icons/key'
import Link from '@lucide/svelte/icons/link'
import Lock from '@lucide/svelte/icons/lock'
import Mail from '@lucide/svelte/icons/mail'
import Map from '@lucide/svelte/icons/map'
import Music from '@lucide/svelte/icons/music'
import Package from '@lucide/svelte/icons/package'
import Paperclip from '@lucide/svelte/icons/paperclip'
import Pencil from '@lucide/svelte/icons/pencil'
import Rocket from '@lucide/svelte/icons/rocket'
import Shield from '@lucide/svelte/icons/shield'
import Star from '@lucide/svelte/icons/star'
import Tag from '@lucide/svelte/icons/tag'
import Target from '@lucide/svelte/icons/target'
import Terminal from '@lucide/svelte/icons/terminal'
import Trash from '@lucide/svelte/icons/trash'
import User from '@lucide/svelte/icons/user'
import Users from '@lucide/svelte/icons/users'
import Zap from '@lucide/svelte/icons/zap'
import type { Component } from 'svelte'

/**
 * The icons a file or folder can be given.
 *
 * A curated subset rather than everything Lucide ships. A picker showing 1600
 * glyphs is a search problem, and the point of a folder icon is to be
 * recognised at a glance — which a hundred near-identical variants work
 * against.
 *
 * The keys are what lands in `files.json` and `sidebar.json`, so renaming one
 * orphans every icon a user has already chosen. Add freely; never rename.
 */
export type IconComponent = Component<{
  size?: number | string
  /** Lucide's stroke width, in user units. Defaults to 2. */
  strokeWidth?: number | string
  class?: string
  style?: string
  fill?: string
}>

export const ICONS = {
  folder: Folder,
  file: File,
  book: Book,
  archive: Archive,
  inbox: Inbox,
  package: Package,
  briefcase: Briefcase,
  // Lucide renamed `Home` to `House`; the *key* stays `home` because it is what
  // is already written into users' `files.json`.
  home: House,
  code: Code,
  terminal: Terminal,
  database: Database,
  chart: ChartBar,
  grid: Grid,
  map: Map,
  compass: Compass,
  globe: Globe,
  calendar: Calendar,
  bell: Bell,
  mail: Mail,
  link: Link,
  paperclip: Paperclip,
  tag: Tag,
  bookmark: Bookmark,
  star: Star,
  heart: Heart,
  flag: Flag,
  target: Target,
  check: Check,
  zap: Zap,
  flame: Flame,
  rocket: Rocket,
  key: Key,
  lock: Lock,
  shield: Shield,
  user: User,
  users: Users,
  image: Image,
  camera: Camera,
  music: Music,
  coffee: Coffee,
  gift: Gift,
  pencil: Pencil,
  cog: Cog,
  trash: Trash,
} satisfies Record<string, IconComponent>

export type IconKey = keyof typeof ICONS

export const ICON_KEYS = Object.keys(ICONS) as IconKey[]

export function isIconKey(value: string | undefined): value is IconKey {
  return value !== undefined && value in ICONS
}

/**
 * Resolves a stored key to a component, falling back to the default for its
 * kind. A key written by a newer build must leave a familiar icon behind, not
 * a hole in the row.
 */
export function iconFor(key: string | undefined, fallback: IconKey): IconComponent {
  return isIconKey(key) ? ICONS[key] : ICONS[fallback]
}

/**
 * The icon a file gets when nobody has picked one for it.
 *
 * Keyed on extension so a folder of source reads as shapes before it reads as
 * names — the thing a tree of thirty similarly-named files is worst at. The
 * categories are deliberately coarse: six colours, borrowed from the editor's
 * own syntax tokens so they follow the theme, and one glyph per family rather
 * than per language. A distinct icon for every extension is a legend nobody
 * learns.
 *
 * Markdown is left neutral on purpose. It is the majority of rows in a notes
 * vault, and colouring the majority colours nothing.
 */
const FILE_TYPES: [IconKey, string, string[]][] = [
  ['file', 'var(--text-faint)', ['md', 'markdown', 'mdx', 'txt', 'log', 'diff', 'patch']],
  ['code', 'var(--code-function)', [
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'svelte', 'vue', 'astro',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'php',
    'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'm', 'mm',
    'lua', 'r', 'pl', 'dart', 'zig', 'ex', 'exs', 'erl', 'clj', 'scala', 'groovy',
    'graphql', 'proto',
  ]],
  ['terminal', 'var(--code-string)', ['sh', 'bash', 'zsh', 'fish']],
  ['cog', 'var(--code-number)', [
    'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'hcl', 'tf',
  ]],
  ['globe', 'var(--code-keyword)', ['html', 'xml', 'css', 'scss', 'sass', 'less']],
  ['database', 'var(--code-type)', ['sql', 'csv', 'tsv']],
]

// A plain object, not a `Map` — `Map` is a Lucide icon in this module's scope,
// and `new Map(...)` here instantiates the glyph.
const BY_EXTENSION: Record<string, { icon: IconKey; color: string }> = Object.fromEntries(
  FILE_TYPES.flatMap(([icon, color, extensions]) =>
    extensions.map(ext => [ext, { icon, color }] as const),
  ),
)

/**
 * The icon and tint for one file row. A key the user chose wins over the
 * extension — the picker exists to override exactly this — and their colour
 * wins over the type's, which is why the tint is returned rather than applied.
 */
export function fileIconFor(
  name: string,
  key?: string,
): { Icon: IconComponent; color: string } {
  const byType = BY_EXTENSION[name.slice(name.lastIndexOf('.') + 1).toLowerCase()]
  return {
    Icon: iconFor(key, byType?.icon ?? 'file'),
    color: byType?.color ?? 'var(--text-faint)',
  }
}
