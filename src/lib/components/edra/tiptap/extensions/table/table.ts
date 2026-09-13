import { Table as TiptapTable, renderTableToMarkdown } from '@tiptap/extension-table';
import { unwrapBareLinks } from '@/editor/compact-markdown';

/**
 * Cells are unwrapped before they are measured.
 *
 * The stock renderer pads every column to its widest cell, and it measures
 * the cell *as serialized* — where a bare address has just become
 * `[https://x](https://x)`. `compactMarkdown` unwraps that again afterwards,
 * but by then the column is already twice as wide as the text left in it.
 * Doing the unwrap inside `renderChildren` is the one place early enough.
 */
export const Table = TiptapTable.extend({
	renderMarkdown: (node, h) =>
		renderTableToMarkdown(node, {
			...h,
			renderChildren: (content, separator) => unwrapBareLinks(h.renderChildren(content, separator))
		})
}).configure({
	resizable: true,
	lastColumnResizable: true,
	allowTableNodeSelection: true
});

export default Table;
