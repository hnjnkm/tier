import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../../src/domain';
import { CloudConfigurationError, CLOUD_PAYLOAD_BYTES, loadCloudAdapter, parseFirebaseConfig, parseRemoteBoard, serializeCloudBoard } from '../../src/firebase';

const config = { enabled: true, apiKey: 'emulator-only-key', authDomain: 'demo-tier-sync.firebaseapp.com', projectId: 'demo-tier-sync', appId: '1:1234567890:web:0123abcdef' };

test('default disabled config never contacts an authentication or cloud endpoint', async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    return new Response('{"enabled":false}', { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    assert.equal(await loadCloudAdapter(), null);
    assert.deepEqual(requests, ['/firebase-config.json']);
  } finally { globalThis.fetch = original; }
});

test('enabled config must be complete and emulator ports are available only on localhost', () => {
  assert.equal(parseFirebaseConfig({ enabled: false }), null);
  assert.deepEqual(parseFirebaseConfig(config), config);
  for (const value of [null, {}, { enabled: 'yes' }, { ...config, appId: '' }, { ...config, authDomain: 'https://example.com/' }, { ...config, apiKey: ' key ' }]) assert.throws(() => parseFirebaseConfig(value), CloudConfigurationError);
  const emulator = { ...config, emulators: { authPort: 9099, firestorePort: 8080 } };
  assert.deepEqual(parseFirebaseConfig(emulator, '127.0.0.1'), emulator);
  assert.throws(() => parseFirebaseConfig(emulator, 'hnjnkm.github.io'), CloudConfigurationError);
  assert.throws(() => parseFirebaseConfig({ ...emulator, emulators: { authPort: 9099, firestorePort: 0 } }, 'localhost'), CloudConfigurationError);
  assert.throws(() => parseFirebaseConfig({ ...emulator, emulators: { authPort: 9099, firestorePort: 8080, host: 'example.com' } }, 'localhost'), CloudConfigurationError);
});

test('cloud serialization preserves boards and rejects mismatched collections and excessive UTF-8 data', () => {
  const board = createBoard();
  assert.deepEqual(JSON.parse(serializeCloudBoard(board, 'korean')), board);
  assert.throws(() => serializeCloudBoard(board, 'global'));
  assert.throws(() => serializeCloudBoard({ ...board, title: '' }, 'korean'));
  const large = { ...board, customArtists: Array.from({ length: 100 }, (_, index) => ({ id: `mb:00000000-0000-0000-0000-${index.toString(16).padStart(12, '0')}`, name: '아티스트', englishName: 'Artist', aliases: Array.from({ length: 30 }, () => '가'.repeat(100)), gender: 'unknown' as const, kind: 'solo' as const, source: 'musicbrainz' as const })) };
  assert.ok(JSON.stringify(large).length < CLOUD_PAYLOAD_BYTES);
  assert.ok(new TextEncoder().encode(JSON.stringify(large)).byteLength > CLOUD_PAYLOAD_BYTES);
  assert.throws(() => serializeCloudBoard(large, 'korean'), /저장 용량/);
});

test('remote corruption is rejected instead of turning into an empty board', () => {
  const valid = { schemaVersion: 1, payload: JSON.stringify(createBoard()), revision: 1, writeId: 'write-one', updatedAt: { toMillis: () => 1 } };
  assert.deepEqual(parseRemoteBoard(valid, 'korean').board, createBoard());
  for (const invalid of [null, { ...valid, payload: '{' }, { ...valid, payload: '{}' }, { ...valid, extra: 'field' }, { ...valid, updatedAt: null }, { ...valid, writeId: 'with spaces' }, { ...valid, revision: 1.5 }, { ...valid, revision: 0 }]) assert.throws(() => parseRemoteBoard(invalid, 'korean'));
  assert.throws(() => parseRemoteBoard(valid, 'global'));
});
