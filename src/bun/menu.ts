import { ApplicationMenu } from 'electrobun/bun'
import type { MenuCommand } from '../shared/rpc'

/**
 * The native menu is the only place keyboard shortcuts are declared.
 *
 * Doing it here rather than in the webview avoids two classes of bug: WKWebView
 * swallowing key events inside contenteditable, and shortcuts that work only
 * while the editor happens to have focus.
 */
export function installApplicationMenu(send: (command: MenuCommand) => void) {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
      label: 'Orbit',
    },
    {
      label: 'File',
      submenu: [
        { label: 'New File', action: 'new-file', accelerator: 'CmdOrCtrl+n' },
        { label: 'Open File…', action: 'open-file', accelerator: 'CmdOrCtrl+o' },
        { label: 'Open by Path…', action: 'open-by-path', accelerator: 'CmdOrCtrl+Shift+p' },
        { label: 'Open Folder…', action: 'open-folder', accelerator: 'CmdOrCtrl+Shift+o' },
        { type: 'separator' },
        { label: 'Save', action: 'save', accelerator: 'CmdOrCtrl+s' },
        { label: 'Rename…', action: 'rename-file', accelerator: 'CmdOrCtrl+Shift+r' },
        // Deliberately without an accelerator. Every other command here is
        // recoverable by pressing it again; this one throws the open file away,
        // and a mistyped shortcut is not a good way to discover that.
        { label: 'Move to Trash…', action: 'delete-file' },
        { type: 'separator' },
        { label: 'Pin to Dashboard', action: 'toggle-pin', accelerator: 'CmdOrCtrl+d' },
        { label: 'Bookmark', action: 'toggle-bookmark', accelerator: 'CmdOrCtrl+Shift+d' },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in File', action: 'find-in-file', accelerator: 'CmdOrCtrl+f' },
        { type: 'separator' },
        { label: 'Link to Note…', action: 'link-file', accelerator: 'CmdOrCtrl+k' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Back', action: 'go-back', accelerator: 'CmdOrCtrl+[' },
        { label: 'Forward', action: 'go-forward', accelerator: 'CmdOrCtrl+]' },
        { type: 'separator' },
        { label: 'Quick Open…', action: 'quick-open', accelerator: 'CmdOrCtrl+p' },
        { label: 'Reveal in Sidebar', action: 'reveal-in-tree', accelerator: 'CmdOrCtrl+Shift+e' },
        { label: 'Filter Sidebar', action: 'sidebar-search', accelerator: 'CmdOrCtrl+Shift+f' },
        { type: 'separator' },
        { label: 'Home', action: 'go-dashboard', accelerator: 'CmdOrCtrl+0' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Markdown Source', action: 'toggle-raw-mode', accelerator: 'CmdOrCtrl+/' },
        /*
         * Not in a "File" or "Edit" menu despite being about writing: it is a
         * mode the whole window is in, which is what View collects. The label
         * names the mode rather than the act — "Toggle Read-Only" tells you
         * what state you are heading for whichever one you are in now.
         */
        {
          label: 'Toggle Read-Only',
          action: 'toggle-read-only',
          accelerator: 'CmdOrCtrl+Shift+l',
        },
        { label: 'Toggle Sidebar', action: 'toggle-sidebar', accelerator: 'CmdOrCtrl+b' },
        /*
         * One pane on the right with three views in it, so these items name a
         * view rather than a panel — "Toggle Outline" would be a lie the moment
         * the pane is up on Info. Choosing the view you are already looking at
         * puts the pane away, which is what keeps a single key doing both jobs.
         * Todos has no accelerator: the pane's tab strip is the fast path, and
         * the free two-key combinations are better spent elsewhere.
         */
        { label: 'Info', action: 'show-info', accelerator: 'CmdOrCtrl+i' },
        { label: 'Outline', action: 'show-outline', accelerator: 'CmdOrCtrl+Shift+t' },
        { label: 'Todos', action: 'show-todos' },
        { type: 'separator' },
        /*
         * The window resolves its URL once, at creation. In dev that URL is the
         * Vite dev server, so restarting Vite leaves the native window holding a
         * page that no longer has a server behind it — stale, or stuck on
         * "Loading…", while a browser tab pointed at the same app looks fine
         * because reloading a tab is reflex. Without this item the only way back
         * was to quit the app.
         */
        { label: 'Reload', action: 'reload-view', accelerator: 'CmdOrCtrl+r' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
    },
  ])

  ApplicationMenu.on('application-menu-clicked', (event: unknown) => {
    const action = (event as { data?: { action?: string } })?.data?.action
    if (action) send(action as MenuCommand)
  })
}
