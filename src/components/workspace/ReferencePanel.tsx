import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type AiMessage as AiMessageType,
  type DictionaryEntry,
  type TermExplanation,
} from '../../api';
import { useSession } from '../../hooks/useSession';
import { useSettings } from '../../hooks/useSettings';
import { useGlossary } from '../../hooks/useGlossary';
import { useToast } from '../../hooks/useToast';
import { buildGrounding } from '../../ai/grounding';
import { formatPinyin, headwordParts } from '../../lib/format';
import AiComposer from '../AiComposer';
import AiReplyCard from '../AiMessage';
import Button from '../Button';
import CitationMarkers from '../CitationMarkers';
import CopyText from '../CopyText';
import SegmentedControl from '../SegmentedControl';
import SenseList from '../SenseList';

type ReferenceTab = 'lookup' | 'glossary' | 'assistant';

interface ReferencePanelProps {
  phrase: string | null;
  context: string;
  activeSegmentSource: string;
  tab: ReferenceTab;
  onTabChange: (tab: ReferenceTab) => void;
  onPhraseChange: (phrase: string) => void;
}

export default function ReferencePanel({
  phrase,
  context,
  activeSegmentSource,
  tab,
  onTabChange,
  onPhraseChange,
}: ReferencePanelProps) {
  return (
    <div className="workspace-reference-panel">
      <SegmentedControl
        aria-label="Reference panel section"
        value={tab}
        onChange={onTabChange}
        options={[
          { value: 'lookup', label: 'Lookup' },
          { value: 'glossary', label: 'Glossary' },
          { value: 'assistant', label: 'Assistant' },
        ]}
      />
      <div className="workspace-reference-body">
        {tab === 'lookup' && <LookupTab phrase={phrase} context={context} />}
        {tab === 'glossary' && <GlossaryTab onPick={(entry) => onPhraseChange(entry.simplified)} />}
        {tab === 'assistant' && <AssistantTab activeSegmentSource={activeSegmentSource} />}
      </div>
    </div>
  );
}

