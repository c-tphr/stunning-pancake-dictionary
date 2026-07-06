import type { SegmentStatus, WorkspaceProject, WorkspaceSegment } from '../../api';

/**
 * Pure data operations on a WorkspaceProject. Kept separate from
 * WorkspaceEditor so the merge/split/status logic — the parts with real
 * acceptance criteria around exact source-text preservation — can be
 * reasoned about (and unit-tested) independently of React state plumbing.
 */

export function flattenSegments(project: WorkspaceProject): WorkspaceSegment[] {
  return project.paragraphs.flatMap((p) => p.segments);
}

export function updateSegments(
  project: WorkspaceProject,
  ids: ReadonlySet<string>,
  patch: (segment: WorkspaceSegment) => Partial<WorkspaceSegment>,
): WorkspaceProject {
  return {
    ...project,
    paragraphs: project.paragraphs.map((p) => ({
      ...p,
      segments: p.segments.map((s) => (ids.has(s.id) ? { ...s, ...patch(s) } : s)),
    })),
  };
}

/** Mark Good/Needs revision — untranslated/translating segments are left alone (nothing to review). */
export function markReviewStatus(
  project: WorkspaceProject,
  ids: ReadonlySet<string>,
  status: Extract<SegmentStatus, 'good' | 'needs-revision'>,
): WorkspaceProject {
  return updateSegments(project, ids, (s) =>
    s.status === 'untranslated' || s.status === 'translating' ? {} : { status },
  );
}

/**
 * Joins a source segment with the next one in its paragraph. Source
 * concatenates with no separator; targets join with a space. Review state
 * resets (a merged pair needs re-review). No-op on a paragraph's last segment.
 */
export function mergeWithNext(project: WorkspaceProject, segmentId: string): WorkspaceProject {
  return {
    ...project,
    paragraphs: project.paragraphs.map((p) => {
      const idx = p.segments.findIndex((s) => s.id === segmentId);
      if (idx === -1 || idx === p.segments.length - 1) return p;
      const a = p.segments[idx];
      const b = p.segments[idx + 1];
      const mergedTarget = [a.target, b.target]
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' ');
      const merged: WorkspaceSegment = {
        id: a.id,
        source: a.source + b.source,
        target: mergedTarget,
        status: mergedTarget ? 'draft' : 'untranslated',
      };
      return { ...p, segments: [...p.segments.slice(0, idx), merged, ...p.segments.slice(idx + 2)] };
    }),
  };
}

/**
 * Splits a source segment's text at `offset` (character index into `source`).
 * The first half keeps the existing target with status bumped to
 * needs-revision (the alignment is now suspect); the second half starts
 * fresh and untranslated. A no-op at the string's start/end. Source text is
 * preserved exactly across the split (a1.source + a2.source === original).
 */
export function splitAtOffset(
  project: WorkspaceProject,
  segmentId: string,
  offset: number,
): WorkspaceProject {
  return {
    ...project,
    paragraphs: project.paragraphs.map((p) => {
      const idx = p.segments.findIndex((s) => s.id === segmentId);
      if (idx === -1) return p;
      const seg = p.segments[idx];
      if (offset <= 0 || offset >= seg.source.length) return p;
      const first: WorkspaceSegment = {
        id: seg.id,
        source: seg.source.slice(0, offset),
        target: seg.target,
        status: seg.target.trim() ? 'needs-revision' : 'untranslated',
      };
      const second: WorkspaceSegment = {
        id: crypto.randomUUID(),
        source: seg.source.slice(offset),
        target: '',
        status: 'untranslated',
      };
      return { ...p, segments: [...p.segments.slice(0, idx), first, second, ...p.segments.slice(idx + 1)] };
    }),
  };
}

export function countByStatus(project: WorkspaceProject): Record<SegmentStatus, number> {
  const counts: Record<SegmentStatus, number> = {
    untranslated: 0,
    translating: 0,
    draft: 0,
    good: 0,
    'needs-revision': 0,
  };
  for (const segment of flattenSegments(project)) counts[segment.status]++;
  return counts;
}
