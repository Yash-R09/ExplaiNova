import { ProjectError } from './project-contract.ts';

export function planningInput(value: unknown) {
  const invalid = () => new ProjectError('VALIDATION_FAILED', 422, 'Enter a brainstorming message and select a saved draft revision.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const input = value as Record<string, unknown>;
  const allowed = ['expectedRevision', 'mode', 'message', 'referenceText', 'baseStoryboardId'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw invalid();

  const { expectedRevision, mode, message, referenceText, baseStoryboardId } = input;
  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) ||
      expectedRevision < 1 || expectedRevision > 2147483647 || mode !== 'brainstorm' ||
      typeof message !== 'string' || !message.trim() || message.length > 4000 ||
      (referenceText !== undefined && (typeof referenceText !== 'string' || referenceText.length > 20000)) ||
      (baseStoryboardId !== undefined && baseStoryboardId !== null)) throw invalid();

  return { expectedRevision, mode, message: message.trim(), referenceText: referenceText ?? '', baseStoryboardId: null };
}
