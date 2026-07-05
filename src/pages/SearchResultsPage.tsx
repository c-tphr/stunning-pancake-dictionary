import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type SearchMode, type SearchResult } from '../api';
import EntryCard from '../components/EntryCard';
import Badge from '../components/Badge';

const MODE_LABEL: Record<SearchMode, string> = {
  hanzi: 'Matched as Chinese characters',
  pinyin: 'Matched as pinyin',
  english: 'Matched as English',
};

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.search(query).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="container page">
      <header className="results-header">
        <h1 className="display-lg">
          Results for <span className="results-query">“{query}”</span>
        </h1>
        {result && !loading && (
          <div className="results-meta">
            <span className="body-sm results-count">
              {result.entries.length} {result.entries.length === 1 ? 'entry' : 'entries'}
            </span>
            {result.entries.length > 0 && <Badge>{MODE_LABEL[result.detectedMode]}</Badge>}
          </div>
        )}
      </header>

      {loading && <p className="body-md state-note">Searching…</p>}

      {!loading && result && result.entries.length === 0 && (
        <div className="empty-state">
          <p className="display-sm">No entries found.</p>
          <p className="body-sm">
            Try simplified or traditional characters, toneless pinyin (“yinhang”), tone numbers
            (“yin2hang2”), or an English word.
          </p>
        </div>
      )}

      {!loading && result && result.entries.length > 0 && (
        <ul className="results-list">
          {result.entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
