import { ProjectError } from './project-contract.ts';
import { validateStoryboardCandidate, type StoryboardCandidate } from './storyboard-candidate.ts';
import type { DraftSettings } from './draft-preferences.ts';

export type StoryboardDocument = {
  id: string;
  projectId: string;
  projectRevision: number;
  revisionId: string;
  revision: number;
  content: StoryboardCandidate;
  sourceSettings: DraftSettings | null;
  approval?: StoryboardApproval;
};

export type StoryboardApproval = {
  id: string; revisionId: string; revision: number; contentHash: string; approvedAt: string;
};

export function storyboardEdit(value: unknown, targetDurationMs: number) {
  const invalid = () => new ProjectError('VALIDATION_FAILED', 422, 'Check the scene fields and shorten narration that cannot fit the target length.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const { expectedRevision, content, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length || typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)
    || expectedRevision < 1 || expectedRevision > 2147483646) throw invalid();
  const validated = validateStoryboardCandidate(content, targetDurationMs);
  if (!validated) throw invalid();
  return { expectedRevision, content: validated };
}
