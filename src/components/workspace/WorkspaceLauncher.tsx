import { useEffect, useState } from 'react';
import { api, type RestructuredDocument, type WorkspaceProjectSummary } from '../../api';
import { useSession } from '../../hooks/useSession';
import { hasCJK } from '../../lib/pinyin';
import Badge from '../Badge';
import Button from '../Button';
import { SOURCE_ONLY_DOC_ID, MIXED_DOC_ID } from '../../api/workspaceData';

interface WorkspaceLauncherProps {
  onOpenProject: (id: string, mt?: string) => void;
}

type Stage = 'list' | 'new' | 'confirm';

interface PendingDoc {
  restructured: RestructuredDocument;
}

const PASTE_MAX_CHARS = 20000;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

function goodPercent(counts: WorkspaceProjectSummary['counts']): number {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return total > 0 ? (counts.good / total) * 100 : 0;
}

function progressCaption(counts: WorkspaceProjectSummary['counts']): string {
  const parts: string[] = [];
  if (counts.good) parts.push(`${counts.good} good`);
  if (counts['needs-revision']) parts.push(`${counts['needs-revision']} needs revision`);
  if (counts.draft) parts.push(`${counts.draft} draft`);
  if (counts.untranslated) parts.push(`${counts.untranslated} untranslated`);
  return parts.length > 0 ? parts.join(' · ') : 'No segments';
}

