import { CATALOG } from './data/artists';
import { GLOBAL_ARTISTS } from './data/global-artists';

export type CollectionId = 'korean' | 'global';
export const COLLECTIONS = {
  korean: { label: '국내 아티스트', title: '나의 아티스트 티어', storageKey: 'my-tier.board.v1', artists: CATALOG },
  global: { label: '해외 아티스트', title: '해외 아티스트 티어', storageKey: 'my-tier.board.global.v1', artists: GLOBAL_ARTISTS },
} as const;
export const COLLECTION_IDS: CollectionId[] = ['korean', 'global'];

export function collectionFromUrl(): CollectionId {
  return new URLSearchParams(window.location.search).get('chart') === 'global' ? 'global' : 'korean';
}
export function collectionUrl(collection: CollectionId): string {
  const url = new URL(window.location.href);
  if (collection === 'korean') url.searchParams.delete('chart');
  else url.searchParams.set('chart', collection);
  return url.pathname + url.search;
}
