type MermaidApi = (typeof import('mermaid'))['default']

let initialized = false
let renderQueue = Promise.resolve()

const TIMELINE_HEADER_PATTERN = /^\s*timeline(?:\s+(?:LR|TD))?\b/iu
const TIMELINE_PERIOD_DELIMITER_PATTERN = /^(\s*)(.*?)(:\s+.*)$/u
const TIMELINE_NON_PERIOD_LINE_PATTERN =
  /^\s*(?:$|%%|#|title\b|section\b|accTitle\s*:|accDescr\s*:|accDescr\s*\{|\})/iu

/**
 * Gantt and timeline diagrams size themselves from the container they render into.
 * A zero-width host collapses them, so the offscreen host has to carry a real width.
 */
const MERMAID_RENDER_HOST_STYLE = [
  'position:absolute',
  'left:-10000px',
  'top:-10000px',
  'width:960px',
  'min-height:1px',
  'overflow:hidden',
].join(';')

function initializeMermaid(mermaid: MermaidApi): void {
  if (initialized) return

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    // WebKit lays out foreignObject labels inconsistently, so labels stay as SVG text.
    htmlLabels: false,
    theme: 'neutral',
    suppressErrorRendering: true,
  })
  initialized = true
}

function isTimelineDiagram(diagram: string): boolean {
  const firstStatement = diagram
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(line => line.length > 0 && !line.startsWith('%%'))

  return typeof firstStatement === 'string' && TIMELINE_HEADER_PATTERN.test(firstStatement)
}

function encodeTimelinePeriodLabelColons(line: string): string {
  if (TIMELINE_NON_PERIOD_LINE_PATTERN.test(line)) return line

  const match = TIMELINE_PERIOD_DELIMITER_PATTERN.exec(line)
  if (!match) return line

  const [, indent, periodLabel, rest] = match
  if (!periodLabel.trim().includes(':')) return line

  // Mermaid timeline uses ":" as a field separator, so clock labels need entity colons.
  return `${indent}${periodLabel.replaceAll(':', '&#58;')}${rest}`
}

export function normalizeTimelinePeriodLabelsForRender(diagram: string): string {
  if (!isTimelineDiagram(diagram)) return diagram

  return diagram.split('\n').map(encodeTimelinePeriodLabelColons).join('\n')
}

function hasSvgParseError(parsed: Document): boolean {
  return parsed.getElementsByTagName('parsererror').length > 0
}

/** WebKit ignores Mermaid's implicit label centering, so the anchors are made explicit. */
export function centerMermaidNodeLabels(svg: string): string {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (hasSvgParseError(parsed)) return svg

  parsed.querySelectorAll('.node .label text, .node text').forEach(label => {
    label.setAttribute('text-anchor', 'middle')
    label.querySelectorAll('tspan').forEach(row => {
      row.setAttribute('text-anchor', 'middle')
    })
  })

  return new XMLSerializer().serializeToString(parsed.documentElement)
}

function appendMermaidRenderHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.setAttribute('data-mermaid-render-host', '')
  host.style.cssText = MERMAID_RENDER_HOST_STYLE
  document.body.appendChild(host)
  return host
}

/** A failed render leaves its scratch nodes behind, so they are swept on every attempt. */
function removeMermaidRenderArtifacts(renderId: string, host: HTMLElement): void {
  host.remove()
  document.getElementById(renderId)?.remove()
  document.getElementById(`d${renderId}`)?.remove()
  document.getElementById(`i${renderId}`)?.remove()
}

/**
 * Mermaid keeps global state between renders, so two diagrams rendering at once
 * corrupt each other's output. Renders are queued rather than run in parallel.
 */
export async function renderMermaidDiagram(diagram: string, renderId: string): Promise<string> {
  const render = async () => {
    const mermaid = (await import('mermaid')).default
    initializeMermaid(mermaid)
    const host = appendMermaidRenderHost()
    try {
      const result = await mermaid.render(
        renderId,
        normalizeTimelinePeriodLabelsForRender(diagram),
        host,
      )
      return centerMermaidNodeLabels(result.svg)
    } finally {
      removeMermaidRenderArtifacts(renderId, host)
    }
  }

  const nextRender = renderQueue.then(render, render)
  renderQueue = nextRender.then(
    () => undefined,
    () => undefined,
  )
  return nextRender
}