export default function WorkspaceLauncher({ onOpenProject }: WorkspaceLauncherProps) {
  const { user, initializing, signingIn, signIn } = useSession();
  const [stage, setStage] = useState<Stage>('list');
  const [projects, setProjects] = useState<WorkspaceProjectSummary[] | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const [uuid, setUuid] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [restructuring, setRestructuring] = useState(false);

  const [remoteDocName, setRemoteDocName] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDoc | null>(null);
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = () => {
    api.listWorkspaceProjects().then((list) => {
      setProjects(list);
      if (list.length === 0) setStage('new');
    });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      window.setTimeout(() => {
        setConfirmingDeleteId((current) => (current === id ? null : current));
      }, 3000);
      return;
    }
    setConfirmingDeleteId(null);
    await api.deleteWorkspaceProject(id);
    loadProjects();
  };

  const restructureAndConfirm = async (text: string, name: string | null) => {
    setRestructuring(true);
    const restructured = await api.restructureDocument(text);
    setRestructuring(false);
    const first = restructured.paragraphs[0]?.segments[0];
    const firstText = first?.source || first?.target || '';
    setProjectName(name ?? (firstText ? `${firstText.slice(0, 12)}…` : 'Untitled project'));
    setRemoteDocName(name);
    setPending({ restructured });
    setStage('confirm');
  };

  const handleFetch = async () => {
    const id = uuid.trim();
    if (!id) return;
    setFetchError(null);
    setFetching(true);
    const doc = await api.getRemoteDocument(id);
    setFetching(false);
    if (!doc) {
      setFetchError('No document found for this ID.');
      return;
    }
    await restructureAndConfirm(doc.text, doc.name);
  };

  const handlePasteContinue = async () => {
    const text = pasteText.trim();
    if (!text) {
      setPasteError('Paste some text to continue.');
      return;
    }
    if (text.length > PASTE_MAX_CHARS) {
      setPasteError(`That text is too long to paste directly (${PASTE_MAX_CHARS.toLocaleString()} character limit).`);
      return;
    }
    setPasteError(null);
    await restructureAndConfirm(text, null);
  };

  const handleCreate = async (mt: 'none' | 'first5' | 'all') => {
    if (!pending) return;
    setCreating(true);
    const now = new Date().toISOString();
    const paragraphs = pending.restructured.paragraphs.map((p) => ({
      id: crypto.randomUUID(),
      segments: p.segments.map((s) => ({
        id: crypto.randomUUID(),
        source: s.source,
        target: s.target,
        status: (s.target.trim() ? 'draft' : 'untranslated') as 'draft' | 'untranslated',
      })),
    }));
    const project = {
      id: crypto.randomUUID(),
      name: projectName.trim() || 'Untitled project',
      createdAt: now,
      updatedAt: now,
      paragraphs,
    };
    await api.saveWorkspaceProject(project);
    onOpenProject(project.id, mt === 'none' ? undefined : mt);
  };

  if (stage === 'list') {
    return (
      <div className="container page">
        <header className="page-header">
          <div>
            <h1 className="display-lg">Workspace</h1>
            <p className="body-sm page-header-sub">Resume a project or start a new one.</p>
          </div>
          <Button variant="primary" onClick={() => setStage('new')}>
            New project
          </Button>
        </header>

        {projects === null && <p className="body-md state-note">Loading projects…</p>}

        {projects && projects.length > 0 && (
          <div className="workspace-project-grid">
            {projects.map((p) => (
              <div key={p.id} className="workspace-project-card">
                <button
                  type="button"
                  className="workspace-project-card-main"
                  onClick={() => onOpenProject(p.id)}
                >
                  <h3 className="title-md">{p.name}</h3>
                  <p className="caption workspace-project-updated">
                    Updated {formatRelativeTime(p.updatedAt)}
                  </p>
                  <span className="workspace-progress-meter" aria-hidden="true">
                    <span
                      className="workspace-progress-fill"
                      style={{ width: `${goodPercent(p.counts)}%` }}
                    />
                  </span>
                  <p className="body-sm workspace-project-progress">{progressCaption(p.counts)}</p>
                </button>
                <button
                  type="button"
                  className="btn btn-text workspace-project-delete"
                  onClick={() => handleDelete(p.id)}
                >
                  {confirmingDeleteId === p.id ? 'Confirm delete?' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stage === 'new') {
    return (
      <div className="container page page-narrow">
        <header className="page-header">
          <div>
            <h1 className="display-lg">New project</h1>
            <p className="body-sm page-header-sub">
              Fetch a document by ID, or paste source text directly.
            </p>
          </div>
        </header>

        <div className="workspace-new-card">
          <h2 className="title-sm">From a document ID</h2>
          <div className="workspace-fetch-row">
            <input
              type="text"
              className="search-input"
              placeholder="Document UUID"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              aria-label="Document UUID"
            />
            <Button variant="outline" onClick={handleFetch} disabled={fetching || !uuid.trim()}>
              {fetching ? 'Fetching…' : 'Fetch'}
            </Button>
          </div>
          {fetchError && <p className="body-sm workspace-inline-error">{fetchError}</p>}
          <p className="caption workspace-demo-hint">
            Demo IDs: <code>{SOURCE_ONLY_DOC_ID}</code> (source only) ·{' '}
            <code>{MIXED_DOC_ID}</code> (bilingual)
          </p>
        </div>

        <div className="caption-uppercase workspace-or-divider">or</div>

        <div className="workspace-new-card">
          <h2 className="title-sm">Paste text</h2>
          <textarea
            className="search-input workspace-paste-textarea"
            placeholder="Paste Chinese source text, or bilingual source + translation…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            aria-label="Paste document text"
          />
          {pasteError && <p className="body-sm workspace-inline-error">{pasteError}</p>}
          <div className="workspace-new-actions">
            <Button variant="primary" onClick={handlePasteContinue} disabled={restructuring}>
              {restructuring ? 'Analyzing…' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // stage === 'confirm'
  if (!pending) return null;
  const totalSegments = pending.restructured.paragraphs.reduce(
    (sum, p) => sum + p.segments.length,
    0,
  );
  const paragraphCount = pending.restructured.paragraphs.length;
  const untranslatedCount = pending.restructured.paragraphs.reduce(
    (sum, p) => sum + p.segments.filter((s) => !s.target.trim()).length,
    0,
  );
  const noChineseDetected = !pending.restructured.paragraphs.some((p) =>
    p.segments.some((s) => hasCJK(s.source)),
  );
  const canTranslate = Boolean(user) && !initializing;

  return (
    <div className="container page page-narrow">
      <header className="page-header">
        <div>
          <h1 className="display-lg">Ready to go</h1>
        </div>
      </header>

      <div className="workspace-new-card">
        <div className="workspace-detection-row">
          <Badge>{pending.restructured.mode === 'mixed' ? 'Mixed' : 'Source only'}</Badge>
          <span className="caption workspace-detection-caption">
            {pending.restructured.mode === 'mixed'
              ? `MIXED SOURCE AND TARGET — ${totalSegments} aligned pairs in ${paragraphCount} paragraphs`
              : `SOURCE ONLY — ${totalSegments} segments in ${paragraphCount} paragraphs`}
          </span>
        </div>
        {noChineseDetected && (
          <p className="caption workspace-inline-warning">No Chinese text detected.</p>
        )}

        <label className="workspace-name-label caption-uppercase" htmlFor="workspace-project-name">
          Project name
        </label>
        <input
          id="workspace-project-name"
          type="text"
          className="search-input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
        {remoteDocName && (
          <p className="caption workspace-demo-hint">Fetched document: {remoteDocName}</p>
        )}

        {untranslatedCount === 0 ? (
          <div className="workspace-new-actions">
            <Button variant="primary" onClick={() => handleCreate('none')} disabled={creating}>
              {creating ? 'Opening…' : 'Open project'}
            </Button>
          </div>
        ) : (
          <div className="workspace-mt-offer">
            {!canTranslate && (
              <p className="caption workspace-sso-caption">
                Sign in to translate now — you can still skip and translate as you go.{' '}
                <button type="button" className="btn btn-text workspace-sso-signin" onClick={signIn}>
                  Sign in
                </button>
              </p>
            )}
            <div className="workspace-new-actions">
              {totalSegments <= 8 ? (
                <>
                  <Button
                    variant="primary"
                    onClick={() => handleCreate('all')}
                    disabled={creating || !canTranslate}
                  >
                    Translate all now
                  </Button>
                  <Button variant="text" onClick={() => handleCreate('none')} disabled={creating}>
                    Skip — translate as I go
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={() => handleCreate('first5')}
                    disabled={creating || !canTranslate}
                  >
                    Translate first 5 now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCreate('all')}
                    disabled={creating || !canTranslate}
                  >
                    Translate all
                  </Button>
                  <Button variant="text" onClick={() => handleCreate('none')} disabled={creating}>
                    Skip
                  </Button>
                </>
              )}
            </div>
            <p className="caption workspace-mt-caption">
              Starting small gets you post-editing sooner. You can send more segments anytime.
            </p>
          </div>
        )}
        {signingIn && <p className="caption state-note">Redirecting to SSO…</p>}
      </div>
    </div>
  );
}
