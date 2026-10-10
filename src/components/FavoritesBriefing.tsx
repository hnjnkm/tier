import { Plus } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Artist, Portrait, Song } from '../types';

export function FavoritesBriefing({ artists, favorites, portraits, onOpen, onAdd }: {
  artists: Artist[]; favorites: Record<string, Song[]>; portraits: Record<string, Portrait>; onOpen: (artist: Artist) => void; onAdd: () => void;
}) {
  const songCount = artists.reduce((count, artist) => count + (favorites[artist.id]?.length ?? 0), 0);
  return <section className="favorites-briefing" aria-labelledby="favorites-title" data-testid="favorites-briefing">
    <div className="favorites-heading">
      <h2 id="favorites-title"><span>S</span>나의 최애</h2>
      {!!artists.length && <span>{artists.length}명 · {songCount}곡</span>}
    </div>
    {!artists.length ? <div className="favorites-empty-state"><p>S티어에 최애 아티스트를 추가해 주세요.</p><button className="text-button" onClick={onAdd}><Plus size={14} />아티스트 추가</button></div> : <div className="favorites-list">
      {artists.map(artist => <button key={artist.id} className="favorite-entry" onClick={() => onOpen(artist)} aria-label={`${artist.name} S티어 대표곡 편집`}>
        <Avatar artist={artist} portrait={portraits[artist.id]} className="briefing-avatar" />
        <span className="favorite-copy">
          <strong className="favorite-name">{artist.name}</strong>
          {favorites[artist.id]?.length ? <span className="favorite-songs">{favorites[artist.id].map(song => <span key={song.id} title={song.title}>{song.title}</span>)}</span> : <span className="favorite-empty">곡 선택</span>}
        </span>
      </button>)}
    </div>}
  </section>;
}
