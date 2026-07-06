const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('');
}

/**
 * Superscript citation markers appended after grounded text. Shared by the AI
 * assistant and the Workspace reference panel — both cite into a numbered
 * source list and both expand/highlight that list's matching row on click.
 */
export default function CitationMarkers({
  indexes,
  onCite,
}: {
  indexes: number[];
  onCite: (index: number) => void;
}) {
  if (indexes.length === 0) return null;
  return (
    <span className="ai-citations">
      {indexes.map((n) => (
        <button
          key={n}
          type="button"
          className="ai-citation-marker"
          aria-label={`Show source ${n}`}
          onClick={() => onCite(n)}
        >
          {toSuperscript(n)}
        </button>
      ))}
    </span>
  );
}
