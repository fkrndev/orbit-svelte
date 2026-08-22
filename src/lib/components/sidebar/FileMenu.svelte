<script lang="ts">
  import { api } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { startDelete, startRename, updateMeta } from '@/actions'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import { baseName, copyPath, decorRequest, toggleBookmark, type DecorRequest, type MenuMeta } from './rowMenus'

  /**
   * The file row's context menu, shared by every panel so the same file offers
   * the same actions wherever it is listed.
   */
  let {
    path,
    meta,
    onDecor,
  }: { path: string; meta: MenuMeta | undefined; onDecor: (request: DecorRequest) => void } =
    $props()

  const bookmarkId = $derived(getState().bookmarks.find(entry => entry.path === path)?.id ?? null)
</script>

<DropdownMenu.Item onSelect={() => startRename(path)}>
  Rename…
  <DropdownMenu.Shortcut>⇧⌘R</DropdownMenu.Shortcut>
</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => void updateMeta(path, { pinned: !meta?.pinned })}>
  {meta?.pinned ? 'Unpin' : 'Pin'}
  <DropdownMenu.Shortcut>⌘D</DropdownMenu.Shortcut>
</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => toggleBookmark('file', path, bookmarkId)}>
  {bookmarkId ? 'Remove bookmark' : 'Bookmark'}
  <DropdownMenu.Shortcut>⇧⌘D</DropdownMenu.Shortcut>
</DropdownMenu.Item>
<DropdownMenu.Item
  onSelect={() =>
    onDecor(decorRequest(path, 'file', baseName(path), meta))}
>
  Icon &amp; colour…
</DropdownMenu.Item>
<DropdownMenu.Separator />
<DropdownMenu.Item onSelect={() => void api.revealInFinder({ path })}>
  Reveal in Finder
</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => void copyPath(path)}>Copy path</DropdownMenu.Item>
<DropdownMenu.Separator />
<DropdownMenu.Item variant="destructive" onSelect={() => startDelete(path)}>
  Move to Trash…
</DropdownMenu.Item>
