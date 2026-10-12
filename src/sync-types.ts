import type { CollectionId } from './collections';
import type { Board } from './types';

export interface CloudUser { uid: string; name: string; email: string }
export interface RemoteBoard { board: Board; revision: number; writeId: string }
export class CloudConflictError extends Error {
  constructor(public remote: RemoteBoard | null) { super('다른 기기의 티어가 먼저 수정되었습니다.'); this.name = 'CloudConflictError'; }
}
export interface CloudAdapter {
  subscribeUser(onUser: (user: CloudUser | null) => void, onError: (error: Error) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  subscribeBoard(uid: string, collection: CollectionId, onBoard: (remote: RemoteBoard | null, fromCache: boolean) => void, onError: (error: Error) => void): () => void;
  writeBoard(uid: string, collection: CollectionId, board: Board, revision: number, writeId: string): Promise<RemoteBoard>;
}
