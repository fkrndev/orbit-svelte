<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import Pilcrow from '@lucide/svelte/icons/pilcrow'
  import Plus from '@lucide/svelte/icons/plus'
  import { commands, type EdraCommand } from '@/components/edra/commands/index'
  import { getEditor, useEditorTransaction } from '@/components/edra/tiptap/index'
  import Colors from '@/components/edra/shadcn/components/tools/Colors.svelte'
  import Export from '@/components/edra/shadcn/components/tools/Export.svelte'
  import { Button } from '@/components/ui/button'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import Tooltip from '@/components/Tooltip.svelte'

  /**
   * The formatting bar — ours, over Edra's command registry.
   *
   * Edra's own `Toolbar` renders every command in every group as a flat row of
   * icons: thirty-four buttons, which overran the window and left the last third
   * of them behind a horizontal scroll. A control you have to scroll sideways to
   * reach is not faster than the menu it was meant to replace.
   *
   * So the row is folded. What stays visible is what you press *mid-sentence* —
   * undo, the five inline marks, a link. Everything whose options are mutually
   * exclusive becomes one control that also *reports* the current state: the
   * block type reads "Heading 2" rather than leaving you to work it out from
   * which of four icons is tinted. Everything you do once per document —
   * inserting a table, an image, a diagram — is one click deeper, because it is
   * one click per document.
   *
   * Nothing is dropped. Every command Edra ships is still reachable here, and
   * still reachable from the slash menu and the keyboard besides.
   *
   * The commands themselves are *not* restated. They are looked up by name out
   * of Edra's registry, so their icons, shortcuts, `isActive` and `clickable`
   * remain Edra's to change — this file only decides where each one is drawn.
   */

  const editor = getEditor()

  // Every command in the registry, flattened, so a group here can be assembled
  // from names regardless of which group Edra filed each one under. Edra's
  // grouping is by kind (`headings`, `lists`); this bar groups by how often a
  // thing is reached for, which cuts across that.
  const BY_NAME = new Map<string, EdraCommand>(
    Object.values(commands)
      .flat()
      .map(command => [command.name, command]),
  )

  function pick(...names: string[]): EdraCommand[] {
    return names.map(name => BY_NAME.get(name)).filter((c): c is EdraCommand => c !== undefined)
  }

  /** Kept on the bar: the marks you apply without stopping to think. */
  const INLINE = pick('bold', 'italic', 'underline', 'strikethrough', 'code', 'link')

  /**
   * One control for what the current block *is*.
   *
   * A block is exactly one of these at a time, which is the test for whether a
   * group belongs in a menu rather than on the bar: four heading icons where
   * only one can be lit spend four slots saying what a single label says
   * better. Separators mark the three families — plain text, lists, and the two
   * blocks that box their contents.
   */
  const BLOCK_TYPE: Array<EdraCommand[]> = [
    pick('paragraph', 'h1', 'h2', 'h3', 'h4'),
    pick('bulletList', 'orderedList', 'taskList'),
    pick('blockQuote', 'codeBlock'),
  ]

  /**
   * Most specific first, and this order is the whole reason the label is right.
   *
   * A paragraph inside a task list reports itself as *both* `taskList` and
   * `paragraph`, so a naive scan in menu order would label every list item
   * "Paragraph". The trigger has to name the outermost thing the cursor is in.
   */
  const BLOCK_LABEL_ORDER = pick(
    'codeBlock',
    'taskList',
    'bulletList',
    'orderedList',
    'blockQuote',
    'h1',
    'h2',
    'h3',
    'h4',
    'paragraph',
  )

  const ALIGN = pick('align-left', 'align-center', 'align-right', 'align-justify')

  /**
   * Things you put *into* a document rather than apply *to* it, and the reason
   * they are all one menu: every one of them is a once-per-document action, so
   * the click that opens the menu is amortised over a whole note.
   */
  const INSERT = pick(
    'image-placeholder',
    'video-placeholder',
    'audio-placeholder',
    'iframe-placeholder',
    'table',
    'mathematics',
    'blockMathematics',
    'mermaid',
  )

  /**
   * The tail of Edra's format list. Two marks today — but they are the two
   * nobody uses in a notes app, and this is where the next rare one goes
   * instead of onto the bar.
   */
  const MORE = pick('superscript', 'subscript')

  /*
   * Edra's own reactivity hook: `isActive` and `clickable` read the editor
   * imperatively, so nothing about them is a rune. Touching `version` inside
   * each of these makes the call a dependency of the render, and the hook bumps
   * it on every transaction.
   */
  const transaction = useEditorTransaction(editor)

  function isActive(command: EdraCommand): boolean {
    void transaction.version
    return command.isActive?.(editor) ?? false
  }

  function isClickable(command: EdraCommand): boolean {
    void transaction.version
    return command.clickable?.(editor) ?? true
  }

  /** Whether a menu should read as "on" — the group has an active member. */
  function groupActive(group: EdraCommand[]): boolean {
    return group.some(isActive)
  }

  const blockType = $derived.by(() => {
    void transaction.version
    return BLOCK_LABEL_ORDER.find(command => command.isActive?.(editor)) ?? null
  })

  const alignment = $derived.by(() => {
    void transaction.version
    return ALIGN.find(command => command.isActive?.(editor)) ?? ALIGN[0]
  })

  const undo = BY_NAME.get('undo')
  const redo = BY_NAME.get('redo')
