import { validateStoryboardCandidate, type StoryboardCandidate } from './storyboard-candidate.ts';
import type { StoryboardDocument } from './storyboard-contract.ts';

type StoragePort = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
type Content = StoryboardCandidate;
type Operation = { key: string; revision: number; content: Content };
type Backup = { version: 1; revision: number; content: Content; operation: Operation | null; updatedAt: string };
type Recovery = { key: string; raw: string; backup: Backup };
type Status = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict' | 'recovery';
export type StoryboardAutosaveView = {
  saved: StoryboardDocument; content: Content; revision: number; status: Status; dirty: boolean;
  message: string; storageWarning: boolean; recoveries: Recovery[];
  remote: StoryboardDocument | null; comparing: boolean;
};
type Options = {
  initial: StoryboardDocument; ownerId: string; storage: StoragePort | null; online: boolean;
  transport: typeof fetch; notify: (view: StoryboardAutosaveView) => void; debounceMs?: number;
};

const revisionNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;
const strings = (value: unknown) => Array.isArray(value) && value.length <= 6 && value.every(item => typeof item === 'string');

// Local edits may contain empty text or narration that cannot yet fit the target.
function isWorkingCopy(value: unknown, duration: number): value is Content {
  if (!value || typeof value !== 'object') return false;
  const copy = value as Partial<Content>;
  return copy.targetDurationMs === duration && typeof copy.title === 'string' && typeof copy.theme === 'string'
    && strings(copy.reviewNotes) && Array.isArray(copy.scenes) && copy.scenes.length >= 4 && copy.scenes.length <= 10
    && copy.scenes.every(scene => scene && [scene.title, scene.type, scene.purpose, scene.narration, scene.motion]
      .every(field => typeof field === 'string') && strings(scene.objects) && strings(scene.labels)
      && Number.isInteger(scene.startMs) && Number.isInteger(scene.durationMs));
}

function snapshot(content: Content) {
  return JSON.stringify([content.title, content.theme, content.reviewNotes,
    content.scenes.map(scene => [scene.title, scene.type, scene.purpose, scene.narration, scene.objects, scene.labels, scene.motion])]);
}

function readBackup(raw: string, duration: number): Backup | null {
  try {
    if (raw.length > 150000) return null;
    const backup = JSON.parse(raw) as Backup;
    if (backup?.version !== 1 || !revisionNumber(backup.revision) || !Number.isFinite(Date.parse(backup.updatedAt))
      || !isWorkingCopy(backup.content, duration)) return null;
    const operation = backup.operation;
    if (operation !== null && (!operation || operation.revision !== backup.revision
      || typeof operation.key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(operation.key)
      || !isWorkingCopy(operation.content, duration))) return null;
    return backup;
  } catch { return null; }
}

export class StoryboardAutosave {
  private saved: StoryboardDocument;
  private content: Content;
  private revision: number;
  private status: Status = 'saved';
  private message = '';
  private storageWarning = false;
  private recoveries: Recovery[] = [];
  private restored: Recovery | null = null;
  private operation: Operation | null = null;
  private remote: StoryboardDocument | null = null;
  private comparing = false;
  private online: boolean;
  private disposed = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | null = null;
  private readonly key: string;
  private readonly endpoint: string;
  private readonly options: Options;

  constructor(options: Options) {
    this.options = options;
    const { initial, ownerId, storage } = options;
    this.saved = initial;
    this.content = initial.content;
    this.revision = initial.revision;
    this.online = options.online;
    this.endpoint = `/api/v1/storyboards/${initial.id}`;
    const prefix = `explainova:storyboard:v1:${ownerId}:${initial.id}:`;
    this.key = prefix + crypto.randomUUID();
    this.storageWarning = !storage;
    try {
      for (let index = 0; storage && index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const raw = storage.getItem(key);
        if (!raw) continue;
        const backup = readBackup(raw, initial.content.targetDurationMs);
        if (backup && (backup.operation || snapshot(backup.content) !== snapshot(initial.content))) {
          this.recoveries.push({ key, raw, backup });
        }
      }
    } catch { this.storageWarning = true; }
    this.recoveries.sort((a, b) => b.backup.updatedAt.localeCompare(a.backup.updatedAt));
    if (this.recoveries.length) this.status = 'recovery';
  }

