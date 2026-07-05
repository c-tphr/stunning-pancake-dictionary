import { useEffect, useMemo, useState } from 'react';
import { api, type CharacterComponent, type CharacterInfo } from '../api';
import Button from './Button';

interface ComponentPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  onResults: (results: CharacterInfo[]) => void;
}

/** Groups a stroke-sorted component list into { strokeCount, components }[] bands. */
function groupByStrokeCount(components: CharacterComponent[]) {
  const groups: { strokeCount: number; components: CharacterComponent[] }[] = [];
  for (const c of components) {
    const last = groups[groups.length - 1];
    if (last && last.strokeCount === c.strokeCount) last.components.push(c);
    else groups.push({ strokeCount: c.strokeCount, components: [c] });
  }
  return groups;
}

export default function ComponentPicker({ selected, onChange, onResults }: ComponentPickerProps) {
  const [inventory, setInventory] = useState<CharacterComponent[]>([]);
  const [candidates, setCandidates] = useState<CharacterInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.listCharacterComponents().then((list) => {
      if (!cancelled) setInventory(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.searchByComponents(selected).then((results) => {
      if (!cancelled) {
        setCandidates(results);
        onResults(results);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(',')]);

  // A component can still narrow the current selection if some candidate
  // character contains it — otherwise adding it would zero out the results.
  const viableComponents = useMemo(() => {
    if (selected.length === 0) return null;
    const viable = new Set<string>();
    for (const c of candidates) {
      for (const comp of c.components) viable.add(comp);
    }
    return viable;
  }, [candidates, selected.length]);

  const toggle = (component: string) => {
    onChange(
      selected.includes(component)
        ? selected.filter((c) => c !== component)
        : [...selected, component],
    );
  };

  const groups = useMemo(() => groupByStrokeCount(inventory), [inventory]);

  return (
    <div className="component-picker">
      <div className="component-picker-chips">
        {selected.length === 0 ? (
          <span className="body-sm state-note">Select components to see matching characters</span>
        ) : (
          <>
            {selected.map((c) => (
              <button
                key={c}
                type="button"
                className="badge caption-uppercase component-chip"
                onClick={() => toggle(c)}
                aria-label={`Remove component ${c}`}
              >
                <span className="hanzi">{c}</span> ×
              </button>
            ))}
            <Button variant="text" onClick={() => onChange([])}>
              Clear all
            </Button>
          </>
        )}
      </div>

      <div className="component-picker-grid">
        {groups.map((group) => (
          <div key={group.strokeCount} className="component-picker-group">
            <span className="caption-uppercase component-picker-group-label">
              {group.strokeCount} {group.strokeCount === 1 ? 'stroke' : 'strokes'}
            </span>
            <div className="component-picker-tiles">
              {group.components.map(({ component }) => {
                const isSelected = selected.includes(component);
                const isViable =
                  isSelected || viableComponents === null || viableComponents.has(component);
                return (
                  <button
                    key={component}
                    type="button"
                    className={`component-tile hanzi${isSelected ? ' is-selected' : ''}${
                      !isViable ? ' is-dimmed' : ''
                    }`}
                    onClick={() => toggle(component)}
                    disabled={!isViable}
                    aria-pressed={isSelected}
                    aria-label={`Component ${component}`}
                  >
                    {component}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
