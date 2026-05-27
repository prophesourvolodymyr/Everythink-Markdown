# Fd4-ApplyEdit — AI-Suggested Edit Application System

The system that takes an AI-proposed code or text change from a chat message, computes the diff against the current document, shows a visual preview of the changes, and — on user confirmation — applies the edit to the document. This is the bridge between "the AI suggested something" and "the document now contains that thing." It is the most consequential operation in the AI panel because a bad edit can corrupt a document, and a good edit must be undoable, reviewable, and precise.

## Triggering ApplyEdit

An Apply button appears on any code block within an AI chat message that Fd4-ApplyEdit determines is a plausible document edit. The determination is heuristic: if the code block's language tag matches the current document's format (md, emd), if the content contains EMD section headers or semantic links, or if the AI's preceding message text explicitly says it is proposing an edit, the Apply button appears. The button also appears on inline text suggestions that the AI marks with a specific format.

When the user clicks Apply, Fd4-ApplyEdit extracts the proposed content from the code block, identifies the target section or location in the document (from the AI's text description of where the edit goes), computes the diff, and shows the preview.

## The Preview Panel

The preview panel shows a side-by-side or unified diff view of the current document and the proposed version. Additions are highlighted in green. Deletions are highlighted in red. Unchanged lines are shown in gray. The section context — which section the edit affects and what surrounding content looks like — is displayed above the diff.

The preview is editable. The user can modify the proposed text in the preview before applying. This is critical because AI-generated edits are often close but not perfect — the user fixes a variable name or an indentation level before applying. The preview text area uses a monospace font and basic syntax highlighting for EMD.

Below the preview, a summary shows the number of lines added, lines removed, and lines modified. A file count shows how many files are affected (most edits affect only the current file, but an AI agent with write_file tool access could propose multi-file edits).

The user has three actions: Apply (commits the edit), Edit (closes the preview and switches the affected section to edit mode so the user can modify it directly), and Cancel (discards the proposal). Apply and Edit can be undone via Cmd+Z.

## Diff Computation

The diff is computed character-by-character or line-by-line depending on the edit size. For small edits (under 100 lines changed), a character-level diff using Myers' algorithm is computed for precise highlighting. For large edits, a line-level diff is used for performance. The diff algorithm is implemented in Rust in F1-EmdCore and accessed via WASM, providing fast diff computation without blocking the JavaScript main thread.

## Applying the Edit

When the user confirms the edit, Fd4-ApplyEdit dispatches a CodeMirror transaction that replaces the affected text range with the new content. The transaction is a single atomic operation, so undo (Cmd+Z) reverses the entire edit in one step. After applying, the document re-parses via F1-EmdCore. If the parser produces validation errors (broken links, status inconsistencies, malformed headers), a warning banner appears above the edit area with the option to "Apply anyway" or "Revert."

If the edit spans multiple files, each file is updated as a separate transaction on that file's EditorView. Multi-file edits are grouped as a single undoable action if all files are open; if some files are not open, they are written directly to storage and the edits to those files are not individually undoable (though the entire operation can be reverted by the agent's write-back mechanism).

## Error Handling

The most common error is that the AI's proposed edit does not match the current document state — the user may have edited the document while the AI was generating its response, or the AI may have hallucinated a section that does not exist. In this case, the diff computation produces a conflict. Fd4-ApplyEdit shows both the current text and the proposed text side by side with conflict markers, and the user manually resolves the conflict in the preview editor.

Another error is that the AI proposes an edit to a section that F1-EmdCore's validator rejects (e.g., adding an `→ implements` link to a `[summary]` section). The validation error is shown in the preview, and the user can choose to apply anyway (the validator warns but does not block) or edit the proposal to fix the issue.

A catastrophic error — where applying the edit corrupts the document beyond parse — is recovered by reverting to the pre-edit state stored in the undo stack. The user sees a "edit failed, document restored" message. The proposed edit is preserved in the chat so the user can try a modified approach.
