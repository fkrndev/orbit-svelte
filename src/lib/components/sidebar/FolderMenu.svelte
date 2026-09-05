<script lang="ts">
  import type { FolderDecor } from '$shared/types'
  import { api } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { createFileIn, startNewFolder, startRename } from '@/actions'
  import { collapseAllIn, expandAll } from '@/sidebar'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import { copyPath, decorRequest, toggleBookmark, type DecorRequest } from './rowMenus'

  /** The folder row's context menu. See `FileMenuItems.svelte` for the file half. */
  let {
    path,
    name,
    decor,
    onDecor,
  }: {
    path: string
    name: string
    decor: FolderDecor | undefined
    onDecor: (request: DecorRequest) => void
  } = $props()

  const bookmarkId = $derived(getState().bookmarks.find(entry => entry.path === path)?.id ?? null)
</script>

<DropdownMenu.Item onSelect={() => void createFileIn(path)}>New file here</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => startNewFolder(path)}>New folder here…</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => startRename(path, 'folder')}>Rename…</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => void expandAll(path)}>Expand all</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => collapseAllIn(path)}>Collapse all</DropdownMenu.Item>
<DropdownMenu.Separator />
<DropdownMenu.Item onSelect={() => toggleBookmark('folder', path, bookmarkId)}>
  {bookmarkId ? 'Remove bookmark' : 'Bookmark folder'}
</DropdownMenu.Item>
<DropdownMenu.Item
  onSelect={() =>
    onDecor(decorRequest(path, 'folder', name, decor))}
>
  Icon &amp; colour…
</DropdownMenu.Item>
<DropdownMenu.Separator />
<DropdownMenu.Item onSelect={() => void api.revealInFinder({ path })}>
  Reveal in Finder
</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => void copyPath(path)}>Copy path</DropdownMenu.Item>