</script>

{#snippet iconButton(command: EdraCommand)}
  {@const Icon = command.icon}
  <Tooltip label={command.tooltip} shortcut={command.shortCut || undefined}>
    <Button
      variant="ghost"
      size="icon"
      aria-label={command.tooltip}
      aria-pressed={isActive(command)}
      disabled={!isClickable(command)}
      class={isActive(command) ? 'bg-muted text-primary' : ''}
      onclick={() => command.onClick?.(editor)}
    >
      <Icon />
    </Button>
  </Tooltip>
{/snippet}

<!--
  A menu row. `onSelect` rather than `onclick` so the keyboard reaches it, and
  the tick is drawn as a highlight on the row rather than a check column — a
  check column beside ten items is a lot of empty gutter for the nine that are
  off.
-->
{#snippet menuItem(command: EdraCommand)}
  {@const Icon = command.icon}
  <DropdownMenu.Item
    disabled={!isClickable(command)}
    class={isActive(command) ? 'bg-muted text-primary' : ''}
    onSelect={() => command.onClick?.(editor)}
  >
    <Icon />
    {command.tooltip}
    {#if command.shortCut}
      <DropdownMenu.Shortcut>{command.shortCut}</DropdownMenu.Shortcut>
    {/if}
  </DropdownMenu.Item>
{/snippet}

<div class="flex h-full w-fit items-center gap-0.5">
  {#if undo}{@render iconButton(undo)}{/if}
  {#if redo}{@render iconButton(redo)}{/if}

  <div class="mx-1 h-5 w-px shrink-0" style="background: var(--border)"></div>

  <!--
    The one control with a word on it. Every other trigger here is an icon, but
    "which block is this" is the question the bar is asked most often and the
    only one an icon answers ambiguously — a lit H2 and a lit H3 are the same
    glyph at a glance.
  -->
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="ghost" size="sm" class="gap-1 px-2 font-normal">
          {#if blockType}
            {@const Icon = blockType.icon}
            <Icon />
            <span class="max-w-28 truncate">{blockType.tooltip}</span>
          {:else}
            <Pilcrow />
            <span>Text</span>
          {/if}
          <ChevronDown class="opacity-60" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="min-w-48">
      {#each BLOCK_TYPE as group, index (index)}
        {#if index > 0}<DropdownMenu.Separator />{/if}
        {#each group as command (command.name)}
          {@render menuItem(command)}
        {/each}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <div class="mx-1 h-5 w-px shrink-0" style="background: var(--border)"></div>

  {#each INLINE as command (command.name)}
    {@render iconButton(command)}
  {/each}

  <!-- Edra's own tools, both already menus. -->
  <Colors />

  <div class="mx-1 h-5 w-px shrink-0" style="background: var(--border)"></div>

  <!--
    Alignment shows the *current* alignment rather than a fixed glyph, so the
    folded control still answers the question the four icons used to.
  -->
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        {@const Icon = alignment.icon}
        <Tooltip label="Alignment">
          <Button
            {...props}
            variant="ghost"
            size="sm"
            aria-label="Alignment"
            class="gap-0.5 px-1.5"
          >
            <Icon />
            <ChevronDown class="opacity-60" />
          </Button>
        </Tooltip>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="min-w-44">
      {#each ALIGN as command (command.name)}
        {@render menuItem(command)}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Tooltip label="Insert">
          <Button {...props} variant="ghost" size="sm" aria-label="Insert" class="gap-0.5 px-1.5">
            <Plus />
            <ChevronDown class="opacity-60" />
          </Button>
        </Tooltip>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="min-w-52">
      {#each INSERT as command (command.name)}
        {@render menuItem(command)}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  {#if MORE.length > 0}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Tooltip label="More formatting">
            <Button
              {...props}
              variant="ghost"
              size="icon"
              aria-label="More formatting"
              class={groupActive(MORE) ? 'bg-muted text-primary' : ''}
            >
              <!--
                The dots rather than a bare chevron. A chevron on its own reads
                as the tail of the button beside it, which is exactly how it
                looked next to Insert's — and it is the same glyph the title
                bar's overflow menu uses, so the two mean one thing.
              -->
              <Ellipsis />
            </Button>
          </Tooltip>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="min-w-44">
        {#each MORE as command (command.name)}
          {@render menuItem(command)}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}

  <div class="mx-1 h-5 w-px shrink-0" style="background: var(--border)"></div>

  <Export />
</div>
