import type { MouseEvent } from 'react';
import type { DictionaryEntry } from '../api';
import { useGlossary } from '../hooks/useGlossary';
import { useToast } from '../hooks/useToast';

interface StarButtonProps {
  entry: DictionaryEntry;
  /** Pill with text (entry page) instead of a bare star icon (result rows). */
  labeled?: boolean;
}

export default function StarButton({ entry, labeled }: StarButtonProps) {
  const { isSaved, toggle } = useGlossary();
  const { showToast } = useToast();
  const saved = isSaved(entry.id);

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowSaved = await toggle(entry);
    showToast(
      nowSaved
        ? `${entry.simplified} added to glossary`
        : `${entry.simplified} removed from glossary`,
    );
  };

  if (labeled) {
    return (
      <button
        type="button"
        className={`btn btn-outline star-button-labeled${saved ? ' is-saved' : ''}`}
        onClick={handleClick}
      >
        <span aria-hidden="true">{saved ? '★' : '☆'}</span>
        {saved ? 'Saved to glossary' : 'Save to glossary'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`star-button${saved ? ' is-saved' : ''}`}
      onClick={handleClick}
      title={saved ? 'Remove from glossary' : 'Save to glossary'}
      aria-label={
        saved ? `Remove ${entry.simplified} from glossary` : `Save ${entry.simplified} to glossary`
      }
      aria-pressed={saved}
    >
      {saved ? '★' : '☆'}
    </button>
  );
}
