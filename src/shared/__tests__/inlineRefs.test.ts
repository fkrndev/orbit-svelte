import { describe, expect, it } from 'vitest'
import { scanFileRefs, scanRefsInText } from '../inlineRefs'

/**
 * The scanner decides two things at once: what gets *drawn* as a pill and what
 * gets *found* by a search. So a false positive here is not a cosmetic bug —
 * `you@example.com` becoming a mention puts a stranger's address in the sidebar
 * under everyone's mentions, and every note containing an email under it.
 */

const labels = (text: string) => scanRefsInText(text).map(ref => `${ref.kind}:${ref.label}`)

describe('what counts as a ref', () => {
  it('reads a tag and a mention out of ordinary prose', () => {
    expect(labels('kirim ke @budi soal #deploy hari ini')).toEqual(['mention:budi', 'tag:deploy'])
  })

  it('takes one at the very start of the text', () => {
    expect(labels('#draft, belum jadi')).toEqual(['tag:draft'])
    expect(labels('@budi tolong dicek')).toEqual(['mention:budi'])
  })

  it('keeps nested tags whole', () => {
    expect(labels('#work/admin/invoice')).toEqual(['tag:work/admin/invoice'])
  })

  it('keeps a dotted mention whole but leaves the full stop behind', () => {
    expect(labels('tanya @first.last.')).toEqual(['mention:first.last'])
  })

  it('drops the punctuation a sentence ends with', () => {
    expect(labels('sudah #done.')).toEqual(['tag:done'])
    expect(labels('lihat #plan-b, ya')).toEqual(['tag:plan-b'])
  })

  it('reports offsets that cover the sigil and the label', () => {
    const [ref] = scanRefsInText('ada #tag di sini')
    expect(ref).toMatchObject({ start: 4, end: 8 })
    expect('ada #tag di sini'.slice(ref!.start, ref!.end)).toBe('#tag')
  })

  it('keys `#Draft` and `#draft` alike while keeping each spelling for display', () => {
    const refs = scanRefsInText('#Draft lalu #draft lagi')
    expect(refs.map(ref => ref.key)).toEqual(['draft', 'draft'])
    expect(refs.map(ref => ref.label)).toEqual(['Draft', 'draft'])
  })
})

describe('what does not', () => {
  it('leaves email addresses alone', () => {
    expect(labels('kirim ke you@example.com sekarang')).toEqual([])
  })

  it('leaves URL fragments and link anchors alone', () => {
    expect(labels('lihat https://x.dev/docs#install')).toEqual([])
    expect(labels('lihat [bagian ini](../notes.md#section)')).toEqual([])
  })

  it('leaves headings alone', () => {
    expect(labels('# Judul')).toEqual([])
    expect(labels('### Sub judul')).toEqual([])
  })

  it('leaves a bare sigil and a trailing one alone', () => {
    expect(labels('bahasa C# itu')).toEqual([])
    expect(labels('# ')).toEqual([])
    expect(labels('harga naik 20 % @ toko')).toEqual([])
  })

  it('leaves numbers alone — `#1` is a position, not a tag', () => {
    expect(labels('juara #1 dan #2')).toEqual([])
    expect(labels('#404')).toEqual([])
  })
})

describe('scanning a whole file', () => {
  const file = [
    '---',
    'tags: [frontmatter-only]',
    '---',
    '',
    'Prosa dengan #satu dan @budi.',
    '',
    '```sh',
    '# bukan tag, ini komentar shell',
    'curl -H @file',
    '```',
    '',
    'Inline `#code` tidak dihitung, tapi #dua dihitung.',
  ].join('\n')

  it('skips fenced code, code spans, and the frontmatter', () => {
    expect(scanFileRefs(file).map(ref => ref.label)).toEqual(['satu', 'budi', 'dua'])
  })

  it('reports file lines, not body lines, so a hit can be jumped to', () => {
    const [first] = scanFileRefs(file)
    expect(first?.line).toBe(4)
    expect(file.split('\n')[first!.line]).toContain('#satu')
  })

  it('does not let an unclosed fence swallow the rest of the file', () => {
    expect(scanFileRefs('```\n#nope\n').map(ref => ref.label)).toEqual([])
  })
})
