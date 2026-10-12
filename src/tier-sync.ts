import { COLLECTION_IDS, COLLECTIONS, type CollectionId } from './collections';
import { createBoard, parseBoard } from './domain';
import { CloudConflictError, type CloudAdapter, type CloudUser, type RemoteBoard } from './sync-types';
import type { Board } from './types';

export type SyncStatus = 'local' | 'loading' | 'saved' | 'syncing' | 'offline' | 'conflict' | 'error';
export interface BoardConflict { local: Board; remote: Board | null; kind: 'import' | 'concurrent' }
export interface CollectionSync { status: SyncStatus; error: string; localError: string; conflict: BoardConflict | null }
export interface SyncSnapshot {
  mode: 'loading' | 'unavailable' | 'guest' | 'signed-in'; user: CloudUser | null; authBusy: boolean; authError: string; session: number;
  boards: Record<CollectionId, Board>; collections: Record<CollectionId, CollectionSync>;
}
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface AccountCache { version: 1; board: Board; revision: number; basePayload: string | null; pending: boolean; needsDecision: boolean }
interface Context {
  revision: number; basePayload: string | null; dirty: boolean; known: boolean; cached: boolean; needsDecision: boolean;
  guest: Board; cacheKey: string; cacheWarning: string; decision: number; latestRemote?: RemoteBoard | null; stop?: () => void; timer?: ReturnType<typeof setTimeout>; running: boolean; writeId?: string; listenEpoch: number;
}
export const accountStorageKey = (uid: string, collection: CollectionId) => `my-tier.account.v1.${encodeURIComponent(uid)}.${collection}`;
const payload = (board: Board) => JSON.stringify(board);
const same = (a: Board, b: Board) => payload(a) === payload(b);
const meaningful = (board: Board, collection: CollectionId) => !same(board, createBoard(collection));
const validBoard = (value: unknown, collection: CollectionId) => { const board = parseBoard(value); return board && (board.collection ?? 'korean') === collection ? board : null; };
function message(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('permission-denied')) return '계정의 티어에 접근할 수 없어요. 연결 설정을 확인해 주세요.';
  if (code.includes('popup-blocked')) return '브라우저의 팝업 차단을 해제한 뒤 다시 로그인해 주세요.';
  if (code.includes('unauthorized-domain') || code.includes('operation-not-allowed')) return '구글 로그인 연결 설정을 확인해야 해요.';
  if (code.includes('network') || code.includes('unavailable')) return '연결하지 못했어요. 이 기기의 변경은 보관하고 다시 연결하겠습니다.';
  return error instanceof Error ? error.message : '동기화하지 못했어요. 다시 시도해 주세요.';
}

