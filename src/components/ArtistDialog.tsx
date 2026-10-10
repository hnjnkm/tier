import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Disc3, ExternalLink, LoaderCircle, Pause, Play, Plus, Search, X } from 'lucide-react';
import { GENDER_LABELS } from '../data/artists';
import { audioUrl, getJson, imageUrl } from '../api';
import { TIERS, type Artist, type MusicAlbum, type Portrait, type Song, type Tier } from '../types';
import { selectedSong, songAlbums, visibleSongs, type SongSort } from '../song-catalog';
import { Avatar } from './Avatar';

export function ArtistDialog({ artist, portrait, tier, favorites, onMove, onToggle, onClose }: {
  artist: Artist; portrait?: Portrait; tier?: Tier; favorites: Song[];
  onMove: (tier: Tier | 'pool') => void; onToggle: (song: Song) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<MusicAlbum[] | undefined>();
  const [albumId, setAlbumId] = useState('');
  const [sort, setSort] = useState<SongSort>('popular');
  const [source, setSource] = useState('');
  const [groupCollection, setGroupCollection] = useState(false);
  const [complete, setComplete] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    return () => { audio.current?.pause(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const data = await getJson<{ songs: Song[]; albums?: MusicAlbum[]; source?: string; complete?: boolean; members?: unknown[] }>(`/api/artists/${encodeURIComponent(artist.id)}/songs`, controller.signal);
        setSongs(data.songs); setAlbums(data.albums); setSource(data.source ?? ''); setComplete(data.complete !== false);
        setGroupCollection(!!data.members?.length);
      } catch (error) {
        if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : '곡을 불러오지 못했어요.'); setSongs([]); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); };
  }, [artist.id, retry]);

  const albumOptions = useMemo(() => songAlbums(songs, albums), [songs, albums]);
  const selectedAlbum = albumOptions.find(album => album.id === albumId);
  const results = useMemo(() => visibleSongs(songs, query, sort, selectedAlbum), [songs, query, sort, selectedAlbum]);

  async function play(song: Song) {
    audio.current?.pause();
    if (playing === song.id) { setPlaying(null); return; }
    if (!song.previewUrl) return;
    const player = new Audio(audioUrl(song.previewUrl));
    audio.current = player;
    player.onended = () => setPlaying(null);
    player.onerror = () => { setPlaying(null); setFeedback('이 곡의 미리듣기를 재생하지 못했어요.'); };
    setPlaying(song.id);
    try { await player.play(); } catch { if (audio.current === player) { setPlaying(null); setFeedback('미리듣기를 재생하지 못했어요.'); } }
  }

  function selectSong(song: Song) {
    const existing = selectedSong(song, favorites);
    if (!existing && favorites.length >= 3) { setFeedback('대표곡은 최대 3개예요. 먼저 선택한 곡 하나를 빼 주세요.'); return; }
    setFeedback('');
    onToggle(existing ?? song);
  }

  return createPortal(<dialog className="artist-dialog" ref={dialog} onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="artist-dialog-title">
    <div className="dialog-inner">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="닫기"><X size={21} /></button>
      <div className="dialog-artist">
        <Avatar artist={artist} portrait={portrait} className="dialog-avatar" />
        <div><h2 id="artist-dialog-title">{artist.name}</h2><p>{artist.kind === 'solo' ? '솔로' : '그룹'} <span>·</span> {GENDER_LABELS[artist.gender]}</p>
          {portrait && <a className="portrait-source" href={portrait.pageUrl} target="_blank" rel="noreferrer">사진 출처 · {portrait.provider === 'bugs' ? '벅스' : portrait.provider === 'melon' ? '멜론' : 'Wikimedia'} <ExternalLink size={11} /></a>}
        </div>
      </div>
      <div className="dialog-tier"><span>나의 티어</span><div className="tier-picker">{TIERS.map(item => <button key={item} className={`tier-pick tier-${item} ${tier === item ? 'selected' : ''}`} aria-label={`${artist.name} ${item} 티어로 이동`} aria-pressed={tier === item} onClick={() => onMove(item)}>{item}</button>)}<button className={`pool-pick ${!tier ? 'selected' : ''}`} aria-pressed={!tier} onClick={() => onMove('pool')}>보관함</button></div></div>
      <section className="equipped-section" aria-label="선택한 대표곡">
        <div className="section-label"><h3>대표곡</h3><span><strong>{favorites.length}</strong> / 3</span></div>
        <div className="song-slots">{Array.from({ length: 3 }, (_, index) => {
          const song = favorites[index];
          return <div className={`song-slot ${song ? 'filled' : ''}`} key={index}>
            <span className="slot-number">0{index + 1}</span>
            {song ? <><div className="slot-art">{song.artwork ? <img src={imageUrl(song.artwork)} alt="" /> : <Disc3 size={27} />}</div><strong title={song.title}>{song.title}</strong><span className="slot-album" title={song.album}>{song.album || song.artistName}</span><button className="remove-song" onClick={() => onToggle(song)} aria-label={`${song.title} 대표곡에서 제거`}><X size={13} /></button></> : <><div className="empty-slot-icon"><Plus size={22} /></div><span>곡 선택</span></>}
          </div>;
        })}</div>
      </section>
      <section className="song-search-section">
        <div className="section-label"><h3>곡 검색</h3><span className="provider-label">{source === 'youtube-music' ? 'YouTube Music · 한국' : source === 'bugs' ? '벅스 · 한국' : source === 'melon' ? '멜론 · 한국' : source === 'apple-music-kr' ? 'Apple Music · 한국' : ''}</span></div>
        <label className="search-field song-search"><Search size={18} /><input aria-label="곡 제목 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="곡 제목으로 검색" maxLength={100} />{query && <button onClick={() => setQuery('')} aria-label="곡 검색어 지우기"><X size={15} /></button>}</label>
        <div className="song-filters">
          <select aria-label="곡 정렬" value={sort} onChange={event => setSort(event.target.value as SongSort)}><option value="popular">인기순</option><option value="latest">최신순</option><option value="album">앨범순</option></select>
          <select aria-label="앨범 선택" value={albumId} onChange={event => setAlbumId(event.target.value)}><option value="">전체 앨범</option>{albumOptions.map(album => <option key={album.id} value={album.id}>{album.title}{album.year ? ` (${album.year})` : ''}</option>)}</select>
          <span>{results.length}곡</span>
        </div>
        {sort === 'latest' && <p className="catalog-status">발매일이 없는 곡은 발매연도 기준</p>}
        {sort === 'popular' && source === 'youtube-music' && <p className="catalog-status">{groupCollection ? '유닛별 인기곡을 번갈아 표시' : 'YouTube Music 아티스트 곡 순서 기준'}</p>}
        {source === 'bugs' && <p className="catalog-status">YouTube Music에서 인물을 확인할 수 없어 검증된 국내 목록으로 보완했어요.{sort === 'popular' ? ' 벅스 인기곡 순서 기준' : ''}</p>}
        {source === 'melon' && <p className="catalog-status">YouTube Music에서 인물을 확인할 수 없어 검증된 국내 목록으로 보완했어요.{sort === 'popular' ? ' 멜론 인기곡 순서 기준' : ''}</p>}
        {!complete && <p className="catalog-status">일부 앨범을 갱신 중이에요.</p>}
        <div className="song-results" aria-live="polite" aria-busy={loading}>
          {loading ? <div className="result-message"><LoaderCircle className="spin" size={25} /><p>이 가수의 곡을 찾고 있어요</p></div> : error ? <div className="result-message"><Disc3 size={30} /><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div> : !results.length ? <div className="result-message"><Search size={28} /><p>{query || albumId ? '선택한 조건에 맞는 곡이 없어요.' : '등록된 음원을 찾지 못했어요.'}</p>{(query || albumId) && <button className="text-button" onClick={() => { setQuery(''); setAlbumId(''); }}>전체 곡 보기</button>}</div> : results.map(song => {
            const selected = !!selectedSong(song, favorites);
            return <div className={`song-result ${selected ? 'is-selected' : ''}`} key={song.id}>
              <div className="result-art">{song.artwork ? <img src={imageUrl(song.artwork)} loading="lazy" alt="" /> : <Disc3 size={22} />}</div>
              <div className="song-info"><strong title={song.title}>{song.title}</strong><span title={song.album}>{song.artistName} · {song.album}{song.year ? ` · ${song.year}` : ''}</span></div>
              {song.previewUrl && <button className="icon-button preview-button" onClick={() => play(song)} aria-label={`${song.title} ${playing === song.id ? '미리듣기 중지' : '미리듣기'}`}>{playing === song.id ? <Pause size={15} /> : <Play size={15} />}</button>}
              {!song.previewUrl && song.url && <a className="icon-button preview-button" href={song.url} target="_blank" rel="noreferrer" aria-label={`${song.title} ${source === 'bugs' ? '벅스' : source === 'melon' ? '멜론' : 'YouTube Music'}에서 듣기`}><Play size={15} /></a>}
              <button className={`equip-button ${selected ? 'selected' : ''}`} aria-label={`${song.title} ${selected ? '선택 해제' : '대표곡으로 선택'}`} aria-pressed={selected} onClick={() => selectSong(song)}>{selected ? <Check size={17} /> : <Plus size={17} />}<span>{selected ? '선택됨' : '선택'}</span></button>
            </div>;
          })}
        </div>
      </section>
      {feedback && <p className="dialog-notice" role="status">{feedback}</p>}
      <div className="dialog-footer"><span><Check size={13} /> 자동 저장</span><button className="primary-button" onClick={onClose}>선택 완료</button></div>
    </div>
  </dialog>, document.body);
}
