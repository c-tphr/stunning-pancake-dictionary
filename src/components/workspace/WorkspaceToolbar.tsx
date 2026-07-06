import { useState } from 'react';
import SegmentedControl from '../SegmentedControl';
import Button from '../Button';
import type { WorkspaceView } from './SegmentList';

interface WorkspaceToolbarProps {
  name: string;
  onRename: (name: string) => void;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onTranslateSelection: () => void;
  onTranslateAllUntranslated: () => void;
  canTranslate: boolean;
  goodCount: number;
  totalCount: number;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  saveStatus: 'saved' | 'saving';
  onShowShortcuts: () => void;
  onClose: () => void;
}

export default function WorkspaceToolbar({
  name,
  onRename,
  view,
  onViewChange,
  onTranslateSelection,
  onTranslateAllUntranslated,
  canTranslate,
  goodCount,
  totalCount,
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
  saveStatus,
  onShowShortcuts,
  onClose,
}: WorkspaceToolbarProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setDraftName(name);
  };

  return (
    <div className="workspace-toolbar">
      <button type="button" className="btn btn-text workspace-toolbar-back" onClick={onClose}>
        ◀ Projects
      </button>

      {renaming ? (
        <input
          type="text"
          className="search-input workspace-rename-input"
          value={draftName}
          autoFocus
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftName(name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="workspace-toolbar-name title-sm"
          onClick={() => {
            setDraftName(name);
            setRenaming(true);
          }}
        >
          {name}
        </button>
      )}

      <SegmentedControl
        aria-label="Editor view"
        value={view}
        onChange={onViewChange}
        options={[
          { value: 'target', label: 'Target' },
          { value: 'sentences', label: 'Sentences' },
          { value: 'paragraphs', label: 'Paragraphs' },
        ]}
      />

      <div className="workspace-toolbar-translate">
        <Button variant="primary" onClick={onTranslateSelection} disabled={!canTranslate}>
          Translate
        </Button>
        <Button variant="outline" onClick={onTranslateAllUntranslated} disabled={!canTranslate}>
          Translate all
        </Button>
      </div>

      <span className="caption workspace-toolbar-progress">
        {goodCount} / {totalCount} good
      </span>

      <div className="workspace-toolbar-panels">
        <button
          type="button"
          className={`workspace-panel-toggle${leftPanelOpen ? ' is-active' : ''}`}
          onClick={onToggleLeftPanel}
          aria-expanded={leftPanelOpen}
          aria-label="Toggle source document panel"
          title="Toggle source document panel ([)"
        >
          ⌸ Source
        </button>
        <button
          type="button"
          className={`workspace-panel-toggle${rightPanelOpen ? ' is-active' : ''}`}
          onClick={onToggleRightPanel}
          aria-expanded={rightPanelOpen}
          aria-label="Toggle reference panel"
          title="Toggle reference panel (])"
        >
          ⌸ Reference
        </button>
      </div>

      <span className="caption workspace-save-status">
        {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
      </span>

      <button
        type="button"
        className="caption workspace-shortcuts-hint"
        onClick={onShowShortcuts}
      >
        Press ? for shortcuts
      </button>
    </div>
  );
}
