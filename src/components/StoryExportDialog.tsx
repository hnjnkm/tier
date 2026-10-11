import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ChevronLeft, ChevronRight, LoaderCircle, Share2, X } from 'lucide-react';
import { renderStory, STORY_PAGE_SIZE } from '../story';
import type { Artist, Portrait, Song } from '../types';

type PreparedStory = { pageIndex: number; url: string; file: File; missingPhotos: string[] };

export function StoryExportDialog({ artists, favorites, portraits, collection, onClose }: {
  artists: Artist[]; favorites: Record<string, Song[]>; portraits: Record<string, Portrait>;
  collection: 'korean' | 'global'; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [prepared, setPrepared] = useState<PreparedStory | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const pageCount = Math.ceil(artists.length / STORY_PAGE_SIZE);
  const current = prepared?.pageIndex === pageIndex ? prepared : null;
  let canShare = false;
  try { canShare = !!current && typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [current.file] }); } catch { /* Saving remains available when file sharing is restricted. */ }

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController(); let url = '';
    setPrepared(null); setError(''); setFeedback('');
    void renderStory({ artists: artists.slice(pageIndex * STORY_PAGE_SIZE, (pageIndex + 1) * STORY_PAGE_SIZE), favorites, portraits, collection, pageIndex, pageCount, signal: controller.signal })
      .then(({ blob, missingPhotos }) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPrepared({ pageIndex, url, file: new File([blob], `favorites-${collection}-${pageIndex + 1}.png`, { type: 'image/png' }), missingPhotos });
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '이미지를 만들지 못했어요. 다시 시도해 주세요.'); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [artists, favorites, portraits, collection, pageIndex, pageCount, retry]);

  async function share() {
    if (!current || sharing || !canShare) return;
    setSharing(true); setFeedback('');
    try {
      // Use the already prepared PNG so navigator.share runs within the user's tap.
      await navigator.share({ files: [current.file] });
      setFeedback('공유 메뉴로 이미지를 전달했습니다.');
    } catch (reason) {
      if (!(reason instanceof Error && reason.name === 'AbortError')) setFeedback('공유 메뉴를 열지 못했어요. 이미지 저장 후 Instagram 스토리에 올려 주세요.');
    } finally { setSharing(false); }
  }

  return createPortal(<dialog ref={dialog} className="story-dialog" aria-labelledby="story-title" aria-describedby="story-description"
    onCancel={event => { event.preventDefault(); if (!sharing) onClose(); }} onClose={onClose}
    onClick={event => {
      if (event.target !== dialog.current || sharing) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="story-heading"><h2 id="story-title">스토리로 공유</h2><button className="icon-button" aria-label="스토리 공유 창 닫기" onClick={onClose} disabled={sharing}><X size={21} /></button></div>
    <p id="story-description" className="story-description">S티어 아티스트와 선택한 곡 · 1080 × 1920</p>
    <div className="story-preview" aria-busy={!current && !error}>
      {current ? <img src={current.url} alt={`나의 최애 스토리 ${pageIndex + 1}/${pageCount}: ${artists.slice(pageIndex * STORY_PAGE_SIZE, (pageIndex + 1) * STORY_PAGE_SIZE).map(artist => artist.name).join(', ')}`} />
        : <div className="story-placeholder" role="status">{error ? <><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></> : <><LoaderCircle size={20} className="spin" /><span>이미지를 만들고 있어요.</span></>}</div>}
    </div>
    {pageCount > 1 && <nav className="story-pagination" aria-label="스토리 이미지 선택"><button className="icon-button" aria-label="이전 스토리 이미지" disabled={pageIndex === 0 || sharing} onClick={() => setPageIndex(value => value - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">{pageIndex + 1} / {pageCount} · 4명씩 나누어 저장</span><button className="icon-button" aria-label="다음 스토리 이미지" disabled={pageIndex === pageCount - 1 || sharing} onClick={() => setPageIndex(value => value + 1)}><ChevronRight size={18} /></button></nav>}
    {!!current?.missingPhotos.length && <p className="story-warning" role="status">{current.missingPhotos.join(', ')} 사진을 불러오지 못해 이름으로 표시했어요. <button className="text-button" onClick={() => setRetry(value => value + 1)} disabled={sharing}>다시 시도</button></p>}
    <div className="story-actions">
      <a className={`secondary-button story-save ${!current || sharing ? 'is-disabled' : ''}`} href={current?.url} download={current?.file.name} aria-disabled={!current || sharing} onClick={event => { if (!current || sharing) event.preventDefault(); }}><ArrowDownToLine size={16} />이미지 저장</a>
      {canShare && <button className="primary-button" onClick={share} disabled={sharing}><Share2 size={16} />{sharing ? '공유 중' : '공유'}</button>}
    </div>
    <p className="story-help">{canShare ? '공유 메뉴에서 Instagram을 선택하세요. 표시되지 않으면 이미지를 저장해 스토리에 올려 주세요.' : '이미지를 저장한 뒤 Instagram 스토리에 올려 주세요.'}</p>
    <p className="story-touch-help">사진 앱에 저장하려면 미리보기 이미지를 길게 눌러 주세요.</p>
    {feedback && <p className="story-feedback" role="status">{feedback}</p>}
  </dialog>, document.body);
}