  view(): StoryboardAutosaveView {
    return {
      saved: this.saved, content: this.content, revision: this.revision, status: this.status, dirty: this.dirty(),
      message: this.message, storageWarning: this.storageWarning, recoveries: this.recoveries,
      remote: this.remote, comparing: this.comparing,
    };
  }

  private dirty() { return !!this.operation || snapshot(this.content) !== snapshot(this.saved.content); }
  private emit() { if (!this.disposed) this.options.notify(this.view()); }
  private cancel() { clearTimeout(this.timer); this.timer = undefined; }
  private schedule(delay = this.options.debounceMs ?? 900) {
    this.cancel();
    if (!this.disposed) this.timer = setTimeout(() => void this.flush(), delay);
  }

  private removeUnchanged(recovery: Recovery) {
    const storage = this.options.storage;
    if (storage?.getItem(recovery.key) === recovery.raw) storage.removeItem(recovery.key);
  }

  private persist() {
    const storage = this.options.storage;
    if (!storage) return;
    try {
      if (this.dirty()) {
        const backup: Backup = { version: 1, revision: this.revision, content: this.content,
          operation: this.operation, updatedAt: new Date().toISOString() };
        storage.setItem(this.key, JSON.stringify(backup));
      } else storage.removeItem(this.key);
      if (this.restored) this.removeUnchanged(this.restored);
      this.restored = null;
    } catch { this.storageWarning = true; }
  }

  change(edit: (content: Content) => Content) {
    if (this.disposed || this.status === 'recovery') return;
    this.content = edit(this.content);
    this.persist();
    if (!this.request && this.status !== 'conflict') {
      this.failures = 0;
      this.message = '';
      this.status = this.dirty() ? this.online ? 'pending' : 'offline' : 'saved';
      if (this.status === 'pending') this.schedule();
      else this.cancel();
    }
    this.emit();
  }

  connectivity(online: boolean) {
    this.online = online;
    if (this.disposed || this.request || !this.dirty() || this.status === 'conflict' || this.status === 'recovery') return;
    this.status = online ? 'pending' : 'offline';
    this.message = '';
    this.failures = 0;
    if (online) this.schedule(0);
    else this.cancel();
    this.emit();
  }

  restore(key: string) {
    if (this.status !== 'recovery') return;
    const recovery = this.recoveries.find(item => item.key === key);
    if (!recovery) return;
    this.restored = recovery;
    const { backup } = recovery;
    this.content = backup.content;
    this.operation = backup.operation;
    this.revision = backup.revision;
    if (!this.operation && this.revision !== this.saved.revision) {
      this.status = 'conflict';
      this.remote = this.saved;
      this.message = 'The storyboard changed since this local copy was saved. Compare both versions before continuing.';
    } else this.status = this.online ? 'pending' : 'offline';
    this.persist();
    this.emit();
    if (this.status === 'pending') this.schedule();
  }

  discardRecoveries() {
    if (this.status !== 'recovery') return;
    try { for (const recovery of this.recoveries) this.removeUnchanged(recovery); }
    catch { this.storageWarning = true; }
    this.recoveries = [];
    this.status = 'saved';
    this.emit();
  }

