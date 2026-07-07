import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef } from 'react';

interface SegmentEditorProps {
  initialText: string;
  /** Enter / Mod+Enter — save, mark Good, advance. */
  onConfirm: (text: string) => void;
  /** Escape or clicking away — save, mark Good only if changed, don't advance. */
  onCancel: (text: string, changed: boolean) => void;
}

/**
 * The on-demand Tiptap instance for the segment currently being edited.
 * Mounted only while editing (see WorkspaceEditor) — segments are otherwise
 * plain text, which is what keeps merge/split pure data operations and the
 * three views trivial re-projections.
 *
 * Clicking away closes the editor with Escape semantics (via blur) — except
 * when focus moves within the same row/paragraph, so looking up a source
 * word doesn't kick the translator out of the segment they're writing.
 */
export default function SegmentEditor({ initialText, onConfirm, onCancel }: SegmentEditorProps) {
  const dirtyRef = useRef(false);
  const textRef = useRef(initialText.trim());
  // Enter, Escape, and blur can race (closing the editor moves focus, which
  // fires blur) — whichever fires first wins, the rest are no-ops.
  const finishedRef = useRef(false);

  const finish = (fn: () => void) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    fn();
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        bold: false,
        italic: false,
        strike: false,
        horizontalRule: false,
      }),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: initialText ? [{ type: 'text', text: initialText }] : [],
        },
      ],
    },
    autofocus: 'end',
    onUpdate: ({ editor: e }) => {
      dirtyRef.current = true;
      textRef.current = e.getText().trim();
    },
    editorProps: {
      attributes: {
        class: 'workspace-segment-editor-content',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish(() => onConfirm(textRef.current));
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(() => onCancel(textRef.current, dirtyRef.current));
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        blur: (view, event) => {
          const related = (event as FocusEvent).relatedTarget as Node | null;
          if (related) {
            // Focus moved within the page. Staying inside the same row
            // (sentences view) or paragraph group (paragraphs view) — e.g. a
            // word-lookup click — keeps the editor open; anywhere else closes.
            const scope = view.dom.closest('.workspace-sentence-row, .workspace-paragraph-group');
            if (scope?.contains(related)) return false;
            finish(() => onCancel(textRef.current, dirtyRef.current));
            return false;
          }
          // No relatedTarget: either the whole window lost focus (keep the
          // editor open) or a click landed on a non-focusable part of the
          // page (close). hasFocus() tells the two apart.
          if (!document.hasFocus()) return false;
          finish(() => onCancel(textRef.current, dirtyRef.current));
          return false;
        },
      },
    },
  });

  return <EditorContent editor={editor} className="workspace-segment-editor" />;
}
