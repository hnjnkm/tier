import { parseBoard } from './domain';
import type { CollectionId } from './collections';
import type { Board } from './types';
import { CloudConflictError, type CloudAdapter, type RemoteBoard } from './sync-types';

export const CLOUD_PAYLOAD_BYTES = 700_000;
export interface FirebaseConfiguration {
  enabled: true;
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  /** Development only. Both services are always bound to 127.0.0.1. */
  emulators?: { authPort: number; firestorePort: number };
}
export class CloudConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'CloudConfigurationError'; }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const configuredText = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500;
const localHost = (hostname: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
const validPort = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65535;

export function parseFirebaseConfig(value: unknown, hostname = globalThis.location?.hostname ?? ''): FirebaseConfiguration | null {
  if (!record(value) || typeof value.enabled !== 'boolean') throw new CloudConfigurationError('Google 로그인 설정을 읽을 수 없습니다.');
  if (Object.keys(value).some(key => !['enabled', 'apiKey', 'authDomain', 'projectId', 'appId', 'emulators'].includes(key))) throw new CloudConfigurationError('공개 로그인 설정에는 안내된 웹 앱 설정만 넣어 주세요.');
  if (!value.enabled) return null;
  if (!configuredText(value.apiKey) || !configuredText(value.authDomain) || !configuredText(value.projectId) || !configuredText(value.appId)
    || !/^[a-zA-Z0-9.-]+$/.test(value.authDomain) || !/^[a-z][a-z0-9-]{4,62}$/.test(value.projectId)
    || !/^1:\d+:web:[a-zA-Z0-9]+$/.test(value.appId)) throw new CloudConfigurationError('Google 로그인 설정이 완료되지 않았습니다.');
  let emulators: FirebaseConfiguration['emulators'];
  if (value.emulators !== undefined) {
    if (!localHost(hostname) || !record(value.emulators) || Object.keys(value.emulators).some(key => !['authPort', 'firestorePort'].includes(key))
      || !validPort(value.emulators.authPort) || !validPort(value.emulators.firestorePort)) {
      throw new CloudConfigurationError('로컬 테스트 설정은 localhost에서만 사용할 수 있습니다.');
    }
    emulators = { authPort: value.emulators.authPort, firestorePort: value.emulators.firestorePort };
  }
  return { enabled: true, apiKey: value.apiKey, authDomain: value.authDomain, projectId: value.projectId, appId: value.appId, ...(emulators ? { emulators } : {}) };
}

export function serializeCloudBoard(board: Board, collection: CollectionId): string {
  const parsed = parseBoard(board);
  if (!parsed || (parsed.collection ?? 'korean') !== collection) throw new Error('저장할 티어 데이터가 올바르지 않습니다.');
  const payload = JSON.stringify(parsed);
  if (new TextEncoder().encode(payload).byteLength > CLOUD_PAYLOAD_BYTES) throw new Error('티어 데이터가 클라우드 저장 용량을 초과했습니다. 파일로 먼저 저장해 주세요.');
  return payload;
}

export function parseRemoteBoard(value: unknown, collection: CollectionId): RemoteBoard {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'payload,revision,schemaVersion,updatedAt,writeId'
    || value.schemaVersion !== 1 || typeof value.payload !== 'string' || !value.payload.length
    || new TextEncoder().encode(value.payload).byteLength > CLOUD_PAYLOAD_BYTES
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || typeof value.writeId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.writeId)
    || !record(value.updatedAt) || typeof value.updatedAt.toMillis !== 'function') throw new Error('클라우드 티어 데이터가 올바르지 않아 불러오기를 중단했습니다.');
  let parsed: Board | null = null;
  try { parsed = parseBoard(JSON.parse(value.payload)); } catch { /* Treat invalid remote JSON as corruption, never as an empty board. */ }
  if (!parsed || (parsed.collection ?? 'korean') !== collection) throw new Error('클라우드 티어 데이터가 올바르지 않아 불러오기를 중단했습니다.');
  return { board: parsed, revision: Number(value.revision), writeId: value.writeId };
}