export class TierSyncStore {
  private snapshot: SyncSnapshot;
  private subscribers = new Set<() => void>();
  private adapter: CloudAdapter | null = null;
  private stopAuth?: () => void;
  private contexts = new Map<CollectionId, Context>();
  private guestBoards: Record<CollectionId, Board>;
  private guestErrors: Record<CollectionId, string>;
  private online = true;
  private authOperation = 0;
  private authEpoch = 0;
  private serial = 0;
  private readonly device = globalThis.crypto.randomUUID();
  constructor(private storage: StorageLike, private debounceMs = 600) {
    const loaded = Object.fromEntries(COLLECTION_IDS.map(collection => [collection, this.loadGuest(collection)])) as Record<CollectionId, { board: Board; error: string }>;
    this.guestBoards = { korean: loaded.korean.board, global: loaded.global.board };
    this.guestErrors = { korean: loaded.korean.error, global: loaded.global.error };
    this.snapshot = { mode: 'loading', user: null, authBusy: false, authError: '', session: 0, boards: this.guestBoards,
      collections: Object.fromEntries(COLLECTION_IDS.map(collection => [collection, { status: 'local', error: loaded[collection].error, localError: loaded[collection].error, conflict: null }])) as SyncSnapshot['collections'] };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.subscribers.add(listener); return () => { this.subscribers.delete(listener); }; };
  private emit(patch: Partial<SyncSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.subscribers.forEach(listener => listener()); }
  private setCollection(collection: CollectionId, patch: Partial<CollectionSync>, board?: Board) {
    this.emit({ collections: { ...this.snapshot.collections, [collection]: { ...this.snapshot.collections[collection], ...patch } }, ...(board ? { boards: { ...this.snapshot.boards, [collection]: board } } : {}) });
  }
  private loadGuest(collection: CollectionId) {
    try {
      const saved = this.storage.getItem(COLLECTIONS[collection].storageKey);
      if (!saved) return { board: createBoard(collection), error: '' };
      const board = validBoard(JSON.parse(saved), collection);
      return { board: board ?? createBoard(collection), error: board ? '' : '저장된 티어를 읽지 못했어요. 저장 파일이 있다면 불러와 주세요.' };
    } catch { return { board: createBoard(collection), error: '브라우저 저장소를 읽지 못했어요. 저장 파일로 보관해 주세요.' }; }
  }
  private loadCache(uid: string, collection: CollectionId): { cache: AccountCache | null; key: string; warning: string } {
    const key = accountStorageKey(uid, collection), working = `${key}.working`;
    const parse = (raw: string): AccountCache | null => {
      const data = JSON.parse(raw) as AccountCache, board = validBoard(data.board, collection);
      if (data.version !== 1 || !board || !Number.isSafeInteger(data.revision) || data.revision < 0 || typeof data.pending !== 'boolean' || typeof data.needsDecision !== 'boolean') return null;
      if (data.basePayload !== null && (typeof data.basePayload !== 'string' || !validBoard(JSON.parse(data.basePayload), collection))) return null;
      return { ...data, board };
    };
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return { cache: null, key, warning: '' };
      let cache: AccountCache | null = null;
      try { cache = parse(raw); } catch { /* Keep the original unreadable cache untouched. */ }
      if (cache) return { cache, key, warning: '' };
      const recovered = this.storage.getItem(working);
      if (recovered) { try { cache = parse(recovered); } catch { /* Preserve both unreadable copies. */ } }
      if (!cache) {
        try {
          const board = validBoard(JSON.parse(raw).board, collection);
          if (board) cache = { version: 1, board, revision: 0, basePayload: null, pending: true, needsDecision: true };
        } catch { /* Original content remains under its original key. */ }
      }
      return { cache, key: working, warning: '이 기기의 계정 저장 기록 일부를 읽지 못해 원본을 보존했어요. 중요한 티어는 파일로 보관해 주세요.' };
    } catch { return { cache: null, key: working, warning: '이 기기의 계정 저장 기록을 읽지 못했어요. 저장 파일로 보관해 주세요.' }; }
  }
  start(adapter: CloudAdapter | null) {
    const epoch = ++this.authEpoch;
    this.stopAuth?.(); this.stopBoards(); this.adapter = adapter;
    if (!adapter) { this.onUser(null); this.emit({ mode: 'unavailable' }); return; }
    this.emit({ mode: 'loading', authError: '' });
    this.stopAuth = adapter.subscribeUser(user => { if (epoch === this.authEpoch) this.onUser(user); }, error => { if (epoch === this.authEpoch) this.emit({ authError: message(error), authBusy: false }); });
  }
  setConfigurationError(error: unknown) { this.emit({ mode: 'unavailable', authError: message(error) }); }
  private stopBoards() { this.contexts.forEach(context => { context.stop?.(); clearTimeout(context.timer); }); this.contexts.clear(); }
  dispose() { this.authEpoch++; this.authOperation++; this.stopAuth?.(); this.stopBoards(); }
  private onUser(user: CloudUser | null) {
    if (user && user.uid === this.snapshot.user?.uid && this.snapshot.mode === 'signed-in' && this.contexts.size === COLLECTION_IDS.length) { this.emit({ user, authBusy: false, authError: '' }); return; }
    if (!user && !this.snapshot.user) { this.emit({ mode: 'guest', authBusy: false, authError: '' }); return; }
    this.stopBoards();
    const session = this.snapshot.session + 1;
    if (!user) {
      this.emit({ mode: 'guest', user: null, session, authBusy: false, authError: '', boards: this.guestBoards,
        collections: Object.fromEntries(COLLECTION_IDS.map(collection => [collection, { status: 'local', error: this.guestErrors[collection], localError: this.guestErrors[collection], conflict: null }])) as SyncSnapshot['collections'] });
      return;
    }
    const boards = { ...this.snapshot.boards }, collections = { ...this.snapshot.collections };
    for (const collection of COLLECTION_IDS) {
      const loaded = this.loadCache(user.uid, collection), cache = loaded.cache;
      boards[collection] = cache?.board ?? this.guestBoards[collection];
      collections[collection] = { status: this.online ? 'loading' : 'offline', error: '', localError: loaded.warning, conflict: null };
      this.contexts.set(collection, { revision: cache?.revision ?? 0, basePayload: cache?.basePayload ?? null, dirty: cache?.pending ?? false, known: false,
        cached: !!cache, needsDecision: cache?.needsDecision ?? false, guest: this.guestBoards[collection], cacheKey: loaded.key, cacheWarning: loaded.warning, decision: 0, running: false, listenEpoch: 0 });
    }
    this.emit({ mode: 'signed-in', user, session, authBusy: false, authError: '', boards, collections });
    COLLECTION_IDS.forEach(collection => this.listen(collection));
  }
  private active(uid: string, session: number, collection: CollectionId, context: Context) {
    return this.snapshot.user?.uid === uid && this.snapshot.session === session && this.contexts.get(collection) === context;
  }
  private persist(collection: CollectionId) {
    const user = this.snapshot.user, context = this.contexts.get(collection), board = this.snapshot.boards[collection];
    try {
      if (user && context) {
        const cache: AccountCache = { version: 1, board, revision: context.revision, basePayload: context.basePayload, pending: context.dirty, needsDecision: context.needsDecision };
        this.storage.setItem(context.cacheKey, JSON.stringify(cache));
      } else { this.storage.setItem(COLLECTIONS[collection].storageKey, payload(board)); this.guestErrors[collection] = ''; }
      if (this.snapshot.collections[collection].localError !== (context?.cacheWarning ?? '')) this.setCollection(collection, { localError: context?.cacheWarning ?? '' });
    } catch { const error = '이 기기에 저장하지 못했어요. 저장 파일로 보관해 주세요.'; if (!user) this.guestErrors[collection] = error; this.setCollection(collection, { localError: error }); }
  }
  updateBoard(collection: CollectionId, update: Board | ((current: Board) => Board)) {
    const previous = this.snapshot.boards[collection];
    const board = typeof update === 'function' ? update(previous) : update;
    if (board === previous || same(board, previous)) return;
    if ((board.collection ?? 'korean') !== collection) throw new Error('다른 티어표의 내용은 저장할 수 없어요.');
    const context = this.contexts.get(collection);
    if (!this.snapshot.user || !context) {
      this.guestBoards = { ...this.guestBoards, [collection]: board };
      this.setCollection(collection, { status: 'local', error: '' }, board); this.persist(collection); return;
    }
    context.dirty = true;
    const conflict = this.snapshot.collections[collection].conflict;
    this.setCollection(collection, { status: conflict ? 'conflict' : this.online ? 'syncing' : 'offline', error: '', ...(conflict ? { conflict: { ...conflict, local: board } } : {}) }, board);
    this.persist(collection); this.schedule(collection);
  }
  private listen(collection: CollectionId) {
    const user = this.snapshot.user, context = this.contexts.get(collection), adapter = this.adapter;
    if (!user || !context || !adapter) return;
    context.stop?.(); const epoch = ++context.listenEpoch, session = this.snapshot.session;
    context.stop = adapter.subscribeBoard(user.uid, collection, (remote, fromCache) => {
      if (!this.active(user.uid, session, collection, context) || context.listenEpoch !== epoch || fromCache) return;
      this.receive(collection, context, remote);
    }, error => {
      if (!this.active(user.uid, session, collection, context) || context.listenEpoch !== epoch) return;
      this.setCollection(collection, { status: this.online ? 'error' : 'offline', error: message(error) });
    });
  }
  private accept(collection: CollectionId, context: Context, remote: RemoteBoard) {
    context.revision = remote.revision; context.basePayload = payload(remote.board); context.latestRemote = remote; context.known = true; context.cached = true;
    context.dirty = false; context.needsDecision = false;
    this.setCollection(collection, { status: 'saved', error: '', conflict: null }, remote.board); this.persist(collection);
  }
  private conflict(collection: CollectionId, context: Context, remote: RemoteBoard | null, kind: BoardConflict['kind'] = 'concurrent') {
    context.known = true; context.dirty = true; context.needsDecision = true;
    // Preserve the old base until the user chooses. Unresolved decisions survive logout/reload.
    this.setCollection(collection, { status: 'conflict', error: '', conflict: { local: this.snapshot.boards[collection], remote: remote?.board ?? null, kind } });
    this.persist(collection);
  }
  private receive(collection: CollectionId, context: Context, remote: RemoteBoard | null) {
    const board = this.snapshot.boards[collection];
    if (remote && (!Number.isSafeInteger(remote.revision) || remote.revision < 1 || !validBoard(remote.board, collection))) {
      this.setCollection(collection, { status: 'error', error: '저장된 티어 형식이 올바르지 않아 그대로 보존했어요.' }); return;
    }
    if (remote && remote.revision < Math.max(context.latestRemote?.revision ?? 0, context.revision)) return;
    context.latestRemote = remote;
    if (remote && same(remote.board, board)) { this.accept(collection, context, remote); return; }
    if (remote?.writeId && remote.writeId === context.writeId) {
      context.revision = remote.revision; context.basePayload = payload(remote.board); context.known = true;
      this.persist(collection); this.schedule(collection); return;
    }
    if (context.needsDecision) { this.conflict(collection, context, remote, this.snapshot.collections[collection].conflict?.kind); return; }
    if (!context.known && !context.cached && !context.dirty && remote && meaningful(context.guest, collection)) { this.conflict(collection, context, remote, 'import'); return; }
    if (context.dirty) {
      const unchanged = remote ? remote.revision === context.revision && payload(remote.board) === context.basePayload : context.revision === 0 && context.basePayload === null;
      if (!unchanged) { this.conflict(collection, context, remote); return; }
      context.known = true; this.schedule(collection); return;
    }
    if (remote) { this.accept(collection, context, remote); return; }
    if (context.revision > 0) { this.conflict(collection, context, null); return; }
    context.known = true; context.dirty = true;
    this.setCollection(collection, { status: this.online ? 'syncing' : 'offline', error: '' }); this.persist(collection); this.schedule(collection);
  }
  private schedule(collection: CollectionId) {
    const context = this.contexts.get(collection);
    if (!context || !context.dirty || !context.known || context.needsDecision || context.running || !this.online) return;
    clearTimeout(context.timer); context.timer = setTimeout(() => void this.save(collection, context), this.debounceMs);
  }
  private async save(collection: CollectionId, context: Context) {
    const user = this.snapshot.user, adapter = this.adapter, session = this.snapshot.session;
    if (!user || !adapter || !this.active(user.uid, session, collection, context) || context.needsDecision || !context.dirty || !this.online) return;
    context.running = true; context.writeId = `${this.device}_${++this.serial}`;
    const sent = this.snapshot.boards[collection], sentPayload = payload(sent), writeId = context.writeId, decision = context.decision;
    this.setCollection(collection, { status: 'syncing', error: '' });
    try {
      const remote = await adapter.writeBoard(user.uid, collection, sent, context.revision, writeId);
      if (!this.active(user.uid, session, collection, context)) return;
      if (decision !== context.decision) return;
      if (context.latestRemote && context.latestRemote.revision > remote.revision) { this.receive(collection, context, context.latestRemote); return; }
      context.revision = remote.revision; context.basePayload = payload(remote.board); context.known = true; context.cached = true;
      if (payload(this.snapshot.boards[collection]) === sentPayload) this.accept(collection, context, remote);
      else { context.dirty = true; this.persist(collection); }
    } catch (error) {
      if (!this.active(user.uid, session, collection, context)) return;
      if (decision !== context.decision) return;
      if (error instanceof CloudConflictError) {
        const remote = context.latestRemote && context.latestRemote.revision > (error.remote?.revision ?? 0) ? context.latestRemote : error.remote;
        if (remote && same(remote.board, this.snapshot.boards[collection])) this.accept(collection, context, remote);
        else this.conflict(collection, context, remote);
      } else { this.setCollection(collection, { status: this.online ? 'error' : 'offline', error: message(error) }); this.persist(collection); }
    } finally {
      context.running = false; context.writeId = undefined;
      if (this.active(user.uid, session, collection, context) && this.snapshot.collections[collection].status === 'syncing') this.schedule(collection);
    }
  }
  resolve(collection: CollectionId, choice: 'local' | 'cloud') {
    const context = this.contexts.get(collection), conflict = this.snapshot.collections[collection].conflict;
    if (!context || !conflict) return;
    context.decision++;
    // Fetch a fresh server snapshot before committing a decision; it may have changed while the dialog was open.
    context.stop?.(); const session = this.snapshot.session, uid = this.snapshot.user!.uid, epoch = ++context.listenEpoch;
    this.setCollection(collection, { status: 'loading' });
    context.stop = this.adapter!.subscribeBoard(uid, collection, (remote, fromCache) => {
      if (!this.active(uid, session, collection, context) || epoch !== context.listenEpoch || fromCache) return;
      if (choice === 'cloud') {
        if (!remote) { this.conflict(collection, context, null); return; }
        this.accept(collection, context, remote);
      } else {
        if (!!conflict.remote !== !!remote || (conflict.remote && remote && !same(conflict.remote, remote.board))) {
          this.conflict(collection, context, remote, conflict.kind);
          this.setCollection(collection, { error: '다른 기기에서 다시 수정했어요. 새 내용을 확인한 뒤 선택해 주세요.' });
          this.listen(collection); return;
        }
        context.latestRemote = remote;
        context.revision = remote?.revision ?? 0; context.basePayload = remote ? payload(remote.board) : null;
        context.known = true; context.needsDecision = false; context.dirty = true;
        this.setCollection(collection, { status: this.online ? 'syncing' : 'offline', conflict: null, error: '' }); this.persist(collection); this.schedule(collection);
      }
      // Restore the ordinary listener. Later snapshots follow revision conflict handling again.
      this.listen(collection);
    }, error => { if (this.active(uid, session, collection, context) && epoch === context.listenEpoch) this.setCollection(collection, { status: 'error', error: message(error) }); });
  }
  setOnline(online: boolean) {
    this.online = online;
    if (!this.snapshot.user) return;
    for (const collection of COLLECTION_IDS) {
      if (!online && !this.snapshot.collections[collection].conflict) this.setCollection(collection, { status: 'offline' });
      if (online) { this.listen(collection); this.schedule(collection); }
    }
  }
  retry(collection?: CollectionId) { (collection ? [collection] : COLLECTION_IDS).forEach(id => { this.listen(id); this.schedule(id); }); }
  async signIn() {
    if (!this.adapter || this.snapshot.authBusy) return;
    const operation = ++this.authOperation; this.emit({ authBusy: true, authError: '' });
    try { await this.adapter.signIn(); }
    catch (error) {
      if (operation !== this.authOperation) return;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      this.emit({ authError: code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request') ? '' : message(error) });
    } finally { if (operation === this.authOperation) this.emit({ authBusy: false }); }
  }
  async signOut() {
    if (!this.adapter || this.snapshot.authBusy) return;
    const operation = ++this.authOperation; this.emit({ authBusy: true, authError: '' });
    try { await this.adapter.signOut(); }
    catch (error) { if (operation === this.authOperation) this.emit({ authError: message(error) }); }
    finally { if (operation === this.authOperation) this.emit({ authBusy: false }); }
  }
}
