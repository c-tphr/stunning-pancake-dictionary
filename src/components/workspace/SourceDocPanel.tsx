import type { WorkspaceProject } from '../../api';

interface SourceDocPanelProps {
  project: WorkspaceProject;
  activeId: string;
  onJump: (segmentId: string) => void;
}

/** Left panel: the full source document as flowing, read-only paragraphs. */
export default function SourceDocPanel({ project, activeId, onJump }: SourceDocPanelProps) {
  return (
    <div className="workspace-source-doc-panel">
      <h2 className="caption-uppercase workspace-panel-label">Source document</h2>
      {project.paragraphs.map((paragraph) => (
        <p key={paragraph.id} className="workspace-source-doc-paragraph hanzi-sans body-md">
          {paragraph.segments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              className={`workspace-source-doc-sentence${segment.id === activeId ? ' is-active' : ''}`}
              onClick={() => onJump(segment.id)}
            >
              {segment.source}
            </button>
          ))}
        </p>
      ))}
    </div>
  );
}
