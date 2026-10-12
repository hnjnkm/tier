import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, moveArtist } from '../src/domain';
import { COLLECTIONS, type CollectionId } from '../src/collections';
import { TierSyncStore, accountStorageKey } from '../src/tier-sync';
import { CloudConflictError, type CloudAdapter, type CloudUser, type RemoteBoard } from '../src/sync-types';
import type { Board } from '../src/types';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
class Hub {
  records = new Map<string, RemoteBoard>();
  listeners = new Map<string, Set<(record: RemoteBoard | null, fromCache: boolean) => void>>();
  writes: string[] = [];
  key(uid: string, collection: CollectionId) { return `${uid}/${collection}`; }
  seed(uid: string, collection: CollectionId, board: Board, revision = 1) { this.records.set(this.key(uid, collection), { board, revision, writeId: `seed_${revision}` }); }
  broadcast(uid: string, collection: CollectionId) { const key = this.key(uid, collection); this.listeners.get(key)?.forEach(listener => listener(this.records.get(key) ?? null, false)); }
}
class Adapter implements CloudAdapter {
  user: CloudUser | null = null;
  authListeners = new Set<(user: CloudUser | null) => void>();
  failWrites = false;
  holdWrites = false;
  held: (() => void)[] = [];
  cachedOnly = false;
  constructor(public hub: Hub) {}
  subscribeUser(onUser: (user: CloudUser | null) => void) { this.authListeners.add(onUser); queueMicrotask(() => { if (this.authListeners.has(onUser)) onUser(this.user); }); return () => { this.authListeners.delete(onUser); }; }
  login(uid: string | null) { this.user = uid ? { uid, name: uid, email: `${uid}@example.test` } : null; this.authListeners.forEach(listener => listener(this.user)); }
  async signIn() { this.login('alice'); }
  async signOut() { this.login(null); }
  subscribeBoard(uid: string, collection: CollectionId, onBoard: (record: RemoteBoard | null, fromCache: boolean) => void) {
    const key = this.hub.key(uid, collection), listeners = this.hub.listeners.get(key) ?? new Set(); this.hub.listeners.set(key, listeners); listeners.add(onBoard);
    queueMicrotask(() => { if (listeners.has(onBoard)) onBoard(this.hub.records.get(key) ?? null, this.cachedOnly); });
    return () => { listeners.delete(onBoard); };
  }
  async writeBoard(uid: string, collection: CollectionId, board: Board, revision: number, writeId: string) {
    if (this.failWrites) throw new Error('Network unavailable');
    if (this.holdWrites) await new Promise<void>(resolve => this.held.push(resolve));
    const key = this.hub.key(uid, collection), remote = this.hub.records.get(key) ?? null;
    if ((remote?.revision ?? 0) !== revision) throw new CloudConflictError(remote);
    const record = { board, revision: revision + 1, writeId }; this.hub.records.set(key, record); this.hub.writes.push(key); this.hub.broadcast(uid, collection); return record;
  }
}
const korean = (id: string, tier: 'S' | 'A' | 'F' = 'S') => moveArtist(createBoard(), id, tier);
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function until(predicate: () => boolean) { for (let i = 0; i < 200 && !predicate(); i++) await tick(); assert.ok(predicate(), 'expected state did not settle'); }
const saved = (store: TierSyncStore, collection: CollectionId = 'korean') => store.getSnapshot().collections[collection].status === 'saved';
function setup(hub = new Hub(), storage = new MemoryStorage()) { const adapter = new Adapter(hub), store = new TierSyncStore(storage, 0); store.start(adapter); return { hub, storage, adapter, store }; }

test('guest mode preserves existing saved bytes until edited, and disabled cloud remains usable', async () => {
  const storage = new MemoryStorage(), board = korean('kr-iu'); const original = JSON.stringify(board, null, 2);
  storage.setItem(COLLECTIONS.korean.storageKey, original);
  const store = new TierSyncStore(storage, 0); store.start(null);
  assert.equal(store.getSnapshot().mode, 'unavailable'); assert.deepEqual(store.getSnapshot().boards.korean, board);
  assert.equal(storage.getItem(COLLECTIONS.korean.storageKey), original);
  store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'F'));
  assert.deepEqual(JSON.parse(storage.getItem(COLLECTIONS.korean.storageKey)!).tiers.F, ['kr-iu']); store.dispose();
});