/** Disabled installations do not import the SDK or contact Google. */
export async function loadCloudAdapter(): Promise<CloudAdapter | null> {
  const base = import.meta.env?.BASE_URL ?? '/';
  const response = await fetch(`${base}firebase-config.json`, { cache: 'no-store' });
  if (!response.ok) throw new CloudConfigurationError('Google 로그인 설정을 읽을 수 없습니다.');
  let value: unknown;
  try { value = await response.json(); } catch { throw new CloudConfigurationError('Google 로그인 설정을 읽을 수 없습니다.'); }
  const config = parseFirebaseConfig(value);
  return config ? createCloudAdapter(config) : null;
}

/** The hostname argument exists for Node-based emulator tests; production uses location.hostname. */
export async function createCloudAdapter(configuration: FirebaseConfiguration, hostname = globalThis.location?.hostname ?? ''): Promise<CloudAdapter> {
  const config = parseFirebaseConfig(configuration, hostname);
  if (!config) throw new CloudConfigurationError('Google 로그인이 아직 연결되지 않았습니다.');
  const [apps, authSdk, firestore] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const appName = `tier-${config.projectId}-${config.emulators ? 'emulator' : 'public'}`;
  const app = apps.getApps().find(existing => existing.name === appName) ?? apps.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId }, appName);
  const auth = authSdk.getAuth(app);
  const database = firestore.getFirestore(app);
  // Configure a named app once, including when React remounts the account UI.
  if (!initializedApps.has(appName)) {
    if (config.emulators) {
      authSdk.connectAuthEmulator(auth, `http://127.0.0.1:${config.emulators.authPort}`, { disableWarnings: true });
      firestore.connectFirestoreEmulator(database, '127.0.0.1', config.emulators.firestorePort);
    }
    initializedApps.set(appName, authSdk.setPersistence(auth, config.emulators && typeof window === 'undefined' ? authSdk.inMemoryPersistence : authSdk.browserLocalPersistence));
  }
  await initializedApps.get(appName);
  const boardRef = (uid: string, collection: CollectionId) => {
    if (!uid || uid.includes('/') || !['korean', 'global'].includes(collection)) throw new Error('저장 경로가 올바르지 않습니다.');
    return firestore.doc(database, 'users', uid, 'boards', collection);
  };
  return {
    subscribeUser(onUser, onError) {
      return authSdk.onAuthStateChanged(auth, user => onUser(user ? { uid: user.uid, name: user.displayName ?? '', email: user.email ?? '' } : null), onError);
    },
    async signIn() {
      // Call directly from the user's button tap so browsers permit the popup.
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await authSdk.signInWithPopup(auth, provider);
    },
    signOut: () => authSdk.signOut(auth),
    subscribeBoard(uid, collection, onBoard, onError) {
      return firestore.onSnapshot(boardRef(uid, collection), { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.hasPendingWrites) return;
        try { onBoard(snapshot.exists() ? parseRemoteBoard(snapshot.data(), collection) : null, snapshot.metadata.fromCache); }
        catch (error) { onError(error instanceof Error ? error : new Error(String(error))); }
      }, onError);
    },
    async writeBoard(uid, collection, board, revision, writeId) {
      if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER || !/^[A-Za-z0-9_-]{1,100}$/.test(writeId)) throw new Error('저장 버전이 올바르지 않습니다.');
      const payload = serializeCloudBoard(board, collection);
      const reference = boardRef(uid, collection);
      try {
        return await firestore.runTransaction(database, async transaction => {
          const snapshot = await transaction.get(reference);
          const remote = snapshot.exists() ? parseRemoteBoard(snapshot.data(), collection) : null;
          if ((remote?.revision ?? 0) !== revision) throw new CloudConflictError(remote);
          const nextRevision = revision + 1;
          transaction.set(reference, { schemaVersion: 1, payload, revision: nextRevision, writeId, updatedAt: firestore.serverTimestamp() });
          return { board: parseBoard(JSON.parse(payload))!, revision: nextRevision, writeId };
        });
      } catch (error) {
        // A competing commit can trip the monotonic rule before Firestore retries.
        // Re-read from the server to distinguish that conflict from lost permissions.
        const code = record(error) ? error.code : undefined;
        if (['permission-denied', 'aborted', 'failed-precondition'].includes(String(code))) {
          let snapshot;
          try { snapshot = await firestore.getDocFromServer(reference); } catch { throw error; }
          const remote = snapshot.exists() ? parseRemoteBoard(snapshot.data(), collection) : null;
          if ((remote?.revision ?? 0) !== revision) throw new CloudConflictError(remote);
        }
        throw error;
      }
    },
  };
}

const initializedApps = new Map<string, Promise<void>>();
