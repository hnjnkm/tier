import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { COLLECTIONS, type CollectionId } from '../collections';
import { allArtists } from '../domain';
import { TIERS, type Board } from '../types';
import '../cloud.css';

function BoardPreview({ label, board }: { label: string; board: Board | null }) {
  if (!board) return <section className="cloud-board-preview" aria-label={label}><h3>{label}</h3><p className="cloud-caption">비교할 저장된 티어가 없습니다.</p></section>;
  const artists = new Map(allArtists(board).map(artist => [artist.id, artist.name]));
  const favorites = Object.values(board.favorites).reduce((count, songs) => count + songs.length, 0);
  const sNames = board.tiers.S.slice(0, 3).map(id => artists.get(id) ?? id).join(', ');
  return <section className="cloud-board-preview" aria-label={label}>
    <h3>{label}</h3><p className="cloud-board-title">{board.title}</p>
    <dl><div><dt>아티스트</dt><dd>{TIERS.reduce((count, tier) => count + board.tiers[tier].length, 0)}명</dd></div><div><dt>선택한 곡</dt><dd>{favorites}곡</dd></div><div className="cloud-board-favorites"><dt>S티어</dt><dd>{sNames ? `${sNames}${board.tiers.S.length > 3 ? ` 외 ${board.tiers.S.length - 3}명` : ''}` : '아직 없어요'}</dd></div></dl>
  </section>;
}

export function SyncConflictDialog({ collection, local, remote, kind, onResolve, onClose }: {
  collection: CollectionId;
  local: Board;
  remote: Board | null;
  kind: 'import' | 'concurrent';
  onResolve: (choice: 'local' | 'cloud') => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => {
      queueMicrotask(() => {
        const openDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
        if (opener.current?.isConnected && (!openDialog || openDialog.contains(opener.current))) opener.current.focus({ preventScroll: true });
      });
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="cloud-dialog sync-conflict-dialog" aria-labelledby="sync-conflict-title" aria-describedby="sync-conflict-description"
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="cloud-dialog-heading"><h2 id="sync-conflict-title">사용할 티어 선택</h2><button className="icon-button" onClick={onClose} aria-label="티어 선택 창 닫기"><X size={20} /></button></div>
    <p className="cloud-caption cloud-conflict-collection">{COLLECTIONS[collection].label}</p>
    <p id="sync-conflict-description" className="cloud-dialog-description">{kind === 'import' ? '이 기기의 티어와 계정에 저장된 티어가 달라요. 로그인 후 사용할 티어를 선택해 주세요.' : '다른 기기에서 티어가 수정되었습니다. 두 티어를 비교한 뒤 사용할 티어를 선택해 주세요.'}</p>
    <div className="cloud-board-previews"><BoardPreview label="이 기기의 티어" board={local} /><BoardPreview label="계정에 저장된 티어" board={remote} /></div>
    <p className="cloud-conflict-help">선택 전에는 티어를 덮어쓰지 않습니다. 이 기기의 티어를 사용하면 계정에 저장되고, 저장된 티어를 사용하면 이 기기에 내려받습니다.</p>
    <div className="cloud-dialog-actions cloud-conflict-actions"><button className="cloud-primary-button" onClick={() => onResolve('local')}>이 기기 티어 사용</button><button className="cloud-secondary-button" onClick={() => onResolve('cloud')} disabled={!remote}>저장된 티어 사용</button></div>
    <button className="cloud-text-button cloud-conflict-later" onClick={onClose}>나중에 선택</button>
  </dialog>, document.body);
}
