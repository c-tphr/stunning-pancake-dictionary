import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef } from 'react';

interface SegmentEditorProps {
  initialText: string;
  /** Enter / Mod+Enter — save, mark Good, advance. */
  onConfirm: (text: string) => void;
  /** Escape — save, mark Good only if changed, don't advance. */
  onCancel: (text: string, changed: boolean) => void;
}

/**
 * The on-demand Tiptap instance for the segment currently being edited.
 * Mounted only while editing (see WorkspaceEditor) — segments are otherwise
 * plain text, which is what keeps merge/split pure data operations and the
 * three views trivial re-projections.
 */
export default function SegmentEditor({ initialText, onConfirm, onCancel }: SegmentEditorProps) {
  const dirtyRef = useRef(false);

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
    onUpdate: () => {
      dirtyRef.current = true;
    },
    editorProps: {
      attributes: {
        class: 'workspace-segment-editor-content',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onConfirm(getText());
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel(getText(), dirtyRef.current);
          return true;
        }
        return false;
      },
    },
  });

  const getText = () => editor?.getText().trim() ?? '';

  return <EditorContent editor={editor} className="workspace-segment-editor" />;
}
