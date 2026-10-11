import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { COLLECTION_IDS, COLLECTIONS, collectionUrl, type CollectionId } from '../collections';

export function CollectionMenu({ collection, onSelect, onClose }: {
  collection: CollectionId; onSelect: (collection: CollectionId) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return createPortal(<dialog ref={dialog} className="collection-menu" aria-labelledby="collection-menu-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="collection-menu-heading"><h2 id="collection-menu-title">티어표</h2><button className="icon-button" onClick={onClose} aria-label="티어표 메뉴 닫기"><X size={20} /></button></div>
    <nav aria-label="티어표 선택">{COLLECTION_IDS.map(id => <a key={id} href={collectionUrl(id)} aria-current={id === collection ? 'page' : undefined}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); onClose(); onSelect(id);
      }}><span>{COLLECTIONS[id].label}</span>{id === collection && <Check size={16} aria-hidden="true" />}</a>)}</nav>
  </dialog>, document.body);
}
