import { describe, expect, it } from 'vitest'
import { centerMermaidNodeLabels, normalizeTimelinePeriodLabelsForRender } from '../mermaidRender'

describe('normalizeTimelinePeriodLabelsForRender', () => {
  it('escapes clock colons in timeline period labels', () => {
    const diagram = ['timeline', '    title Dayflow', '    08:00 : Wake up', '    09:30 : Focus'].join('\n')

    expect(normalizeTimelinePeriodLabelsForRender(diagram)).toBe(
      ['timeline', '    title Dayflow', '    08&#58;00 : Wake up', '    09&#58;30 : Focus'].join('\n'),
    )
  })

  it('leaves titles, sections, comments and blank lines alone', () => {
    const diagram = [
      'timeline',
      '',
      '%% 12:00 comment',
      '    title A 10:00 title',
      '    section Morning: block',
      '    08:00 : Wake up',
    ].join('\n')

    const normalized = normalizeTimelinePeriodLabelsForRender(diagram).split('\n')

    expect(normalized[2]).toBe('%% 12:00 comment')
    expect(normalized[3]).toBe('    title A 10:00 title')
    expect(normalized[4]).toBe('    section Morning: block')
    expect(normalized[5]).toBe('    08&#58;00 : Wake up')
  })

  it('leaves period labels without colons untouched', () => {
    const diagram = ['timeline', '    Morning : Wake up'].join('\n')

    expect(normalizeTimelinePeriodLabelsForRender(diagram)).toBe(diagram)
  })

  it('does not touch other diagram types', () => {
    const diagram = ['flowchart LR', '    A["08:00 start"] --> B'].join('\n')

    expect(normalizeTimelinePeriodLabelsForRender(diagram)).toBe(diagram)
  })
})

describe('centerMermaidNodeLabels', () => {
  it('anchors node labels and their rows to the middle', () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">',
      '<g class="node default"><g class="label"><text y="-10">',
      '<tspan class="row" x="0">DB Type</tspan>',
      '<tspan class="row" x="0">rows</tspan>',
      '</text></g></g>',
      '</svg>',
    ].join('')

    const centered = centerMermaidNodeLabels(svg)
    const parsed = new DOMParser().parseFromString(centered, 'image/svg+xml')

    expect(parsed.querySelector('text')?.getAttribute('text-anchor')).toBe('middle')
    expect(
      Array.from(parsed.querySelectorAll('tspan'), row => row.getAttribute('text-anchor')),
    ).toEqual(['middle', 'middle'])
  })

  it('returns the original markup when the SVG cannot be parsed', () => {
    const broken = '<svg><g class="node"><text>unclosed'

    expect(centerMermaidNodeLabels(broken)).toBe(broken)
  })
})