  async flush() {
    if (this.disposed || this.request || this.status === 'conflict' || this.status === 'recovery' || !this.dirty()) return;
    this.cancel();
    if (!this.online) { this.status = 'offline'; this.emit(); return; }
    const sent = this.content;
    if (!this.operation) {
      const validated = validateStoryboardCandidate(sent, this.saved.content.targetDurationMs);
      if (!validated) {
        this.status = 'error';
        this.message = 'Check the scene fields and shorten narration that cannot fit the target length.';
        this.emit();
        return;
      }
      this.operation = { key: crypto.randomUUID(), revision: this.revision, content: validated };
    }
    const operation = this.operation;
    const request = new AbortController();
    this.request = request;
    this.status = 'saving';
    this.message = '';
    this.persist();
    this.emit();
    try {
      const response = await this.options.transport(this.endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation.key },
        body: JSON.stringify({ expectedRevision: operation.revision, content: operation.content }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      const payload = await response.json();
      if (this.disposed) return;
      if (!response.ok) {
        if (response.status >= 500) throw new Error();
        this.operation = null;
        this.status = payload.error?.code === 'REVISION_CONFLICT' || payload.error?.code === 'IDEMPOTENCY_CONFLICT' ? 'conflict' : 'error';
        this.message = payload.error?.message ?? 'Saving paused. Your edits are still here.';
        this.persist();
        return;
      }
      const document = this.document(payload.data);
      if (!document || document.revision !== operation.revision + 1
        || snapshot(document.content) !== snapshot(operation.content)) throw new Error();
      const unchanged = this.content === sent
        && snapshot(validateStoryboardCandidate(sent, this.saved.content.targetDurationMs) ?? sent) === snapshot(operation.content);
      this.operation = null;
      this.failures = 0;
      this.revision = document.revision;
      if (this.saved.revision > document.revision && !unchanged) {
        this.remote = this.saved;
        this.status = 'conflict';
        this.message = 'A newer storyboard exists. Compare before saving these edits.';
      } else {
        if (document.revision >= this.saved.revision) this.saved = document;
        this.revision = this.saved.revision;
        if (unchanged) this.content = this.saved.content;
        this.status = this.dirty() ? this.online ? 'pending' : 'offline' : 'saved';
      }
      this.persist();
    } catch {
      if (this.disposed) return;
      this.failures++;
      this.status = this.online ? 'error' : 'offline';
      this.message = this.online ? 'Save not confirmed. Retrying uses the same request.' : 'You’re offline. Changes are kept in this browser.';
      this.persist();
    } finally {
      this.request = null;
      this.emit();
      if (this.status === 'pending') this.schedule(0);
      else if (this.operation && this.status === 'error' && this.failures < 4) this.schedule(1000 * 2 ** (this.failures - 1));
    }
  }

  private document(value: unknown): StoryboardDocument | null {
    const document = value as Partial<StoryboardDocument> | null;
    const { initial } = this.options;
    return document?.id === initial.id && document.projectId === initial.projectId
      && document.projectRevision === initial.projectRevision && revisionNumber(document.revision)
      && typeof document.revisionId === 'string' && isWorkingCopy(document.content, initial.content.targetDurationMs)
      ? document as StoryboardDocument : null;
  }

  async compare() {
    if (this.disposed || this.request || this.status !== 'conflict') return;
    const request = new AbortController();
    this.request = request;
    this.comparing = true;
    this.emit();
    try {
      const response = await this.options.transport(this.endpoint, { cache: 'no-store',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]) });
      const document = this.document((await response.json()).data);
      if (!response.ok || !document) throw new Error();
      if (!this.disposed) this.remote = document;
    } catch {
      if (!this.disposed) this.message = 'Could not load the saved storyboard. Your edits are still here.';
    } finally {
      this.request = null;
      this.comparing = false;
      this.emit();
    }
  }

  resolve(choice: 'saved' | 'local') {
    if (!this.remote || this.comparing || this.status !== 'conflict') return;
    this.saved = this.remote;
    this.revision = this.remote.revision;
    this.remote = null;
    this.message = '';
    if (choice === 'saved') this.content = this.saved.content;
    this.status = this.dirty() ? this.online ? 'pending' : 'offline' : 'saved';
    this.persist();
    this.emit();
    if (this.status === 'pending') void this.flush();
  }

  dispose() {
    this.disposed = true;
    this.cancel();
    this.request?.abort();
  }
}
