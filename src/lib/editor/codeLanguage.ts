import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/**
 * Syntax highlighting for the files that are not markdown.
 *
 * `@codemirror/language-data` is a catalogue rather than a bundle: each grammar
 * is behind a dynamic `import()`, so opening a Python file fetches the Python
 * parser and nothing else. That is the whole reason for the dependency —
 * writing even one grammar by hand is not on the table, and static-importing
 * thirty of them would put every parser the app knows into the first paint of a
 * markdown note.
 *
 * The cost is that the language arrives *after* the view does, which is why
 * `codemirror.ts` reconfigures a compartment instead of building the extension
 * up front. A file is readable in the meantime; it is simply not coloured yet.
 */

const CODE_COLORS = {
  comment: 'var(--code-comment)',
  function: 'var(--code-function)',
  keyword: 'var(--code-keyword)',
  number: 'var(--code-number)',
  string: 'var(--code-string)',
  type: 'var(--code-type)',
}

/**
 * Deliberately six colours and no background tints.
 *
 * Everything not named here inherits `--text`: identifiers, punctuation,
 * operators, and whatever else a grammar happens to tag. A file where every
 * token is a different colour is a file where none of them mean anything, and
 * this editor's job beside a notes app is to stay quiet.
 */
const codeHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.controlKeyword, tags.operatorKeyword], color: CODE_COLORS.keyword },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: CODE_COLORS.string },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: CODE_COLORS.comment, fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: CODE_COLORS.number },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: CODE_COLORS.function },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName, tags.annotation], color: CODE_COLORS.type },
  { tag: [tags.definition(tags.propertyName), tags.attributeName], color: CODE_COLORS.function },
  { tag: tags.invalid, color: 'var(--danger)' },
])

/**
 * The grammar for a path, or `null` when the catalogue has none.
 *
 * Matched on the filename rather than on our own extension list on purpose: the
 * two lists disagree — `CODE_EXTENSIONS` decides what the app will *open*, and
 * this decides what it can *colour*. A `.env` file is worth opening and has no
 * grammar; that is a plain-text view, not an error.
 */
export function codeLanguageFor(path: string): LanguageDescription | null {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return LanguageDescription.matchFilename(languages, name)
}

/** Loads the grammar and pairs it with the colours. Rejects like any import. */
export async function loadCodeLanguage(description: LanguageDescription): Promise<Extension> {
  const support = await description.load()
  return [support, syntaxHighlighting(codeHighlightStyle)]
}
