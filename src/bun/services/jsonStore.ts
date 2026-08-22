import { existsSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs'

/**
 * A debounced, crash-tolerant JSON file.
 *
 * Durability rules, in order of importance:
 *  1. Never lose good data to a bad write — write to a temp file, then rename
 *     (atomic on POSIX), so a crash mid-write leaves the previous file intact.
 *  2. Never lose good data to a bad read — keep a `.bak` of the last file that
 *     parsed successfully.
 *  3. Never delete something we failed to understand — a file that won't parse
 *     is moved aside as `.corrupt-<ts>` so it can be inspected, not discarded.
 */
export class JsonStore<T extends object> {
  private data: T
  private dirty = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly path: string,
    private readonly fallback: () => T,
    private readonly debounceMs = 500,
  ) {
    this.data = this.load()
  }

  private load(): T {
    const attempts: Array<{ file: string; isBackup: boolean }> = [
      { file: this.path, isBackup: false },
      { file: `${this.path}.bak`, isBackup: true },
    ]

    for (const { file, isBackup } of attempts) {
      if (!existsSync(file)) continue
      try {
        return JSON.parse(readFileSync(file, 'utf8')) as T
      } catch (err) {
        console.error(`[store] ${file} failed to parse:`, err)
        if (!isBackup) this.quarantine(file)
      }
    }

    return this.fallback()
  }

  private quarantine(file: string) {
    try {
      renameSync(file, `${file}.corrupt-${Date.now()}`)
    } catch (err) {
      console.error(`[store] could not quarantine ${file}:`, err)
    }
  }

  get(): T {
    return this.data
  }

  /** Mutate in place, then schedule a write. */
  update(mutate: (draft: T) => void): T {
    mutate(this.data)
    this.markDirty()
    return this.data
  }

  replace(next: T) {
    this.data = next
    this.markDirty()
  }

  private markDirty() {
    this.dirty = true
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, this.debounceMs)
  }

  /** Write now. Called on a debounce timer and again on app shutdown. */
  flush() {
    if (!this.dirty) return
    const tmp = `${this.path}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
      if (existsSync(this.path)) {
        try {
          writeFileSync(`${this.path}.bak`, readFileSync(this.path))
        } catch (err) {
          // A missing backup is survivable; a failed primary write is not.
          console.error('[store] backup failed:', err)
        }
      }
      renameSync(tmp, this.path)
      this.dirty = false
    } catch (err) {
      console.error(`[store] write failed for ${this.path}:`, err)
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        // Nothing more we can do; the previous file is still valid.
      }
    }
  }
}

const registry: Array<JsonStore<object>> = []

export function registerStore<T extends object>(store: JsonStore<T>): JsonStore<T> {
  registry.push(store as unknown as JsonStore<object>)
  return store
}

/** Flush every store. Wired to app shutdown so a debounce window can't eat data. */
export function flushAllStores() {
  for (const store of registry) store.flush()
}
