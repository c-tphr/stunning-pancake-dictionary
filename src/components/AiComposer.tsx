import { useEffect, useRef, type KeyboardEvent } from 'react';
import Button from './Button';

interface AiComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

const MAX_HEIGHT = 140; // ~5 lines before it scrolls internally

/** Auto-growing textarea + send pill. Enter sends, Shift+Enter inserts a newline. */
export default function AiComposer({ value, onChange, onSend, disabled }: AiComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <form
      className="ai-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <textarea
        ref={textareaRef}
        className="ai-composer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about a term or grammar point… (Enter to send, Shift+Enter for a new line)"
        aria-label="Ask the AI assistant"
        disabled={disabled}
        rows={1}
      />
      <Button variant="primary" type="submit" disabled={!canSend}>
        Send
      </Button>
    </form>
  );
}