test('first Google account imports both guest charts only after a server-confirmed missing document', async () => {
  const storage = new MemoryStorage(), guest = korean('kr-iu'), global = moveArtist(createBoard('global'), 'global-taylor-swift', 'S');
  storage.setItem(COLLECTIONS.korean.storageKey, JSON.stringify(guest)); storage.setItem(COLLECTIONS.global.storageKey, JSON.stringify(global));
  const { adapter, store, hub } = setup(undefined, storage); await tick(); adapter.login('alice');
  await until(() => saved(store) && saved(store, 'global'));
  assert.deepEqual(hub.records.get('alice/korean')!.board, guest); assert.deepEqual(hub.records.get('alice/global')!.board, global);
  assert.equal(storage.getItem(COLLECTIONS.korean.storageKey), JSON.stringify(guest));
  assert.ok(storage.getItem(accountStorageKey('alice', 'korean'))); store.dispose();
});

test('a cache-only missing document never uploads a guest board or treats the account as empty', async () => {
  const { adapter, store, hub } = setup(); await tick(); adapter.cachedOnly = true; adapter.login('alice'); await tick();
  store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'S')); await tick();
  assert.equal(hub.writes.length, 0); assert.equal(store.getSnapshot().boards.korean.tiers.S[0], 'kr-iu'); store.dispose();
});

test('first login compares an existing cloud board with meaningful guest data; cloud choice leaves guest bytes intact', async () => {
  const hub = new Hub(), storage = new MemoryStorage(), guest = korean('kr-iu'), cloud = korean('kr-roy-kim');
  storage.setItem(COLLECTIONS.korean.storageKey, JSON.stringify(guest)); hub.seed('alice', 'korean', cloud);
  const { adapter, store } = setup(hub, storage); await tick(); adapter.login('alice'); await until(() => store.getSnapshot().collections.korean.status === 'conflict');
  assert.equal(store.getSnapshot().collections.korean.conflict!.kind, 'import'); assert.deepEqual(store.getSnapshot().boards.korean, guest);
  store.resolve('korean', 'cloud'); await until(() => saved(store)); assert.deepEqual(store.getSnapshot().boards.korean, cloud);
  assert.equal(storage.getItem(COLLECTIONS.korean.storageKey), JSON.stringify(guest)); await store.signOut(); assert.deepEqual(store.getSnapshot().boards.korean, guest); store.dispose();
});

test('two signed-in devices synchronize changes and stale offline edits require a choice instead of overwriting', async () => {
  const hub = new Hub(); hub.seed('alice', 'korean', createBoard()); hub.seed('alice', 'global', createBoard('global'));
  const a = setup(hub), b = setup(hub); await tick(); a.adapter.login('alice'); b.adapter.login('alice'); await until(() => saved(a.store) && saved(b.store));
  a.store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'S')); await until(() => b.store.getSnapshot().boards.korean.tiers.S.includes('kr-iu'));
  b.store.setOnline(false); b.store.updateBoard('korean', current => moveArtist(current, 'kr-roy-kim', 'A'));
  a.store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'F')); await until(() => b.store.getSnapshot().collections.korean.status === 'conflict');
  b.store.setOnline(true); await tick(); assert.equal(hub.records.get('alice/korean')!.board.tiers.A.length, 0);
  assert.ok(b.store.getSnapshot().boards.korean.tiers.A.includes('kr-roy-kim')); assert.ok(b.store.getSnapshot().collections.korean.conflict!.remote!.tiers.F.includes('kr-iu'));
  b.store.resolve('korean', 'local'); await until(() => saved(b.store)); await until(() => a.store.getSnapshot().boards.korean.tiers.A.includes('kr-roy-kim'));
  a.store.dispose(); b.store.dispose();
});

