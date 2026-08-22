import { describe, expect, it } from 'vitest'
import {
  countCharacters,
  countParagraphs,
  countWords,
  formatBytes,
  readingTime,
} from '../format'

describe('countWords', () => {
  it('counts prose', () => {
    expect(countWords('one two three')).toBe(3)
  })

  it('ignores markup that stands alone', () => {
    // The heading marker, the bullet, and the quote arrow are not words.
    expect(countWords('## Title\n\n- item\n\n> quoted')).toBe(3)
  })

  it('counts an emphasised word once', () => {
    expect(countWords('**bold** and _italic_')).toBe(3)
  })

  it('survives ragged whitespace', () => {
    expect(countWords('  \n\n  one\t\ttwo   \n')).toBe(2)
  })

  it('is zero for an empty document', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('\n\n   \n')).toBe(0)
  })

  it('counts words in any script', () => {
    expect(countWords('halo dunia 世界 ١٢٣')).toBe(4)
  })
})

describe('countCharacters', () => {
  it('counts every character between the first and the last', () => {
    expect(countCharacters('one two')).toBe(7)
  })

  it('ignores the whitespace a file ends with', () => {
    // A trailing newline is a file convention, not something the author typed.
    expect(countCharacters('\n  one two  \n\n')).toBe(7)
  })

  it('counts an astral character once', () => {
    expect(countCharacters('a🌍b')).toBe(3)
  })

  it('is zero for an empty document', () => {
    expect(countCharacters('')).toBe(0)
    expect(countCharacters('\n\n   \n')).toBe(0)
  })
})

describe('countParagraphs', () => {
  it('counts blocks separated by a blank line', () => {
    expect(countParagraphs('First one.\n\nSecond one.')).toBe(2)
  })

  it('keeps a wrapped block as one paragraph', () => {
    expect(countParagraphs('First\nstill first.\n\nSecond.')).toBe(2)
  })

  it('counts a list as the single block it is', () => {
    expect(countParagraphs('- one\n- two\n- three')).toBe(1)
  })

  it('does not count blocks that are only punctuation', () => {
    expect(countParagraphs('Text.\n\n---\n\nMore text.')).toBe(2)
  })

  it('survives ragged blank lines', () => {
    expect(countParagraphs('\n\nOne.\n  \n\n  \nTwo.\n\n')).toBe(2)
  })

  it('is zero for an empty document', () => {
    expect(countParagraphs('')).toBe(0)
    expect(countParagraphs('\n\n   \n')).toBe(0)
  })
})

describe('readingTime', () => {
  it.each([
    [0, '—'],
    // Anything at all takes a moment, so we never print "0m".
    [1, '1m'],
    [200, '1m'],
    [378, '2m'],
    [12_000, '1h'],
    [13_000, '1h 5m'],
  ])('%i words → %s', (words, expected) => {
    expect(readingTime(words)).toBe(expected)
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [3400, '3.3 KB'],
    // Three digits is the ceiling, so the decimal is dropped rather than
    // printing "102.4 KB".
    [104_857, '102 KB'],
    [5_242_880, '5.0 MB'],
  ])('%i → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})
