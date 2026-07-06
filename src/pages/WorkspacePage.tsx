import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type WorkspaceProject } from '../api';
import { useToast } from '../hooks/useToast';
import WorkspaceLauncher from '../components/workspace/WorkspaceLauncher';
import WorkspaceEditor from '../components/workspace/WorkspaceEditor';

/**
 * Switches between the launcher (no active project) and the editor (active
 * project), keyed off the `?project=` query param so a reload resumes the
 * same project.
 */
export default function WorkspacePage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project');
  const { showToast } = useToast();

  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.getWorkspaceProject(projectId).then((p) => {
      if (cancelled) return;
      if (p) {
        setProject(p);
      } else {
        showToast('Project not found');
        setParams(new URLSearchParams(), { replace: true });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openProject = (id: string, mt?: string) =>
    setParams(mt ? { project: id, mt } : { project: id });
  const closeProject = () => {
    setProject(null);
    setParams(new URLSearchParams(), { replace: true });
  };

  if (loading) {
    return (
      <div className="container page">
        <p className="body-md state-note">Loading…</p>
      </div>
    );
  }

  if (project) {
    return <WorkspaceEditor key={project.id} initialProject={project} onClose={closeProject} />;
  }

  return <WorkspaceLauncher onOpenProject={openProject} />;
}
