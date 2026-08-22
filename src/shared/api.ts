/**
 * The port the app's HTTP face listens on, in one place because three sides need
 * to agree on it: the process that serves it (the desktop shell and the
 * standalone dev server), the Vite proxy that forwards `/api` to it, and the
 * webview, which has to name it outright in the one case where it cannot borrow
 * the page's own origin — a packaged build, whose view is loaded from `views://`.
 *
 * `ORBIT_LITE_API_PORT` still overrides it for anything with an environment. The
 * webview has none, so a moved port and a packaged build together are the one
 * combination that needs this rebuilt rather than reconfigured.
 */
export const DEFAULT_API_PORT = 5374
