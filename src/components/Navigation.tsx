import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';

export function Navigation({ count, onExport, onClose }: { count: number; onExport: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return createPortal(<dialog ref={dialog} className="navigation-dialog" aria-labelledby="navigation-title" onCancel={onClose} onClose={onClose} onClick={event => {
    if (event.target === dialog.current && event.clientX > dialog.current.getBoundingClientRect().right) onClose();
  }}>
    <div className="navigation-top"><span id="navigation-title">INDEX</span><button onClick={onClose} aria-label="메뉴 닫기"><X size={19} /><span>닫기</span></button></div>
    <nav className="navigation-links" aria-label="전체 메뉴">
      <a href="#my-tier" onClick={onClose}><span>01 / YOUR SELECTION</span><strong>나의 티어</strong><ArrowUpRight size={22} /></a>
      <a href="#artist-archive" onClick={onClose}><span>02 / {count} ARTISTS</span><strong>아티스트 아카이브</strong><ArrowUpRight size={22} /></a>
      <button onClick={() => { onExport(); onClose(); }}><span>03 / KEEP YOUR TASTE</span><strong>저장 파일 내보내기</strong><ArrowUpRight size={22} /></button>
    </nav>
    <div className="navigation-bottom"><p>사진을 눌러 티어를 고르고,<br />가수마다 좋아하는 세 곡을 남기세요.</p><span>MY TIER — PERSONAL SOUND ARCHIVE<br />V.02 / EST. 2026</span></div>
  </dialog>, document.body);
}
