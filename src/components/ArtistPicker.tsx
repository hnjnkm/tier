import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LoaderCircle, Plus, Search, X } from 'lucide-react';
import type { Artist, Portrait, Tier } from '../types';
import { Avatar } from './Avatar';

export function ArtistPicker({ tier, artists, portraits, placements, count, query, onQuery, total, onMore, searching, searchError, onRetry, onAdd, onClose }: {
  tier: Tier; artists: Artist[]; portraits: Record<string, Portrait>; placements: Map<string, Tier>; count: number;
  query: string; onQuery: (query: string) => void; total: number; onMore: () => void;
  searching: boolean; searchError: string; onRetry: () => void; onAdd: (artist: Artist) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return createPortal(<dialog className="artist-dialog artist-picker-dialog" ref={dialog} aria-labelledby="artist-picker-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="dialog-inner">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="아티스트 추가 창 닫기"><X size={21} /></button>
      <div className="picker-heading"><h2 id="artist-picker-title">{tier} 티어에 추가</h2><span role="status" aria-live="polite">{count}명</span></div>
      <label className="search-field picker-search"><Search size={19} /><input aria-label="추가할 아티스트 검색" value={query} onChange={event => onQuery(event.target.value)} placeholder="아티스트 이름 검색" maxLength={100} />{query && <button onClick={() => onQuery('')} aria-label="추가할 아티스트 검색어 지우기"><X size={16} /></button>}</label>
      <div className="picker-results"><div className="picker-artists">
        {artists.map(artist => {
          const current = placements.get(artist.id), added = current === tier;
          return <button key={artist.id} className={`picker-artist ${added ? 'is-added' : ''}`} disabled={added}
            aria-label={`${artist.name} ${tier} 티어에 ${added ? '이미 있음' : '추가'}`} onClick={() => onAdd(artist)}>
            <Avatar artist={artist} portrait={portraits[artist.id]} />
            <span className="picker-artist-copy"><span title={artist.name}>{artist.name}</span>{current && <span>{added ? `${tier} 티어에 추가됨` : `현재 ${current} 티어`}</span>}</span>
            {added ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
          </button>;
        })}
      </div>
      {!artists.length && !searching && <div className="result-message"><Search size={25} /><p>검색한 아티스트가 없어요.</p><button className="text-button" onClick={() => onQuery('')}>전체 아티스트 보기</button></div>}
      {artists.length < total && <button className="load-more" onClick={onMore}>더 보기 <span>{artists.length} / {total}</span><ChevronDown size={16} /></button>}
      {searching && <div className="remote-status" role="status"><LoaderCircle className="spin" size={14} /> 추가 아티스트를 검색하고 있어요.</div>}
      {searchError && <div className="remote-status remote-error"><span>추가 검색을 연결하지 못했어요.</span><button className="text-button" onClick={onRetry}>다시 시도</button></div>}
      </div>
      <div className="dialog-footer"><span><Check size={13} /> 자동 저장</span><button className="primary-button" onClick={onClose}>선택 완료</button></div>
    </div>
  </dialog>, document.body);
}
