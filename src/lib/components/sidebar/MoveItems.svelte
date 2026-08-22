<script lang="ts">
  import type { BookmarkView } from '$shared/types'
  import { moveBookmark } from '@/sidebar'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'

  /**
   * Reordering is Move up / Move down rather than drag and drop.
   *
   * A list this short is usually rearranged once and then left alone, and the
   * menu costs no dependency and works from the keyboard.
   */
  let { entry }: { entry: BookmarkView } = $props()
</script>

<DropdownMenu.Item
  onSelect={() => void moveBookmark(entry.id, entry.groupId, entry.order - 1)}
  disabled={entry.order === 0}
>
  Move up
</DropdownMenu.Item>
<DropdownMenu.Item onSelect={() => void moveBookmark(entry.id, entry.groupId, entry.order + 1)}>
  Move down
</DropdownMenu.Item>
