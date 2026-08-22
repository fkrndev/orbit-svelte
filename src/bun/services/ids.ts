import { randomUUID } from 'node:crypto'

/**
 * Prefixed ids (`f_`, `r_`) so a stray id in a log or a JSON dump is
 * self-describing.
 */
export function newId(prefix: 'f' | 'r'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 22)}`
}
