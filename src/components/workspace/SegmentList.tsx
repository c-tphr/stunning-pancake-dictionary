import type { WorkspaceProject, WorkspaceSegment } from '../../api';
import SegmentEditor from './SegmentEditor';
import SourceText from './SourceText';

export type WorkspaceView = 'target' | 'sentences' | 'paragraphs';

interface SegmentListProps {
  project: WorkspaceProject;
  view: WorkspaceView;
  activeId: string;
  selectedIds: ReadonlySet<string>;
  editingSegmentId: string | null;
  splitOffset: number | null;
  onActivate: (segmentId: string) => void;
  onEditRequest: (segmentId: string) => void;
  onEditConfirm: (segmentId: string, text: string) => void;
  onEditCancel: (segmentId: string, text: string, changed: boolean) => void;
  onWordClick: (word: string, wordStartOffset: number, segmentId: string) => void;
  onSelectionLookup: (phrase: string, segmentId: string) => void;
  onMerge: (segmentId: string) => void;
  registerRef: (segmentId: string, el: HTMLElement | null) => void;
}

const STATUS_GLYPH: Record<WorkspaceSegment['status'], string> = {
  untranslated: '–',
  translating: '',
  draft: 'MT',
  good: '✓',
  'needs-revision': '!',
};

function StatusGutter({ status }: { status: WorkspaceSegment['status'] }) {
  if (status === 'translating') {
    return (
      <span className="workspace-status-gutter workspace-status-translating" aria-label="Translating">
        <svg viewBox="0 0 12 12" aria-hidden="true" className="audio-wave">
          <rect x="1.5" y="3" width="2" height="6" rx="1" fill="currentColor" />
          <rect x="5" y="1.5" width="2" height="9" rx="1" fill="currentColor" />
          <rect x="8.5" y="3" width="2" height="6" rx="1" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`workspace-status-gutter workspace-status-${status} caption-uppercase`}>
      {STATUS_GLYPH[status]}
    </span>
  );
}

export default function SegmentList({
  project,
  view,
  activeId,
  selectedIds,
  editingSegmentId,
  splitOffset,
  onActivate,
  onEditRequest,
  onEditConfirm,
  onEditCancel,
  onWordClick,
  onSelectionLookup,
  onMerge,
  registerRef,
}: SegmentListProps) {
  const renderTarget = (segment: WorkspaceSegment) => {
    if (editingSegmentId === segment.id) {
      return (
        <SegmentEditor
          initialText={segment.target}
          onConfirm={(text) => onEditConfirm(segment.id, text)}
          onCancel={(text, changed) => onEditCancel(segment.id, text, changed)}
        />
      );
    }
    return (
      <button
        type="button"
        className="workspace-target-text body-md"
        onClick={() => {
          onActivate(segment.id);
          onEditRequest(segment.id);
        }}
      >
        {segment.target || <span className="workspace-target-placeholder">Click to translate…</span>}
      </button>
    );
  };

  if (view === 'sentences') {
    return (
      <div className="workspace-sentences">
        {project.paragraphs.map((paragraph) => (
          <div key={paragraph.id} className="workspace-paragraph-group">
            {paragraph.segments.map((segment, i) => (
              <div
                key={segment.id}
                ref={(el) => registerRef(segment.id, el)}
                className={`workspace-sentence-row workspace-status-border-${segment.status}${
                  segment.id === activeId ? ' is-active' : ''
                }${selectedIds.has(segment.id) ? ' is-selected' : ''}`}
                tabIndex={-1}
                aria-label={`Segment ${i + 1}, ${segment.status.replace('-', ' ')}`}
                onClick={() => onActivate(segment.id)}
              >
                <StatusGutter status={segment.status} />
                <div className="workspace-sentence-source">
                  <SourceText
                    text={segment.source}
                    isActive={segment.id === activeId}
                    splitOffset={segment.id === activeId ? splitOffset : null}
                    onWordClick={(word, offset) => onWordClick(word, offset, segment.id)}
                    onSelectionLookup={(phrase) => onSelectionLookup(phrase, segment.id)}
                  />
                </div>
                <div className="workspace-sentence-target">{renderTarget(segment)}</div>
                {i < paragraph.segments.length - 1 && (
                  <button
                    type="button"
                    className="workspace-merge-hint caption"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMerge(segment.id);
                    }}
                    aria-label="Merge with next segment"
                    disabled={segment.status === 'translating'}
                  >
                    ⌄ merge
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (view === 'target') {
    return (
      <div className="workspace-target-view">
        {project.paragraphs.map((paragraph) => (
          <p key={paragraph.id} className="workspace-target-paragraph body-md">
            {paragraph.segments.map((segment) => (
              <span
                key={segment.id}
                ref={(el) => registerRef(segment.id, el)}
                className={`workspace-target-inline${segment.id === activeId ? ' is-active' : ''}`}
              >
                {segment.id === activeId && <StatusGutter status={segment.status} />}
                {renderTarget(segment)}{' '}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }

  // paragraphs view (default)
  return (
    <div className="workspace-paragraphs-view">
      {project.paragraphs.map((paragraph) => (
        <div key={paragraph.id} className="workspace-paragraph-group">
          <p className="workspace-paragraph-source-block hanzi-sans body-md">
            {paragraph.segments.map((segment) => (
              <span
                key={segment.id}
                className={`workspace-segment-span workspace-status-border-${segment.status}${
                  segment.id === activeId ? ' is-active' : ''
                }`}
                onClick={() => onActivate(segment.id)}
              >
                <SourceText
                  text={segment.source}
                  isActive={segment.id === activeId}
                  splitOffset={segment.id === activeId ? splitOffset : null}
                  onWordClick={(word, offset) => onWordClick(word, offset, segment.id)}
                  onSelectionLookup={(phrase) => onSelectionLookup(phrase, segment.id)}
                />
              </span>
            ))}
          </p>
          <p className="workspace-paragraph-target-block body-md">
            {paragraph.segments.map((segment) => (
              <span
                key={segment.id}
                ref={(el) => registerRef(segment.id, el)}
                className={`workspace-target-inline${segment.id === activeId ? ' is-active' : ''}`}
              >
                {renderTarget(segment)}{' '}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}
