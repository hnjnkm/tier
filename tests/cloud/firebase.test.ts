import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, Timestamp, updateDoc, terminate } from 'firebase/firestore';
import { createBoard, moveArtist } from '../../src/domain';
import { createCloudAdapter } from '../../src/firebase';
import { CloudConflictError, type RemoteBoard } from '../../src/sync-types';

const projectId = 'demo-tier-sync';
let environment: RulesTestEnvironment;
const validData = (revision = 1) => ({ schemaVersion: 1, payload: JSON.stringify(createBoard()), revision, writeId: `write-${revision}`, updatedAt: serverTimestamp() });

before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: await fs.readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => {
  for (const app of getApps()) {
    if (app.name.startsWith('tier-')) {
      await getAuth(app).signOut();
      await terminate(getFirestore(app));
      await deleteApp(app);
    }
  }
  await environment?.cleanup();
});

test('only the owner can read or write either personal chart; other paths and unauthenticated access fail', async () => {
  const owner = environment.authenticatedContext('alice').firestore();
  const other = environment.authenticatedContext('bob').firestore();
  const guest = environment.unauthenticatedContext().firestore();
  for (const collection of ['korean', 'global']) {
    const path = `users/alice/boards/${collection}`;
    await assertSucceeds(setDoc(doc(owner, path), validData()));
    await assertSucceeds(getDoc(doc(owner, path)));
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDoc(doc(guest, path)));
    await assertFails(setDoc(doc(other, path), validData(2)));
    await assertFails(setDoc(doc(guest, path), validData(2)));
    await assertFails(deleteDoc(doc(owner, path)));
  }
  await assertFails(setDoc(doc(owner, 'users/alice/boards/other'), validData()));
  await assertFails(setDoc(doc(owner, 'users/alice/settings/profile'), validData()));
});

test('rules require the exact bounded schema, server time, and monotonically increasing integer revisions', async () => {
  const owner = environment.authenticatedContext('schema-owner').firestore();
  const reference = doc(owner, 'users/schema-owner/boards/korean');
  const invalid = [
    { ...validData(), schemaVersion: '1' }, { ...validData(), schemaVersion: 2 },
    { ...validData(), revision: 0 }, { ...validData(), revision: 2 }, { ...validData(), revision: 1.5 },
    { ...validData(), revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...validData(), payload: '' }, { ...validData(), payload: {} }, { ...validData(), payload: 'x'.repeat(700001) },
    { ...validData(), payload: '가'.repeat(233334) },
    { ...validData(), writeId: '' }, { ...validData(), writeId: 'x'.repeat(101) }, { ...validData(), writeId: 'bad id' },
    { ...validData(), updatedAt: Timestamp.fromMillis(0) }, { ...validData(), updatedAt: 'today' },
    { ...validData(), privateEmail: 'leak@example.com' },
  ];
  for (const data of invalid) await assertFails(setDoc(reference, data));
  await assertSucceeds(setDoc(reference, validData()));
  await assertFails(updateDoc(reference, { revision: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { revision: 3, updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(reference, validData(2)));
  assert.equal((await getDoc(reference)).data()?.revision, 2);
});

test('real adapter transactions reject stale writes, isolate charts, and retain corrupt remote data', async () => {
  const adapter = await createCloudAdapter({ enabled: true, apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: '1:1234567890:web:0123abcdef', emulators: { authPort: Number(process.env.FIREBASE_AUTH_EMULATOR_HOST!.split(':')[1]), firestorePort: Number(process.env.FIRESTORE_EMULATOR_HOST!.split(':')[1]) } }, 'localhost');
  const app = getApps().find(app => app.name === `tier-${projectId}-emulator`)!;
  const user = (await signInAnonymously(getAuth(app))).user;
  const initial = moveArtist(createBoard(), 'kr-iu', 'S');
  const first = await adapter.writeBoard(user.uid, 'korean', initial, 0, 'first-write');
  assert.equal(first.revision, 1);
  const second = await adapter.writeBoard(user.uid, 'korean', moveArtist(initial, 'kr-iu', 'A'), 1, 'second-write');
  assert.equal(second.revision, 2);
  await assert.rejects(adapter.writeBoard(user.uid, 'korean', createBoard(), 1, 'stale-device'), error => error instanceof CloudConflictError && error.remote?.revision === 2 && error.remote.board.tiers.A[0] === 'kr-iu');
  await adapter.writeBoard(user.uid, 'global', createBoard('global'), 0, 'foreign-write');
  const ownerDb = getFirestore(app);
  assert.deepEqual(JSON.parse((await getDoc(doc(ownerDb, 'users', user.uid, 'boards', 'korean'))).data()!.payload), second.board);
  assert.equal((await getDoc(doc(ownerDb, 'users', user.uid, 'boards', 'global'))).data()!.revision, 1);
  const concurrent = await Promise.allSettled([
    adapter.writeBoard(user.uid, 'korean', { ...second.board, title: '기기 A의 티어' }, 2, 'device-a'),
    adapter.writeBoard(user.uid, 'korean', { ...second.board, title: '기기 B의 티어' }, 2, 'device-b'),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  const loser = concurrent.find(result => result.status === 'rejected');
  assert.ok(loser?.status === 'rejected' && loser.reason instanceof CloudConflictError, loser?.status === 'rejected' ? String(loser.reason) : 'Expected one conflict');
  const winner = concurrent.find(result => result.status === 'fulfilled');
  assert.ok(winner?.status === 'fulfilled');
  assert.equal(winner.value.revision, 3);
  const heard = await new Promise<RemoteBoard>((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Timed out waiting for server snapshot')); }, 8000);
    const unsubscribe = adapter.subscribeBoard(user.uid, 'korean', (remote, fromCache) => {
      if (!fromCache && remote) { clearTimeout(timer); unsubscribe(); resolve(remote); }
    }, reject);
  });
  assert.equal(heard.revision, 3);
  assert.deepEqual(heard.board, winner.value.board);
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', user.uid, 'boards', 'korean'), { ...validData(4), payload: '{corrupt' });
  });
  await assert.rejects(adapter.writeBoard(user.uid, 'korean', createBoard(), 4, 'must-not-overwrite'), /클라우드 티어 데이터/);
  const broken = (await getDoc(doc(ownerDb, 'users', user.uid, 'boards', 'korean'))).data()!;
  assert.equal(broken.payload, '{corrupt');
  assert.equal(broken.revision, 4);
});
