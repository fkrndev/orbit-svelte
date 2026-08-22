<script lang="ts">
  import type { DirEntry, FileMeta, TreeFilterResult } from '$shared/types'
  import { api, onFileChange } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { loadFolderDecor } from '@/sidebar'
  import { isExpanded } from '@/tree'
  import FolderRow from './FolderRow.svelte'
  import FileRow from './FileRow.svelte'
  import Self from './DirNode.svelte'
  import type { DecorRequest } from './rowMenus'

  let {
    path,
    depth,
    filter,
    onDecor,
  }: {
    path: string
    depth: number
    filter: TreeFilterResult | null
    onDecor: (request: DecorRequest) => void
  } = $props()

  let entries = $state<DirEntry[] | null>(null)
  let metas = $state<Record<string, FileMeta | undefined>>({})

  /**
   * Reloads overlap: one rename produces a burst of file events, so several
   * `listDir` calls are in flight at once and they can resolve out of order.
   * Without this counter the *older* answer sometimes lands last and the folder
   * redraws under its previous name, with no further event coming to correct it.
   */
  let latest = 0

  function load() {
    const token = (latest += 1)
    api
      .listDir({ path })
      .then(async next => {
        if (token !== latest) return
        entries = next
        void loadFolderDecor(next.filter(entry => entry.isDirectory).map(entry => entry.path))
        // One batched metadata read per directory rather than one per row — a
        // folder with 200 notes would otherwise fire 200 RPC calls.
        const files = next.filter(entry => !entry.isDirectory).map(entry => entry.path)
        if (files.length === 0) return
        try {
          const metaByPath = await api.getMetaMany({ paths: files })
          if (token === latest) metas = metaByPath
        } catch {
          // Swatches are decoration; the tree is still fully usable without them.
        }
      })
      .catch(() => {
        if (token === latest) entries = []
      })
  }

  $effect(() => {
    // `path` is the dependency; the reload machinery below is not.
    void path
    load()
  })

  // Keep the tree honest when files appear or vanish underneath it.
  $effect(() =>
    onFileChange(event => {
      if (event.path.startsWith(`${path}/`)) load()
    }),
  )

  // Icon, colour, and pin all live in metadata this node already fetched, so a
  // change made anywhere else has to tell it to read again.
  $effect(() => {
    const onMeta = (event: Event) => {
      const changed = (event as CustomEvent<string>).detail
      if (typeof changed === 'string' && changed.startsWith(`${path}/`)) load()
    }
    window.addEventListener('app:meta-changed', onMeta)
    return () => window.removeEventListener('app:meta-changed', onMeta)
  })

  // A rename the app performed itself, which must not wait on the push channel
  // to be drawn — see `notifyDirChanged`.
  $effect(() => {
    const onDir = (event: Event) => {
      const changed = (event as CustomEvent<string>).detail
      if (typeof changed !== 'string') return
      if (changed === path || changed.startsWith(`${path}/`)) load()
    }
    window.addEventListener('app:dir-changed', onDir)
    return () => window.removeEventListener('app:dir-changed', onDir)
  })

  const tree = $derived(getState().tree)
  const activePath = $derived(getState().activePath)

  const matched = $derived(filter ? new Set(filter.files) : null)
  const openDirs = $derived(filter ? new Set(filter.dirs) : null)

  const visible = $derived(
    (entries ?? []).filter(entry =>
      !filter ? true : entry.isDirectory ? openDirs!.has(entry.path) : matched!.has(entry.path),
    ),
  )
</script>

{#if entries}
  <div>
    {#each visible as entry (entry.path)}
      {@const indent = 8 + depth * 11}
      {#if entry.isDirectory}
        {@const open = filter ? true : isExpanded(tree, entry.path)}
        <div>
          <FolderRow {entry} {indent} {open} locked={Boolean(filter)} {onDecor} />
          {#if open}
            <Self path={entry.path} depth={depth + 1} {filter} {onDecor} />
          {/if}
        </div>
      {:else}
        <FileRow
          {entry}
          indent={indent + 12}
          active={entry.path === activePath}
          meta={metas[entry.path]}
          {onDecor}
        />
      {/if}
    {/each}
  </div>
{/if}
