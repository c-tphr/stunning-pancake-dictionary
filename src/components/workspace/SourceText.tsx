import { useEffect, useMemo, useRef, useState } from 'react';
import { segmentWords } from '../../lib/segmentation';

interface SourceTextProps {
  text: string;
  /** Whether this is the active segment — enables the split-caret marker. */
  isActive?: boolean;
  /** Word-start offset (into `text`) where a split-caret marker should render. */
  splitOffset?: number | null;
  onWordClick: (word: string, wordStartOffset: number) => void;
  onSelectionLookup: (phrase: string) => void;
  className?: string;
}

/**
 * Renders Chinese source text as clickable word spans (via segmentWords).
 * Clicking a word looks it up AND marks that word's start as the pending
 * split point for the active segment — a single click serves double duty
 * since positioning an independent character-level caret would otherwise
 * fight with word-click lookup for the same gesture. Dragging a selection
 * across words shows a floating "Look up" chip as the escape hatch when the
 * word segmenter picked the wrong boundary.
 *
 * Words render as focusable spans, NOT <button>s — browsers treat a drag
 * that starts on a button as a press gesture and never begin a native text
 * selection, which would make the drag-to-look-up escape hatch unreachable.
 */
export default function SourceText({
  text,
  isActive,
  splitOffset,
  onWordClick,
  onSelectionLookup,
  className,
}: SourceTextProps) {
  const words = useMemo(() => segmentWords(text), [text]);
  const containerRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [chip, setChip] = useState<{ text: string; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!chip) return;
    // Dismiss on the NEXT gesture's mousedown, not on `click`: the drag that
    // creates the chip ends with a click of its own (mouseup → click), and a
    // click listener would treat that trailing click as "clicked outside" and
    // clear the chip before the user could ever press it. Any genuinely new
    // interaction starts with a fresh mousedown. Scrolling also dismisses —
    // the chip is viewport-fixed, so scrolled content would drift out from
    // under it.
    const handlePointerDown = (e: MouseEvent) => {
      if (chipRef.current?.contains(e.target as Node)) return;
      setChip(null);
    };
    const handleScroll = () => setChip(null);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [chip]);

  const selectionInside = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.anchorNode) return null;
    if (!containerRef.current?.contains(selection.anchorNode)) return null;
    return selection;
  };

  const handleMouseUp = () => {
    const selection = selectionInside();
    const selectedText = selection?.toString().trim() ?? '';
    if (!selection || !selectedText) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    // position: fixed — viewport coordinates straight from the rect, no
    // scroll offsets. The chip centers itself via translate(-50%, -100%).
    setChip({ text: selectedText, top: rect.top - 6, left: rect.left + rect.width / 2 });
  };

  let offset = 0;
  const wordOffsets = words.map((w) => {
    const start = offset;
    offset += w.length;
    return start;
  });

  return (
    <span className={`workspace-source-text hanzi-sans${className ? ` ${className}` : ''}`}>
      <span ref={containerRef} onMouseUp={handleMouseUp}>
        {words.map((word, i) => (
          <span key={i} className="workspace-word-wrap">
            {isActive && splitOffset === wordOffsets[i] && (
              <span className="workspace-split-caret" aria-hidden="true" />
            )}
            <span
              role="button"
              tabIndex={0}
              className="workspace-word"
              aria-label={`Look up ${word}`}
              onClick={() => {
                // A drag that ends on a word fires a click too — that gesture
                // belongs to the selection chip, not word lookup.
                if (selectionInside()) return;
                onWordClick(word, wordOffsets[i]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  // Keep Enter from also reaching the editor's document-level
                  // shortcut layer (Enter = edit active segment).
                  e.stopPropagation();
                  onWordClick(word, wordOffsets[i]);
                }
              }}
            >
              {word}
            </span>
          </span>
        ))}
      </span>
      {chip && (
        <button
          ref={chipRef}
          type="button"
          className="badge caption-uppercase workspace-lookup-chip"
          style={{ top: chip.top, left: chip.left }}
          onClick={() => {
            onSelectionLookup(chip.text);
            setChip(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          Look up
        </button>
      )}
    </span>
  );
}
