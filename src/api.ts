export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (import.meta.env.VITE_STATIC_SITE === 'true') {
    signal?.throwIfAborted();
    const { browserApi } = await import('./browser-media');
    const data = await browserApi(path);
    signal?.throwIfAborted();
    return data as T;
  }
  const response = await fetch(path, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '데이터를 불러오지 못했어요.');
  return data;
}

export const imageUrl = (url: string) => import.meta.env.VITE_STATIC_SITE === 'true' ? url : `/api/image?url=${encodeURIComponent(url)}`;
export const audioUrl = (url: string) => import.meta.env.VITE_STATIC_SITE === 'true' ? url : `/api/audio?url=${encodeURIComponent(url)}`;
