<script lang="ts">
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import { CalendarDate, type DateValue as InternationalizedDate } from '@internationalized/date'
  import { parseDateValue, toISODateString } from '$shared/propertyTypes'
  import { formatDate, type DateFormat } from '$shared/propertySchema'
  import { Button } from '@/components/ui/button'
  import { Calendar } from '@/components/ui/calendar'
  import * as Popover from '@/components/ui/popover'

  /**
   * A date property, edited in a calendar rather than a text box.
   *
   * The native `<input type="date">` this replaces looked like nothing else in
   * the app: a platform widget with its own font, its own segmented cursor, and a
   * picker the theme has no say over. It also demanded the ISO format back — the
   * one thing a person editing a note should never have to type.
   *
   * shadcn-svelte's calendar speaks `@internationalized/date` rather than the
   * `Date` the React one took, so the conversion sits here — and only here. The
   * *file* still holds a plain ISO string, which is what `toISODateString`
   * guarantees: nothing about the picker leaks into the note.
   */
  let {
    value,
    onChange,
    /**
     * How the day reads. Presentation only — the file always holds ISO, so
     * switching formats never rewrites a byte.
     */
    format = 'long',
    /** `row` sits inline in the properties list; `field` is a bordered control. */
    trigger = 'row',
    placeholder = '—',
  }: {
    value: string
    onChange: (value: string) => void
    format?: DateFormat
    trigger?: 'row' | 'field'
    placeholder?: string
  } = $props()

  let open = $state(false)

  const selected = $derived.by(() => {
    const day = parseDateValue(value)
    if (!day) return undefined
    return new CalendarDate(day.getFullYear(), day.getMonth() + 1, day.getDate())
  })

  const shown = $derived(value ? formatDate(value, format) : placeholder)

  function pick(day: InternationalizedDate | undefined) {
    open = false
    onChange(day ? toISODateString(new Date(day.year, day.month - 1, day.day)) : '')
  }
</script>

<Popover.Root bind:open>
  {#if trigger === 'field'}
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          size="sm"
          class="h-7 w-full justify-start px-2 text-[12px] font-normal"
        >
          <CalendarIcon size={16} strokeWidth={2} class="opacity-70" />
          <span class={value ? '' : 'text-muted-foreground'}>{shown}</span>
        </Button>
      {/snippet}
    </Popover.Trigger>
  {:else}
    <Popover.Trigger
      class="block w-full truncate rounded px-0.5 pt-[3px] text-left text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
      style="color: {value ? 'var(--text)' : 'var(--text-faint)'}"
      title={value ? shown : 'Click to set'}
    >
      {shown}
    </Popover.Trigger>
  {/if}
  <Popover.Content align="start" class="w-auto p-0">
    <Calendar
      type="single"
      value={selected}
      onValueChange={day => pick(day ?? undefined)}
    />
    {#if value}
      <div class="border-t p-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-6 w-full justify-center text-[11px]"
          onclick={() => pick(undefined)}
        >
          Clear
        </Button>
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
