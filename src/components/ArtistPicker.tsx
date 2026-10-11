import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LoaderCircle, Music2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { GENRE_LABELS, type Artist, type Gender, type Genre, type Portrait, type Tier } from '../types';
import { GENDER_LABELS } from '../data/artists';
import { Avatar } from './Avatar';
import { DiscoveryTags, type DiscoveryTagFilters } from './DiscoveryTags';

export function ArtistPicker({ tier, artists, portraits, placements, count, query, onQuery, genre, onGenre, gender, onGender, kind, onKind, onReset, tagFilters, total, onMore, searching, searchError, onRetry, onAdd, onClose }: {
  tier: Tier; artists: Artist[]; portraits: Record<string, Portrait>; placements: Map<string, Tier>; count: number;
  query: string; onQuery: (query: string) => void; total: number; onMore: () => void;
  genre: Genre | 'all'; onGenre: (genre: Genre | 'all') => void;
  gender: Gender | 'all'; onGender: (gender: Gender | 'all') => void;
  kind: Artist['kind'] | 'all'; onKind: (kind: Artist['kind'] | 'all') => void; onReset: () => void;
  tagFilters?: DiscoveryTagFilters;
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
      <div className="picker-filters">
        <label className="kind-filter genre-filter"><Music2 size={15} /><select title="주요 활동 장르 기준 · 여러 장르에 포함될 수 있습니다" aria-label="음악 장르 필터" value={genre} onChange={event => onGenre(event.target.value as typeof genre)}><option value="all">전체 장르</option>{Object.entries(GENRE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="kind-filter"><SlidersHorizontal size={15} /><select aria-label="솔로 및 그룹 필터" value={kind} onChange={event => onKind(event.target.value as typeof kind)}><option value="all">솔로 + 그룹</option><option value="solo">솔로만</option><option value="group">그룹만</option></select></label>
      </div>
      <div className="filter-bar"><div className="gender-filters" aria-label="성별 필터" title="그룹은 멤버 구성 기준">{(['all', 'male', 'female', 'mixed'] as const).map(value => <button key={value} aria-pressed={gender === value} onClick={() => onGender(value)} className={gender === value ? 'active' : ''}>{value === 'all' ? '전체' : GENDER_LABELS[value]}</button>)}</div><span className="filter-count">{total}명</span></div>
      {tagFilters && <DiscoveryTags {...tagFilters} />}
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
      {!artists.length && !searching && <div className="result-message"><Search size={25} /><p>조건에 맞는 아티스트가 없어요.</p><button className="text-button" onClick={onReset}>검색 및 필터 초기화</button></div>}
      {artists.length < total && <button className="load-more" onClick={onMore}>더 보기 <span>{artists.length} / {total}</span><ChevronDown size={16} /></button>}
      {searching && <div className="remote-status" role="status"><LoaderCircle className="spin" size={14} /> 추가 아티스트를 검색하고 있어요.</div>}
      {searchError && <div className="remote-status remote-error"><span>추가 검색을 연결하지 못했어요.</span><button className="text-button" onClick={onRetry}>다시 시도</button></div>}
      </div>
      <div className="dialog-footer"><span><Check size={13} /> 자동 저장</span><button className="primary-button" onClick={onClose}>선택 완료</button></div>
    </div>
  </dialog>, document.body);
}