test('offline pending changes survive reload and upload only when the same server revision is confirmed', async () => {
  const hub = new Hub(), storage = new MemoryStorage(); hub.seed('alice', 'korean', createBoard());
  const first = setup(hub, storage); await tick(); first.adapter.login('alice'); await until(() => saved(first.store));
  first.store.setOnline(false); first.store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'A')); first.store.dispose();
  const second = setup(hub, storage); second.store.setOnline(false); await tick(); second.adapter.login('alice'); await tick();
  assert.ok(second.store.getSnapshot().boards.korean.tiers.A.includes('kr-iu')); assert.equal(hub.records.get('alice/korean')!.board.tiers.A.length, 0);
  second.store.setOnline(true); await until(() => saved(second.store)); assert.ok(hub.records.get('alice/korean')!.board.tiers.A.includes('kr-iu')); second.store.dispose();
});

test('unresolved conflict survives sign-out/relogin without automatically choosing a board', async () => {
  const hub = new Hub(), storage = new MemoryStorage(); storage.setItem(COLLECTIONS.korean.storageKey, JSON.stringify(korean('kr-iu'))); hub.seed('alice', 'korean', korean('kr-roy-kim'));
  const { adapter, store } = setup(hub, storage); await tick(); adapter.login('alice'); await until(() => store.getSnapshot().collections.korean.status === 'conflict');
  await store.signOut(); adapter.login('alice'); await until(() => store.getSnapshot().collections.korean.status === 'conflict');
  assert.ok(store.getSnapshot().boards.korean.tiers.S.includes('kr-iu')); assert.equal(hub.records.get('alice/korean')!.revision, 1); store.dispose();
});

test('account switching never applies a previous user delayed write or listener to the new board or guest storage', async () => {
  const hub = new Hub(), storage = new MemoryStorage(); const guest = korean('kr-naul'); storage.setItem(COLLECTIONS.korean.storageKey, JSON.stringify(guest));
  hub.seed('alice', 'korean', guest); hub.seed('bob', 'korean', korean('kr-roy-kim'));
  const { adapter, store } = setup(hub, storage); await tick(); adapter.login('alice'); await until(() => saved(store));
  adapter.holdWrites = true; store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'A')); await until(() => adapter.held.length > 0);
  adapter.login('bob'); await until(() => store.getSnapshot().collections.korean.status === 'conflict'); store.resolve('korean', 'cloud'); await until(() => saved(store));
  const bob = store.getSnapshot().boards.korean; adapter.holdWrites = false; adapter.held.splice(0).forEach(resolve => resolve()); await tick();
  assert.deepEqual(store.getSnapshot().boards.korean, bob); assert.equal(storage.getItem(COLLECTIONS.korean.storageKey), JSON.stringify(guest));
  await store.signOut(); assert.deepEqual(store.getSnapshot().boards.korean, guest); store.dispose();
});

test('same-UID restart restores subscriptions and never sends signed-in edits to guest storage', async () => {
  const hub = new Hub(), storage = new MemoryStorage(); hub.seed('alice', 'korean', createBoard()); const { adapter, store } = setup(hub, storage);
  await tick(); adapter.login('alice'); await until(() => saved(store)); store.dispose(); store.start(adapter); await until(() => saved(store));
  assert.equal(hub.listeners.get('alice/korean')!.size, 1); store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'S')); await until(() => hub.records.get('alice/korean')!.board.tiers.S.includes('kr-iu'));
  assert.equal(storage.getItem(COLLECTIONS.korean.storageKey), null); store.dispose();
});

test('cloud changing while a local choice is open is shown again before overwriting the unseen newer board', async () => {
  const hub = new Hub(), storage = new MemoryStorage(); storage.setItem(COLLECTIONS.korean.storageKey, JSON.stringify(korean('kr-iu'))); hub.seed('alice', 'korean', korean('kr-roy-kim'));
  const { adapter, store } = setup(hub, storage); await tick(); adapter.login('alice'); await until(() => store.getSnapshot().collections.korean.status === 'conflict');
  hub.seed('alice', 'korean', korean('kr-naul'), 2); store.resolve('korean', 'local'); await tick();
  assert.equal(store.getSnapshot().collections.korean.status, 'conflict'); assert.ok(store.getSnapshot().collections.korean.conflict!.remote!.tiers.S.includes('kr-naul'));
  assert.equal(hub.records.get('alice/korean')!.revision, 2); store.resolve('korean', 'local'); await until(() => saved(store)); assert.ok(hub.records.get('alice/korean')!.board.tiers.S.includes('kr-iu')); store.dispose();
});

