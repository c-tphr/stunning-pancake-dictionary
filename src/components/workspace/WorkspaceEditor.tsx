import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type WorkspaceProject } from '../../api';
import { useGlossary } from '../../hooks/useGlossary';
import { useSession } from '../../hooks/useSession';
import { useToast } from '../../hooks/useToast';
import {
  countByStatus,
  flattenSegments,
  markReviewStatus,
  mergeWithNext,
  splitAtOffset,
  updateSegments,
} from './segmentOps';
import SegmentList, { type WorkspaceView } from './SegmentList';
import SourceDocPanel from './SourceDocPanel';
import ReferencePanel from './ReferencePanel';
import WorkspaceToolbar from './WorkspaceToolbar';
import ShortcutsOverlay from './ShortcutsOverlay';

interface WorkspaceEditorProps {
  initialProject: WorkspaceProject;
  onClose: () => void;
}

const AUTOSAVE_DELAY = 800;
type ReferenceTab = 'lookup' | 'glossary' | 'assistant';

export default function WorkspaceEditor({ initialProject, onClose }: WorkspaceEditorProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries: glossaryEntries } = useGlossary();
  const { user } = useSession();
  const { showToast } = useToast();

  const [project, setProject] = useState<WorkspaceProject>(initialProject);
  const flatSegments = useMemo(() => flattenSegments(project), [project]);

  const [activeId, setActiveIdState] = useState(() => flatSegments[0]?.id ?? '');
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>('paragraphs');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [splitOffset, setSplitOffset] = useState<number | null>(null);

  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => window.innerWidth > 1024);
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>('lookup');
  const [lookupPhrase, setLookupPhrase] = useState<string | null>(null);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [announcement, setAnnouncement] = useState('');

  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const isFirstSaveRef = useRef(true);

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const setActiveId = useCallback((id: string, extend: boolean) => {
    setRangeAnchor((anchor) => (extend ? (anchor ?? activeId) : null));
    setActiveIdState(id);
    // A word click bubbles into the row's own onActivate in the same event —
    // don't let re-activating the SAME segment wipe out the split offset that
    // click just set. Only clear it when actually switching segments.
    setSplitOffset((prev) => (id === activeId ? prev : null));
    // Switching segments never leaves an editor open on another segment.
    // Its blur handler commits the text first on any click-driven switch;
    // this guards the remaining non-click paths.
    setEditingSegmentId((cur) => (cur && cur !== id ? null : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const goToIndex = useCallback(
    (index: number, extend: boolean) => {
      if (flatSegments.length === 0) return;
      const clamped = Math.max(0, Math.min(flatSegments.length - 1, index));
      const newId = flatSegments[clamped].id;
      setActiveId(newId, extend);
      rowRefs.current.get(newId)?.scrollIntoView({ block: 'nearest' });
    },
    [flatSegments, setActiveId],
  );

  const activeIndex = flatSegments.findIndex((s) => s.id === activeId);
  const activeSegment = flatSegments[activeIndex >= 0 ? activeIndex : 0];
  const activeParagraph = project.paragraphs.find((p) =>
    p.segments.some((s) => s.id === activeId),
  );

  const lookupContext = useMemo(() => {
    if (!activeSegment) return '';
    if (activeSegment.source.length < 10 && activeParagraph) {
      return activeParagraph.segments.map((s) => s.source).join('');
    }
    return activeSegment.source;
  }, [activeSegment, activeParagraph]);

  const selectedIds = useMemo(() => {
    if (!rangeAnchor) return new Set(activeId ? [activeId] : []);
    const aIdx = flatSegments.findIndex((s) => s.id === rangeAnchor);
    const bIdx = flatSegments.findIndex((s) => s.id === activeId);
    if (aIdx === -1 || bIdx === -1) return new Set([activeId]);
    const [lo, hi] = aIdx <= bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
    return new Set(flatSegments.slice(lo, hi + 1).map((s) => s.id));
  }, [rangeAnchor, activeId, flatSegments]);

  const markStatus = useCallback(
    (status: 'good' | 'needs-revision') => {
      const ids = selectedIds;
      const maxIdx = Math.max(...[...ids].map((id) => flatSegments.findIndex((s) => s.id === id)));
      setProject((proj) => markReviewStatus(proj, ids, status));
      setAnnouncement(`Segment marked ${status === 'good' ? 'good' : 'needs revision'}`);
      goToIndex(maxIdx + 1, false);
    },
    [selectedIds, flatSegments, goToIndex],
  );

  const handleMerge = useCallback((segmentId: string) => {
    setProject((proj) => mergeWithNext(proj, segmentId));
  }, []);

  const handleSplit = useCallback(() => {
    if (splitOffset == null || !activeId) return;
    setProject((proj) => splitAtOffset(proj, activeId, splitOffset));
    setSplitOffset(null);
  }, [activeId, splitOffset]);

  const handleWordClick = useCallback(
    (word: string, wordStartOffset: number, segmentId: string) => {
      if (segmentId === activeId) setSplitOffset(wordStartOffset);
      setLookupPhrase(word);
      setReferenceTab('lookup');
      setRightPanelOpen(true);
    },
    [activeId],
  );

  const handleSelectionLookup = useCallback((phrase: string) => {
    setLookupPhrase(phrase);
    setReferenceTab('lookup');
    setRightPanelOpen(true);
  }, []);

  const translateIds = useCallback(
    async (ids: string[]) => {
      const untranslatedIds = ids.filter(
        (id) => flatSegments.find((s) => s.id === id)?.status === 'untranslated',
      );
      if (untranslatedIds.length === 0) return;
      const idSet = new Set(untranslatedIds);
      setProject((proj) => updateSegments(proj, idSet, () => ({ status: 'translating' })));

      const firstIdx = flatSegments.findIndex((s) => s.id === untranslatedIds[0]);
      const lastIdx = flatSegments.findIndex(
        (s) => s.id === untranslatedIds[untranslatedIds.length - 1],
      );
      const contextBefore = flatSegments
        .slice(Math.max(0, firstIdx - 2), firstIdx)
        .map((s) => [s.source, s.target].filter(Boolean).join(' '))
        .join(' ');
      const contextAfter = flatSegments
        .slice(lastIdx + 1, lastIdx + 3)
        .map((s) => [s.source, s.target].filter(Boolean).join(' '))
        .join(' ');

      try {
        const response = await api.translateSegments({
          segments: untranslatedIds.map((id) => ({
            id,
            source: flatSegments.find((s) => s.id === id)!.source,
          })),
          contextBefore,
          contextAfter,
          glossary: glossaryEntries,
        });
        const byId = new Map(response.translations.map((t) => [t.id, t.target]));
        setProject((proj) =>
          updateSegments(proj, idSet, (s) => {
            const target = byId.get(s.id);
            return target !== undefined
              ? { target, status: 'draft' as const }
              : { status: 'untranslated' as const };
          }),
        );
      } catch {
        setProject((proj) => updateSegments(proj, idSet, () => ({ status: 'untranslated' as const })));
        showToast('Translation failed — the segments were left untouched.');
      }
    },
    [flatSegments, glossaryEntries, showToast],
  );

  const handleEditConfirm = useCallback(
    (segmentId: string, text: string) => {
      setProject((proj) =>
        updateSegments(proj, new Set([segmentId]), () => ({ target: text, status: 'good' })),
      );
      setEditingSegmentId(null);
      const idx = flatSegments.findIndex((s) => s.id === segmentId);
      goToIndex(idx + 1, false);
    },
    [flatSegments, goToIndex],
  );

  const handleEditCancel = useCallback((segmentId: string, text: string, changed: boolean) => {
    setProject((proj) =>
      updateSegments(proj, new Set([segmentId]), () =>
        changed ? { target: text, status: 'good' } : { target: text },
      ),
    );
    setEditingSegmentId(null);
  }, []);

  const handleJump = (segmentId: string) => {
    setActiveId(segmentId, false);
    rowRefs.current.get(segmentId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // One-time auto-translate when arriving from the launcher's MT offer.
  useEffect(() => {
    const mt = searchParams.get('mt');
    if (!mt) return;
    const untranslated = flattenSegments(projectRef.current).filter(
      (s) => s.status === 'untranslated',
    );
    const ids = (mt === 'first5' ? untranslated.slice(0, 5) : untranslated).map((s) => s.id);
    if (ids.length > 0) translateIds(ids);
    const next = new URLSearchParams(searchParams);
    next.delete('mt');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave; flush on unmount / tab close.
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api
        .saveWorkspaceProject({ ...projectRef.current, updatedAt: new Date().toISOString() })
        .then(() => setSaveStatus('saved'));
    }, AUTOSAVE_DELAY);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [project]);

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        api.saveWorkspaceProject({ ...projectRef.current, updatedAt: new Date().toISOString() });
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  // The keyboard-first MTPE layer. Suppressed while typing anywhere or while
  // the shortcuts overlay owns its own Escape/`?` handling.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping || shortcutsOpen) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          goToIndex(activeIndex + 1, e.shiftKey);
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          goToIndex(activeIndex - 1, e.shiftKey);
          break;
        case 'J':
          e.preventDefault();
          goToIndex(activeIndex + 1, true);
          break;
        case 'K':
          e.preventDefault();
          goToIndex(activeIndex - 1, true);
          break;
        case 'g':
          e.preventDefault();
          markStatus('good');
          break;
        case 'r':
          e.preventDefault();
          markStatus('needs-revision');
          break;
        case 'Enter':
        case 'e':
          e.preventDefault();
          if (activeId) setEditingSegmentId(activeId);
          break;
        case 't':
          e.preventDefault();
          translateIds([...selectedIds]);
          break;
        case 'm':
          e.preventDefault();
          if (activeId) handleMerge(activeId);
          break;
        case 's':
          e.preventDefault();
          handleSplit();
          break;
        case 'd': {
          e.preventDefault();
          const sel = window.getSelection()?.toString().trim();
          if (sel) {
            setLookupPhrase(sel);
            setReferenceTab('lookup');
            setRightPanelOpen(true);
          }
          break;
        }
        case '1':
          e.preventDefault();
          setView('target');
          break;
        case '2':
          e.preventDefault();
          setView('sentences');
          break;
        case '3':
          e.preventDefault();
          setView('paragraphs');
          break;
        case '[':
          e.preventDefault();
          setLeftPanelOpen((v) => !v);
          break;
        case ']':
          e.preventDefault();
          setRightPanelOpen((v) => !v);
          break;
        case '?':
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    activeIndex,
    activeId,
    selectedIds,
    goToIndex,
    markStatus,
    translateIds,
    handleMerge,
    handleSplit,
    shortcutsOpen,
  ]);

  const counts = countByStatus(project);

  return (
    <div className="workspace-page">
      <WorkspaceToolbar
        name={project.name}
        onRename={(name) => setProject((proj) => ({ ...proj, name }))}
        view={view}
        onViewChange={setView}
        onTranslateSelection={() => translateIds([...selectedIds])}
        onTranslateAllUntranslated={() =>
          translateIds(flatSegments.filter((s) => s.status === 'untranslated').map((s) => s.id))
        }
        canTranslate={Boolean(user)}
        goodCount={counts.good}
        totalCount={flatSegments.length}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        onToggleLeftPanel={() => setLeftPanelOpen((v) => !v)}
        onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
        saveStatus={saveStatus}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onClose={onClose}
      />
      <div className="workspace-body">
        {leftPanelOpen && (
          <div className="workspace-left-panel">
            <SourceDocPanel project={project} activeId={activeId} onJump={handleJump} />
          </div>
        )}
        <div className="workspace-center-column">
          <div className="workspace-sheet">
            <SegmentList
              project={project}
              view={view}
              activeId={activeId}
              selectedIds={selectedIds}
              editingSegmentId={editingSegmentId}
              splitOffset={splitOffset}
              onActivate={(id) => setActiveId(id, false)}
              onEditRequest={(id) => setEditingSegmentId(id)}
              onEditConfirm={handleEditConfirm}
              onEditCancel={handleEditCancel}
              onWordClick={handleWordClick}
              onSelectionLookup={handleSelectionLookup}
              onMerge={handleMerge}
              registerRef={registerRef}
            />
          </div>
        </div>
        {rightPanelOpen && (
          <div className="workspace-right-panel">
            <ReferencePanel
              phrase={lookupPhrase}
              context={lookupContext}
              activeSegmentSource={activeSegment?.source ?? ''}
              tab={referenceTab}
              onTabChange={setReferenceTab}
              onPhraseChange={(p) => {
                setLookupPhrase(p);
                setReferenceTab('lookup');
              }}
            />
          </div>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
