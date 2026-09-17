import { beforeEach, describe, expect, it } from 'vitest'
import { onRowKey } from '../rowKeys'
import { getState, setState } from '@/store.svelte'

/**
 * The part worth pinning down is the seam between the filter box and the rows:
 * the caret has to stay where the typing goes while the highlight moves, which
 * is exactly the thing that looked broken when the arrows moved focus instead.
 */
function panel() {
  document.body.innerHTML = `
    <div id="column">
      <input />
      <div data-row-path="/notes/a.md"><button type="button">a</button></div>
      <div data-row-path="/notes/b.md"><button type="button">b</button></div>
      <div data-row-path="/notes/c.md"><button type="button">c</button></div>
    </div>
  `
  const column = document.getElementById('column')!
  column.addEventListener('keydown', onRowKey as EventListener)
  const input = column.querySelector('input')!
  const [a, b, c] = [...column.querySelectorAll('button')]
  return { input, a: a!, b: b!, c: c! }
}

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

const highlight = () => getState().sidebar.highlight

// jsdom has no layout, so it has no scrolling either.
Element.prototype.scrollIntoView = () => {}

beforeEach(() => {
  setState(prev => ({ sidebar: { ...prev.sidebar, highlight: null } }))
})

describe('onRowKey, from the filter box', () => {
  it('moves the highlight without taking the caret out of the box', () => {
    const { input } = panel()
    input.focus()

    press(input, 'ArrowDown')
    expect(highlight()).toBe('/notes/a.md')
    expect(document.activeElement).toBe(input)

    press(input, 'ArrowDown')
    expect(highlight()).toBe('/notes/b.md')
    expect(document.activeElement).toBe(input)

    press(input, 'ArrowUp')
    expect(highlight()).toBe('/notes/a.md')
  })

  it('stops at both ends rather than wrapping', () => {
    const { input } = panel()
    press(input, 'ArrowUp')
    expect(highlight()).toBe('/notes/c.md')
    press(input, 'ArrowDown')
    expect(highlight()).toBe('/notes/c.md')

    setState(prev => ({ sidebar: { ...prev.sidebar, highlight: '/notes/a.md' } }))
    press(input, 'ArrowUp')
    expect(highlight()).toBe('/notes/a.md')
  })

  it('opens the highlighted row on Enter, and the top one when nothing is highlighted', () => {
    const { input, a, b } = panel()
    let opened = ''
    a.addEventListener('click', () => (opened = 'a'))
    b.addEventListener('click', () => (opened = 'b'))

    press(input, 'Enter')
    expect(opened).toBe('a')

    press(input, 'ArrowDown')
    press(input, 'ArrowDown')
    press(input, 'Enter')
    expect(opened).toBe('b')
  })

  it('leaves an empty list alone', () => {
    const { input } = panel()
    document.querySelectorAll('[data-row-path]').forEach(row => row.remove())
    press(input, 'ArrowDown')
    expect(highlight()).toBe(null)
  })
})

describe('onRowKey, inside the list', () => {
  it('moves focus row to row and hands the caret back above the first', () => {
    const { input, a, b } = panel()
    a.focus()

    press(a, 'ArrowDown')
    expect(document.activeElement).toBe(b)

    press(b, 'ArrowUp')
    expect(document.activeElement).toBe(a)

    press(a, 'ArrowUp')
    expect(document.activeElement).toBe(input)
  })
})
