import { describe, expect, it } from 'vitest'
import {
  countCharacters,
  countLines,
  countParagraphs,
  countWords,
  detectIndent,
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

describe('countLines', () => {
  it('counts the way wc -l does', () => {
    // A trailing newline terminates the last line rather than starting an empty
    // one — otherwise every well-formed file reads one line longer than it is.
    // The gutter says one more, because a cursor can sit past that newline.
    expect(countLines('a\nb\nc\n')).toBe(3)
    expect(countLines('a\nb\nc')).toBe(3)
  })

  it('counts a genuinely blank last line', () => {
    expect(countLines('a\n\n')).toBe(2)
  })

  it('has nothing to count in an empty file', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('one line')).toBe(1)
  })
})

describe('detectIndent', () => {
  it('reports one step, not the deepest nesting', () => {
    // A file indented in twos is full of four- and six-space lines; taking the
    // most common one would answer a different question.
    expect(detectIndent('def f():\n  if x:\n    return 1\n')).toBe('2 spaces')
    expect(detectIndent('function f() {\n    return 1\n}\n')).toBe('4 spaces')
  })

  it('lets a tab win outright', () => {
    // Mixed files exist; the tab is the one that changes what the Tab key does.
    expect(detectIndent('a\n  b\n\tc\n')).toBe('Tabs')
  })

  it('says nothing about a file with no indentation', () => {
    expect(detectIndent('a\nb\n')).toBe('—')
    expect(detectIndent('')).toBe('—')
  })

  it('ignores a blank line made of spaces', () => {
    // Trailing whitespace on an empty line is not an indent step, and treating
    // it as one would report "1 space" for most real files.
    expect(detectIndent('a\n \n    b\n')).toBe('4 spaces')
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
