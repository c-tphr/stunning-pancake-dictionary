import type { KeyboardEvent } from 'react';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
}

/** Pill-track two/three-way switch — segmented alternative to tabs. */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
  };

  return (
    <div className="segmented-control" role="tablist" aria-label={ariaLabel}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          tabIndex={opt.value === value ? 0 : -1}
          className={`segmented-option${opt.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
