import { describe, expect, it } from 'vitest'
import { onRowKey } from '../rowKeys'

/**
 * The part worth pinning down is the seam between the filter box and the rows:
 * a wrong selector here leaves the search reachable only by mouse, which is the
 * bug this handler exists to fix.
 */
function panel() {
  document.body.innerHTML = `
    <div id="column">
      <input />
      <div data-row-path="/notes/a.md"><button type="button">a</button></div>
      <div data-row-path="/notes/b.md"><button type="button">b</button></div>
    </div>
  `
  const column = document.getElementById('column')!
  column.addEventListener('keydown', onRowKey as EventListener)
  const input = column.querySelector('input')!
  const [a, b] = [...column.querySelectorAll('button')]
  return { input, a: a!, b: b! }
}

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('onRowKey', () => {
  it('steps from the filter box onto the first result', () => {
    const { input, a } = panel()
    input.focus()
    press(input, 'ArrowDown')
    expect(document.activeElement).toBe(a)
  })

  it('opens the first result on Enter in the filter box', () => {
    const { input, a } = panel()
    let opened = 0
    a.addEventListener('click', () => (opened += 1))
    press(input, 'Enter')
    expect(opened).toBe(1)
  })

  it('moves between rows and hands the caret back above the first', () => {
    const { input, a, b } = panel()
    a.focus()
    press(a, 'ArrowDown')
    expect(document.activeElement).toBe(b)
    press(b, 'ArrowUp')
    expect(document.activeElement).toBe(a)
    press(a, 'ArrowUp')
    expect(document.activeElement).toBe(input)
  })

  it('leaves an empty list alone', () => {
    const { input } = panel()
    document.querySelectorAll('[data-row-path]').forEach(row => row.remove())
    input.focus()
    press(input, 'ArrowDown')
    expect(document.activeElement).toBe(input)
  })
})
