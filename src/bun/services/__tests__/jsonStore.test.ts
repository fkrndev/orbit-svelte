import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonStore } from '../jsonStore'

interface Shape {
  version: 1
  items: string[]
}

const fallback = (): Shape => ({ version: 1, items: [] })

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mdlocal-store-'))
  file = join(dir, 'test.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('JsonStore', () => {
  it('starts from the fallback when no file exists', () => {
    const store = new JsonStore<Shape>(file, fallback)
    expect(store.get()).toEqual({ version: 1, items: [] })
  })

  it('reads an existing file', () => {
    writeFileSync(file, JSON.stringify({ version: 1, items: ['a'] }))
    expect(new JsonStore<Shape>(file, fallback).get().items).toEqual(['a'])
  })

  it('writes on flush and reloads what it wrote', () => {
    const store = new JsonStore<Shape>(file, fallback)
    store.update(draft => {
      draft.items.push('written')
    })
    store.flush()

    expect(JSON.parse(readFileSync(file, 'utf8')).items).toEqual(['written'])
    expect(new JsonStore<Shape>(file, fallback).get().items).toEqual(['written'])
  })

  it('does not rewrite when nothing changed', () => {
    writeFileSync(file, JSON.stringify({ version: 1, items: ['a'] }))
    const store = new JsonStore<Shape>(file, fallback)
    store.flush()
    // A no-op flush must not manufacture a backup — that would mean it wrote.
    expect(existsSync(`${file}.bak`)).toBe(false)
  })

  it('keeps a backup of the previous good file', () => {
    writeFileSync(file, JSON.stringify({ version: 1, items: ['old'] }))
    const store = new JsonStore<Shape>(file, fallback)
    store.update(draft => {
      draft.items = ['new']
    })
    store.flush()

    expect(JSON.parse(readFileSync(`${file}.bak`, 'utf8')).items).toEqual(['old'])
    expect(JSON.parse(readFileSync(file, 'utf8')).items).toEqual(['new'])
  })

  it('recovers from a corrupt file using the backup', () => {
    writeFileSync(`${file}.bak`, JSON.stringify({ version: 1, items: ['rescued'] }))
    writeFileSync(file, '{ this is not json')

    expect(new JsonStore<Shape>(file, fallback).get().items).toEqual(['rescued'])
  })

  it('quarantines a corrupt file rather than deleting it', () => {
    writeFileSync(file, '{ broken')
    new JsonStore<Shape>(file, fallback)

    const quarantined = readdirSync(dir).filter(name => name.includes('.corrupt-'))
    expect(quarantined).toHaveLength(1)
    expect(readFileSync(join(dir, quarantined[0]!), 'utf8')).toBe('{ broken')
  })

  it('falls back to defaults when both the file and its backup are corrupt', () => {
    writeFileSync(file, '{ broken')
    writeFileSync(`${file}.bak`, 'also broken')

    expect(new JsonStore<Shape>(file, fallback).get()).toEqual({ version: 1, items: [] })
  })

  it('debounces writes but flush forces them immediately', () => {
    const store = new JsonStore<Shape>(file, fallback, 10_000)
    store.update(draft => {
      draft.items.push('pending')
    })
    expect(existsSync(file)).toBe(false)

    store.flush()
    expect(JSON.parse(readFileSync(file, 'utf8')).items).toEqual(['pending'])
  })
})