function LookupTab({ phrase, context }: { phrase: string | null; context: string }) {
  const { user } = useSession();
  const { settings } = useSettings();
  const [query, setQuery] = useState(phrase ?? '');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<TermExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  // Guards against a stale revert timer (from an earlier citation click)
  // clearing a highlight set by a newer one — same pattern as the character
  // recognition race guard in CharactersPage.
  const citeSeqRef = useRef(0);

  const runExplain = async (p: string, termbaseEntries: DictionaryEntry[]) => {
    if (!user) return;
    setExplaining(true);
    setExplainError(false);
    try {
      const exp = await api.explainTerm({ phrase: p, context, termbaseEntries });
      setExplanation(exp);
    } catch {
      setExplainError(true);
    } finally {
      setExplaining(false);
    }
  };

  const runSearch = async (q: string) => {
    setQuery(q);
    setSearching(true);
    setExplanation(null);
    setExplainError(false);
    const result = await api.search(q);
    setSearching(false);
    setResults(result.entries);
    setExpandedId(result.entries[0]?.id ?? null);
    runExplain(q, result.entries);
  };

  useEffect(() => {
    if (phrase) runSearch(phrase);
    // Only re-run when a NEW phrase comes in from a word click/selection —
    // not on every context change (that would silently re-run in the background).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrase]);

  const handleCite = (index: number) => {
    const seq = ++citeSeqRef.current;
    setHighlighted(index);
    setExpandedId(results[index - 1]?.id ?? null);
    window.setTimeout(() => {
      if (seq === citeSeqRef.current) setHighlighted(null);
    }, 1600);
  };

  return (
    <div className="workspace-lookup-tab">
      <form
        className="workspace-lookup-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) runSearch(query.trim());
        }}
      >
        <input
          type="search"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the dictionary…"
          aria-label="Search the termbase"
        />
      </form>

      {searching && <p className="body-sm state-note">Searching…</p>}

      {!searching && phrase && results.length === 0 && (
        <p className="body-sm state-note">No termbase entries for "{phrase}".</p>
      )}

      {!searching && results.length > 0 && (
        <ul className="workspace-lookup-results">
          {results.map((entry, i) => {
            const hw = headwordParts(entry, settings.characterPriority);
            const isOpen = expandedId === entry.id;
            return (
              <li
                key={entry.id}
                className={`workspace-lookup-result${highlighted === i + 1 ? ' is-highlighted' : ''}`}
              >
                <button
                  type="button"
                  className="workspace-lookup-result-head"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedId(isOpen ? null : entry.id)}
                >
                  <span className="hanzi workspace-lookup-hanzi" lang={hw.primaryLang}>
                    {hw.primary}
                  </span>
                  <span className="caption workspace-lookup-pinyin">
                    {formatPinyin(entry.pinyin, settings.pinyinStyle)}
                  </span>
                  <span className="body-sm workspace-lookup-gloss">
                    {entry.senses[0]?.glosses[0]}
                  </span>
                </button>
                {isOpen && (
                  <div className="workspace-lookup-detail">
                    <SenseList senses={entry.senses} />
                    <Link
                      to={`/entry/${entry.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="body-sm workspace-open-entry"
                    >
                      Open entry ↗
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {phrase && (
        <div className="workspace-in-context">
          <h3 className="caption-uppercase workspace-panel-label">In context</h3>
          {!user ? (
            <p className="caption workspace-sso-caption">
              Sign in for a contextual explanation of this phrase.
            </p>
          ) : explaining ? (
            <p className="body-sm state-note">Reading the context…</p>
          ) : explainError ? (
            <p className="body-sm">
              Couldn't generate an explanation.{' '}
              <button
                type="button"
                className="btn btn-text"
                onClick={() => runExplain(phrase, results)}
              >
                Retry
              </button>
            </p>
          ) : explanation ? (
            <>
              <p className="body-sm">
                {explanation.explanation}
                <CitationMarkers indexes={explanation.sourceIndexes} onCite={handleCite} />
              </p>
              {explanation.suggestedRenderings.length > 0 && (
                <div className="workspace-renderings">
                  {explanation.suggestedRenderings.map((r, i) => (
                    <CopyText
                      key={i}
                      text={r}
                      label="suggested rendering"
                      className="badge caption workspace-rendering-chip"
                    />
                  ))}
                </div>
              )}
              {explanation.sourceIndexes.length === 0 && (
                <p className="caption ai-model-knowledge-note">
                  Includes model knowledge — verify before use.
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GlossaryTab({ onPick }: { onPick: (entry: DictionaryEntry) => void }) {
  const { entries, loading } = useGlossary();
  const { settings } = useSettings();

  if (loading) return <p className="body-md state-note">Loading…</p>;
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="body-sm">
          Nothing saved yet. Stored locally for now; synced to your account once SSO lands.
        </p>
      </div>
    );
  }
  return (
    <ul className="glossary-list workspace-glossary-list">
      {entries.map((entry) => {
        const hw = headwordParts(entry, settings.characterPriority);
        return (
          <li key={entry.id} className="glossary-row">
            <button
              type="button"
              className="glossary-row-main workspace-glossary-row-btn"
              onClick={() => onPick(entry)}
            >
              <span className="glossary-hanzi hanzi" lang={hw.primaryLang}>
                {hw.primary}
              </span>
              <span className="glossary-pinyin body-sm">
                {formatPinyin(entry.pinyin, settings.pinyinStyle)}
              </span>
              <span className="glossary-gloss body-sm">{entry.senses[0]?.glosses[0]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AssistantTab({ activeSegmentSource }: { activeSegmentSource: string }) {
  const { user, initializing, signingIn, signIn } = useSession();
  const { settings } = useSettings();
  const { entries: glossaryEntries } = useGlossary();
  const { showToast } = useToast();
  const [conversation, setConversation] = useState<AiMessageType[]>([]);
  const [draft, setDraft] = useState('');
  const [turnStatus, setTurnStatus] = useState<'idle' | 'pending' | 'error'>('idle');

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || turnStatus === 'pending') return;
    const historySnapshot = conversation;
    setConversation((c) => [...c, { role: 'user', text: trimmed }]);
    setDraft('');
    setTurnStatus('pending');
    try {
      // Fold the active segment's source into the grounding scan so relevant
      // dictionary entries from the document the user is working on are
      // included as sources, even if the question itself is in English.
      const grounding = await buildGrounding(`${trimmed} ${activeSegmentSource}`, null, glossaryEntries);
      const response = await api.chat({
        history: historySnapshot,
        message: trimmed,
        grounding,
        preferences: {
          characterPriority: settings.characterPriority,
          pinyinStyle: settings.pinyinStyle,
        },
      });
      setConversation((c) => [...c, response.message]);
      setTurnStatus('idle');
    } catch {
      setDraft(trimmed);
      setTurnStatus('error');
      showToast("The assistant couldn't respond");
    }
  };

  if (initializing) return <p className="body-md state-note">Loading…</p>;

  if (!user) {
    return (
      <div className="empty-state workspace-compact-gate">
        <p className="body-sm">Sign in to ask the assistant about this document.</p>
        <Button variant="outline" onClick={signIn} disabled={signingIn}>
          {signingIn ? 'Redirecting to SSO…' : 'Sign in'}
        </Button>
      </div>
    );
  }

  return (
    <div className="workspace-assistant-tab">
      <div className="workspace-assistant-messages">
        {conversation.length === 0 && (
          <p className="caption state-note">Ask about this document…</p>
        )}
        {conversation.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ai-user-message body-sm workspace-assistant-user-message">
              {m.text}
            </div>
          ) : (
            <AiReplyCard key={i} message={m} />
          ),
        )}
        {turnStatus === 'pending' && <p className="body-sm state-note">Thinking…</p>}
        {turnStatus === 'error' && (
          <p className="body-sm ai-error-line">Couldn't respond — your message is restored below.</p>
        )}
      </div>
      <AiComposer
        value={draft}
        onChange={setDraft}
        onSend={() => handleSend(draft)}
        disabled={turnStatus === 'pending'}
      />
    </div>
  );
}
