import type { ReactNode } from 'react';
import { copyText } from '../lib/clipboard';
import { useToast } from '../hooks/useToast';

interface CopyTextProps {
  /** The string placed on the clipboard. */
  text: string;
  /** What is being copied, for the aria label, e.g. "headword". */
  label: string;
  className?: string;
  /** Rendered content; defaults to the copied text itself. */
  children?: ReactNode;
}

/**
 * Click-to-copy text. High-frequency translator action: click a headword,
 * pinyin, or gloss to lift it straight into a draft.
 */
export default function CopyText({ text, label, className, children }: CopyTextProps) {
  const { showToast } = useToast();

  return (
    <button
      type="button"
      className={['copyable', className].filter(Boolean).join(' ')}
      title="Click to copy"
      aria-label={`Copy ${label}: ${text}`}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = await copyText(text);
        showToast(ok ? `Copied “${text}”` : 'Copy blocked by the browser');
      }}
    >
      {children ?? text}
    </button>
  );
}
