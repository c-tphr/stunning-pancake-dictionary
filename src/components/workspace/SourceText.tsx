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
    const handleDocumentClick = (e: MouseEvent) => {
      if (chipRef.current?.contains(e.target as Node)) return;
      setChip(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';
    if (!selectedText || selection!.isCollapsed || !containerRef.current) {
      return;
    }
    const anchorNode = selection!.anchorNode;
    if (!anchorNode || !containerRef.current.contains(anchorNode)) return;
    const rect = selection!.getRangeAt(0).getBoundingClientRect();
    setChip({ text: selectedText, top: rect.top + window.scrollY - 40, left: rect.left + window.scrollX });
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
            <button
              type="button"
              className="workspace-word"
              aria-label={`Look up ${word}`}
              onClick={() => onWordClick(word, wordOffsets[i])}
            >
              {word}
            </button>
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
          }}
        >
          Look up
        </button>
      )}
    </span>
  );
}
