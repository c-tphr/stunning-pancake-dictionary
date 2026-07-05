import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type CharacterInfo } from '../api';
import CharacterTile from '../components/CharacterTile';
import ComponentPicker from '../components/ComponentPicker';
import HandwritingCanvas from '../components/HandwritingCanvas';
import SegmentedControl from '../components/SegmentedControl';

type Mode = 'components' | 'draw';

/** Groups character results into { strokeCount, characters }[] bands, ascending. */
function groupByStrokeCount(characters: CharacterInfo[]) {
  const groups: { strokeCount: number; characters: CharacterInfo[] }[] = [];
  for (const c of characters) {
    const last = groups[groups.length - 1];
    if (last && last.strokeCount === c.strokeCount) last.characters.push(c);
    else groups.push({ strokeCount: c.strokeCount, characters: [c] });
  }
  return groups;
}

export default function CharactersPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'draw' ? 'draw' : 'components';
  const selectedComponents = useMemo(
    () => (params.get('c') ? params.get('c')!.split(',').filter(Boolean) : []),
    [params],
  );

  const [componentResults, setComponentResults] = useState<CharacterInfo[]>([]);
  const [drawCandidates, setDrawCandidates] = useState<CharacterInfo[]>([]);
  const [showRecognizing, setShowRecognizing] = useState(false);
  const recognizingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a stale recognizeCharacter() response (e.g. from before a
  // Clear or a new stroke) landing after a newer request has already resolved.
  const recognizeSeqRef = useRef(0);

  const setMode = (next: Mode) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('mode', next);
    setParams(nextParams, { replace: true });
  };

  const setSelectedComponents = (components: string[]) => {
    const nextParams = new URLSearchParams(params);
    if (components.length > 0) nextParams.set('c', components.join(','));
    else nextParams.delete('c');
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="display-lg">Characters</h1>
          <p className="body-sm page-header-sub">
            Find a character you can't type — by its components, or by drawing it.
          </p>
        </div>
      </header>

      <SegmentedControl
        aria-label="Character look-up mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'components', label: 'By component' },
          { value: 'draw', label: 'Draw' },
        ]}
      />

      {mode === 'components' ? (
        <div className="characters-mode-panel">
          <ComponentPicker
            selected={selectedComponents}
            onChange={setSelectedComponents}
            onResults={setComponentResults}
          />
          <CharacterResults characters={componentResults} />
        </div>
      ) : (
        <div className="characters-mode-panel characters-draw-panel">
          <HandwritingCanvas
            onSample={async (sample) => {
              if (recognizingTimerRef.current) clearTimeout(recognizingTimerRef.current);
              const seq = ++recognizeSeqRef.current;
              if (!sample) {
                setShowRecognizing(false);
                setDrawCandidates([]);
                return;
              }
              // Only surface the "Recognizing…" note if the call is slow — the
              // mock resolves in 150-300ms, so this avoids a flash on every stroke.
              recognizingTimerRef.current = setTimeout(() => {
                if (seq === recognizeSeqRef.current) setShowRecognizing(true);
              }, 300);
              const results = await api.recognizeCharacter(sample);
              if (seq !== recognizeSeqRef.current) return; // superseded by a newer request
              if (recognizingTimerRef.current) clearTimeout(recognizingTimerRef.current);
              setShowRecognizing(false);
              setDrawCandidates(results);
            }}
          />
          <div className="draw-candidates">
            <h2 className="caption-uppercase draw-candidates-label">Candidates</h2>
            {drawCandidates.length === 0 ? (
              <p className="body-sm state-note">
                {showRecognizing ? 'Recognizing…' : 'Draw a character to see candidates'}
              </p>
            ) : (
              <div className="character-tile-grid">
                {drawCandidates.map((c) => (
                  <CharacterTile key={c.char} info={c} />
                ))}
              </div>
            )}
            <p className="caption draw-candidates-caveat">
              Candidate quality improves once the recognition service is connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterResults({ characters }: { characters: CharacterInfo[] }) {
  if (characters.length === 0) {
    return (
      <div className="empty-state">
        <p className="display-sm">No character contains all of these components.</p>
        <p className="body-sm">Try removing one of your selected components.</p>
      </div>
    );
  }

  const groups = groupByStrokeCount(characters);

  return (
    <div className="character-results">
      {groups.map((group) => (
        <div key={group.strokeCount} className="character-results-group">
          <span className="caption-uppercase character-results-group-label">
            {group.strokeCount} {group.strokeCount === 1 ? 'stroke' : 'strokes'}
          </span>
          <div className="character-tile-grid">
            {group.characters.map((c) => (
              <CharacterTile key={c.char} info={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
