import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Disc3, ExternalLink, LoaderCircle, Music2, Pause, Play, Plus, Search, X } from 'lucide-react';
import { GENDER_LABELS } from '../data/artists';
import { audioUrl, getJson, imageUrl } from '../api';
import { TIERS, type Artist, type Portrait, type Song, type Tier } from '../types';
import { Avatar } from './Avatar';

export function ArtistDialog({ artist, portrait, tier, favorites, onMove, onToggle, onClose }: {
  artist: Artist; portrait?: Portrait; tier?: Tier; favorites: Song[];
  onMove: (tier: Tier | 'pool') => void; onToggle: (song: Song) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
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
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<{ songs: Song[] }>(`/api/artists/${encodeURIComponent(artist.id)}/songs?q=${encodeURIComponent(query.trim())}`, controller.signal);
        setSongs(data.songs);
      } catch (error) {
        if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : '곡을 불러오지 못했어요.'); setSongs([]); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 400 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [artist.id, query, retry]);

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
    if (!favorites.some(item => item.id === song.id) && favorites.length >= 3) { setFeedback('대표곡은 최대 3개예요. 먼저 선택한 곡 하나를 빼 주세요.'); return; }
    setFeedback('');
    onToggle(song);
  }

  return createPortal(<dialog className="artist-dialog" ref={dialog} onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="artist-dialog-title">
    <div className="dialog-inner">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="닫기"><X size={21} /></button>
      <div className="dialog-artist">
        <Avatar artist={artist} portrait={portrait} className="dialog-avatar" />
        <div><span className="eyebrow">THE ARTIST / PERSONAL EDIT</span><h2 id="artist-dialog-title">{artist.name}</h2><p>{artist.englishName} <span>·</span> {artist.kind === 'solo' ? '솔로' : '그룹'} <span>·</span> {GENDER_LABELS[artist.gender]}</p>
          {portrait && <a className="portrait-source" href={portrait.pageUrl} target="_blank" rel="noreferrer">사진 출처 · {portrait.provider === 'bugs' ? '벅스' : 'Wikimedia'} <ExternalLink size={11} /></a>}
        </div>
      </div>
      <div className="dialog-tier"><span>나의 티어</span><div className="tier-picker">{TIERS.map(item => <button key={item} className={`tier-pick tier-${item} ${tier === item ? 'selected' : ''}`} aria-label={`${artist.name} ${item} 티어로 이동`} aria-pressed={tier === item} onClick={() => onMove(item)}>{item}</button>)}<button className={`pool-pick ${!tier ? 'selected' : ''}`} aria-pressed={!tier} onClick={() => onMove('pool')}>보관함</button></div></div>
      <section className="equipped-section" aria-label="선택한 대표곡">
        <div className="section-label"><h3>나만의 대표곡</h3><span><strong>{favorites.length}</strong> / 3</span></div>
        <p className="section-description">이 목소리를 기억하는 당신만의 세 곡.</p>
        <div className="song-slots">{Array.from({ length: 3 }, (_, index) => {
          const song = favorites[index];
          return <div className={`song-slot ${song ? 'filled' : ''}`} key={index}>
            <span className="slot-number">0{index + 1}</span>
            {song ? <><div className="slot-art">{song.artwork ? <img src={imageUrl(song.artwork)} alt="" /> : <Disc3 size={27} />}</div><strong title={song.title}>{song.title}</strong><span className="slot-album" title={song.album}>{song.album || song.artistName}</span><button className="remove-song" onClick={() => onToggle(song)} aria-label={`${song.title} 대표곡에서 제거`}><X size={13} /></button></> : <><div className="empty-slot-icon"><Plus size={22} /></div><span>곡을 선택하세요</span></>}
          </div>;
        })}</div>
      </section>
      <section className="song-search-section">
        <div className="section-label"><h3>곡 찾아보기</h3><span className="provider-label">iTunes 음악 검색</span></div>
        <p className="section-description">한국어로도 검색할 수 있어요. 제공처에 따라 영문 제목이 표시될 수 있어요.</p>
        <label className="search-field song-search"><Search size={18} /><input aria-label="곡 제목 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="곡 제목으로 검색" maxLength={100} />{query && <button onClick={() => setQuery('')} aria-label="곡 검색어 지우기"><X size={15} /></button>}</label>
        <div className="song-results" aria-live="polite" aria-busy={loading}>
          {loading ? <div className="result-message"><LoaderCircle className="spin" size={25} /><p>이 가수의 곡을 찾고 있어요</p></div> : error ? <div className="result-message"><Disc3 size={30} /><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div> : !songs.length ? <div className="result-message"><Search size={28} /><p>{query ? '이 가수의 곡 중 검색 결과가 없어요.' : '등록된 음원을 찾지 못했어요.'}</p><span>다른 제목으로 검색해 보세요.</span></div> : songs.map(song => {
            const selected = favorites.some(item => item.id === song.id);
            return <div className={`song-result ${selected ? 'is-selected' : ''}`} key={song.id}>
              <div className="result-art">{song.artwork ? <img src={imageUrl(song.artwork)} loading="lazy" alt="" /> : <Disc3 size={22} />}</div>
              <div className="song-info"><strong title={song.title}>{song.title}</strong><span title={song.album}>{song.artistName} · {song.album}{song.year ? ` · ${song.year}` : ''}</span></div>
              {song.previewUrl && <button className="icon-button preview-button" onClick={() => play(song)} aria-label={`${song.title} ${playing === song.id ? '미리듣기 중지' : '미리듣기'}`}>{playing === song.id ? <Pause size={15} /> : <Play size={15} />}</button>}
              <button className={`equip-button ${selected ? 'selected' : ''}`} aria-label={`${song.title} ${selected ? '선택 해제' : '대표곡으로 선택'}`} aria-pressed={selected} onClick={() => selectSong(song)}>{selected ? <Check size={17} /> : <Plus size={17} />}<span>{selected ? '선택됨' : '선택'}</span></button>
            </div>;
          })}
        </div>
      </section>
      {feedback && <p className="dialog-notice" role="status">{feedback}</p>}
      <div className="dialog-footer"><span><Check size={13} /> 선택 내용은 바로 보드에 반영돼요</span><button className="primary-button" onClick={onClose}>선택 완료</button></div>
    </div>
  </dialog>, document.body);
}