test('corrupt account metadata preserves original bytes and asks before uploading its recoverable board', async () => {
  const hub = new Hub(), storage = new MemoryStorage(), original = JSON.stringify({ version: 1, board: korean('kr-iu'), revision: 'broken' });
  storage.setItem(accountStorageKey('alice', 'korean'), original); hub.seed('alice', 'korean', korean('kr-roy-kim'));
  const { adapter, store } = setup(hub, storage); await tick(); adapter.login('alice'); await until(() => store.getSnapshot().collections.korean.status === 'conflict');
  assert.ok(store.getSnapshot().collections.korean.localError); assert.equal(storage.getItem(accountStorageKey('alice', 'korean')), original);
  store.resolve('korean', 'cloud'); await until(() => saved(store)); assert.equal(storage.getItem(accountStorageKey('alice', 'korean')), original);
  assert.ok(storage.getItem(`${accountStorageKey('alice', 'korean')}.working`)); store.dispose();
});

test('read/write failures preserve pending edits and retry without replacing cloud data with an empty board', async () => {
  const hub = new Hub(); hub.seed('alice', 'korean', korean('kr-iu')); const { adapter, store, storage } = setup(hub); await tick(); adapter.login('alice'); await until(() => saved(store));
  adapter.failWrites = true; store.updateBoard('korean', current => moveArtist(current, 'kr-roy-kim', 'A')); await until(() => store.getSnapshot().collections.korean.status === 'error');
  assert.ok(JSON.parse(storage.getItem(accountStorageKey('alice', 'korean'))!).pending); assert.equal(hub.records.get('alice/korean')!.board.tiers.A.length, 0);
  adapter.failWrites = false; store.retry('korean'); await until(() => saved(store)); assert.ok(hub.records.get('alice/korean')!.board.tiers.A.includes('kr-roy-kim')); store.dispose();
});

test('a delayed successful response cannot roll back a newer device snapshot', async () => {
  class DelayedResponse extends Adapter {
    delay = false; replies: (() => void)[] = [];
    override async writeBoard(uid: string, collection: CollectionId, board: Board, revision: number, writeId: string) {
      const result = await super.writeBoard(uid, collection, board, revision, writeId);
      if (this.delay && collection === 'korean') await new Promise<void>(resolve => this.replies.push(resolve));
      return result;
    }
  }
  const hub = new Hub(), adapter = new DelayedResponse(hub), storage = new MemoryStorage(), store = new TierSyncStore(storage, 0);
  hub.seed('alice', 'korean', createBoard()); store.start(adapter); await tick(); adapter.login('alice'); await until(() => saved(store));
  adapter.delay = true; store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'S')); await until(() => adapter.replies.length > 0);
  hub.seed('alice', 'korean', korean('kr-roy-kim'), 3); hub.broadcast('alice', 'korean');
  adapter.replies.splice(0).forEach(resolve => resolve()); await tick();
  assert.ok(store.getSnapshot().boards.korean.tiers.S.includes('kr-roy-kim')); assert.equal(store.getSnapshot().collections.korean.status, 'saved'); store.dispose();
});

test('resolving a conflict while an earlier write is pending prevents its late error from undoing the decision', async () => {
  const hub = new Hub(); hub.seed('alice', 'korean', createBoard()); const { adapter, store } = setup(hub);
  await tick(); adapter.login('alice'); await until(() => saved(store));
  adapter.holdWrites = true; store.updateBoard('korean', current => moveArtist(current, 'kr-iu', 'S')); await until(() => adapter.held.length > 0);
  hub.seed('alice', 'korean', korean('kr-roy-kim'), 2); hub.broadcast('alice', 'korean');
  assert.equal(store.getSnapshot().collections.korean.status, 'conflict'); store.resolve('korean', 'cloud'); await until(() => saved(store));
  adapter.holdWrites = false; adapter.held.splice(0).forEach(resolve => resolve()); await tick();
  assert.equal(store.getSnapshot().collections.korean.status, 'saved'); assert.ok(store.getSnapshot().boards.korean.tiers.S.includes('kr-roy-kim')); store.dispose();
});
