import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type AiMessage, type DictionaryEntry } from '../api';
import { useSession } from '../hooks/useSession';
import { useSettings } from '../hooks/useSettings';
import { useGlossary } from '../hooks/useGlossary';
import { useToast } from '../hooks/useToast';
import { buildGrounding } from '../ai/grounding';
import { formatPinyin, headwordParts } from '../lib/format';
import Button from '../components/Button';
import AiComposer from '../components/AiComposer';
import AiReplyCard from '../components/AiMessage';

const STARTERS = [
  '应该 vs 应当 in legal drafting',
  'When does 把握 take 有?',
  'Why does 了 appear twice in 我吃了饭了？',
];

type TurnStatus = 'idle' | 'pending' | 'error';

export default function AiPage() {
  const { user, initializing, signingIn, signIn } = useSession();
  const { settings } = useSettings();
  const { entries: glossaryEntries } = useGlossary();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const [focusEntry, setFocusEntry] = useState<DictionaryEntry | null>(null);
  const [conversation, setConversation] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [turnStatus, setTurnStatus] = useState<TurnStatus>('idle');
  const endRef = useRef<HTMLDivElement>(null);

  // Resolve ?entry= once on load / whenever it changes. Invalid ids resolve to
  // null and are silently ignored — no error state for a bad query param.
  useEffect(() => {
    const entryId = params.get('entry');
    if (!entryId) {
      setFocusEntry(null);
      return;
    }
    let cancelled = false;
    api.getEntry(entryId).then((entry) => {
      if (!cancelled) setFocusEntry(entry);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [conversation.length, turnStatus]);

  const clearFocus = () => {
    setFocusEntry(null);
    const next = new URLSearchParams(params);
    next.delete('entry');
    setParams(next, { replace: true });
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || turnStatus === 'pending') return;

    const historySnapshot = conversation;
    setConversation((c) => [...c, { role: 'user', text: trimmed }]);
    setDraft('');
    setTurnStatus('pending');

    try {
      const grounding = await buildGrounding(trimmed, focusEntry, glossaryEntries);
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

  if (initializing) {
    return (
      <div className="container page">
        <PageHeader />
        <p className="body-md state-note">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container page page-narrow">
        <PageHeader />
        <div className="empty-state">
          <p className="display-sm">Sign in to use the assistant.</p>
          <p className="body-sm">
            The AI service authenticates with your SSO certificate — your organization's API
            access is attached to it. Nothing is sent until you're signed in.
          </p>
          <div className="ai-gate-actions">
            <Button variant="outline" onClick={signIn} disabled={signingIn}>
              {signingIn ? 'Redirecting to SSO…' : 'Sign in'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const focusHw = focusEntry ? headwordParts(focusEntry, settings.characterPriority) : null;

  return (
    <div className="container page">
      <PageHeader />

      <div className="ai-chat">
        {conversation.length === 0 ? (
          <div className="ai-empty-state">
            <p className="body-md ai-empty-lede">
              Ask about a term, a distinction between near-synonyms, or a grammar point.
            </p>
            <div className="ai-starters">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="badge caption-uppercase hero-sample"
                  onClick={() => handleSend(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
            {focusEntry && focusHw && (
              <p className="caption ai-focus-caption">
                Asking about <span className="hanzi">{focusHw.primary}</span>{' '}
                {formatPinyin(focusEntry.pinyin, settings.pinyinStyle)}
                <button
                  type="button"
                  className="ai-focus-clear"
                  onClick={clearFocus}
                  aria-label="Clear focused entry"
                >
                  ×
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="ai-message-list" aria-live="polite">
            {conversation.map((message, i) =>
              message.role === 'user' ? (
                <div key={i} className="ai-user-message body-md">
                  {message.text}
                </div>
              ) : (
                <AiReplyCard key={i} message={message} />
              ),
            )}
            {turnStatus === 'pending' && (
              <p className="body-md state-note ai-thinking">Thinking…</p>
            )}
            {turnStatus === 'error' && (
              <p className="body-sm ai-error-line">
                The assistant couldn't respond. Your message wasn't lost — try sending again.
              </p>
            )}
            <div ref={endRef} />
          </div>
        )}

        <AiComposer
          value={draft}
          onChange={setDraft}
          onSend={() => handleSend(draft)}
          disabled={turnStatus === 'pending'}
        />
        <p className="caption ai-footer-caption">
          AI explanations can be wrong — verify against the cited sources before you publish.
        </p>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="page-header">
      <div>
        <h1 className="display-lg">AI assistant</h1>
        <p className="body-sm page-header-sub">
          Term and grammar help, grounded in the dictionary and your glossary.
        </p>
      </div>
    </header>
  );
}
