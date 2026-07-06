import { useEffect, useRef } from 'react';

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '↓ / j', action: 'Activate next segment' },
  { keys: '↑ / k', action: 'Activate previous segment' },
  { keys: 'Shift+↓/↑', action: 'Extend selection range' },
  { keys: 'g', action: 'Mark Good, advance' },
  { keys: 'r', action: 'Mark Needs revision, advance' },
  { keys: 'Enter / e', action: "Edit the active segment's target" },
  { keys: 't', action: 'Translate active/selected untranslated segments' },
  { keys: 'm', action: 'Merge active source segment with the next' },
  { keys: 's', action: 'Split active source segment at the caret' },
  { keys: 'd', action: 'Define the current selection or last-clicked word' },
  { keys: '1 / 2 / 3', action: 'Switch view: Target / Sentences / Paragraphs' },
  { keys: '[ / ]', action: 'Toggle left / right panel' },
  { keys: '?', action: 'Toggle this overlay' },
];

export default function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="workspace-overlay-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="workspace-overlay empty-state"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="display-sm">Keyboard shortcuts</p>
        <table className="workspace-shortcuts-table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td className="workspace-shortcut-keys caption-uppercase">{s.keys}</td>
                <td className="body-sm">{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
