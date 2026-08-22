import type { Heading } from '$shared/outline'

/**
 * Both editors answer the same event, each in its own terms: the rich editor
 * counts heading nodes, the raw editor counts lines. Keeping the subscription
 * here means the table of contents never has to know which one is mounted.
 *
 * Returns its own teardown, so the caller is an `$effect` and nothing else.
 */
export function onGotoHeading(handler: (heading: Heading) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<Heading>).detail)
  window.addEventListener('app:goto-heading', listener)
  return () => window.removeEventListener('app:goto-heading', listener)
}
