import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Check, ChevronDown, Disc3, Grip, Heart, HelpCircle, LoaderCircle, Music2, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { CATALOG, GENDER_LABELS } from './data/artists';
import { allArtists, createBoard, findTier, matchesFilters, moveArtist, normalize, parseBoard, STORAGE_KEY, toggleSong } from './domain';
import { getJson } from './api';
import { GENRE_LABELS, TIERS, type Genre, type Artist, type Board, type Gender, type Portrait, type Song, type Tier } from './types';
import { Avatar } from './components/Avatar';
import { ArtistCard } from './components/ArtistCard';
import { ArtistDialog } from './components/ArtistDialog';

const TIER_DESCRIPTIONS: Record<Tier, string> = { S: '내 플레이리스트의 영원한 1순위', A: '믿고 듣는 아티스트', B: '취향에 잘 맞는 음악', C: '가끔 찾아 듣는 음악', D: '아직은 조금 낯선 음악', E: '내 취향과는 조금 다른 음악', F: '나와는 다른 음악 취향' };
const PAGE_SIZE = 24;

function loadBoard() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { board: createBoard(), warning: '' };
    const board = parseBoard(JSON.parse(saved));
    return { board: board ?? createBoard(), warning: board ? '' : '저장된 보드를 읽지 못했어요. 저장 파일이 있다면 불러와 주세요.' };
  } catch { return { board: createBoard(), warning: '브라우저 저장소를 읽지 못했어요. 저장 파일로 보관해 주세요.' }; }
}

function TierRow({ tier, children, count }: { tier: Tier; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier:${tier}` });
  return <div ref={setNodeRef} className={`tier-row ${isOver ? 'drop-active' : ''}`} data-testid={`tier-${tier}`} aria-label={`${tier} 티어`}>
    <div className={`tier-label tier-${tier}`} title={TIER_DESCRIPTIONS[tier]}><strong>{tier}</strong><span>{count.toString().padStart(2, '0')}</span></div>
    <div className="tier-content">{count ? children : <div className="tier-empty"><Plus size={15} /><span>{isOver ? '여기에 놓아주세요' : TIER_DESCRIPTIONS[tier]}</span></div>}</div>
  </div>;
}

function Pool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return <section className={`artist-pool ${isOver ? 'pool-drop-active' : ''}`} ref={setNodeRef} aria-labelledby="pool-title" data-testid="artist-pool">{children}</section>;
}

function addCustom(board: Board, artist: Artist): Board {
  return allArtists(board).some(item => item.id === artist.id) ? board : { ...board, customArtists: [...board.customArtists, artist] };
}

export default function App() {
  const [initial] = useState(loadBoard);
  const [board, setBoard] = useState<Board>(initial.board);
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [genre, setGenre] = useState<Genre | 'all'>('all');
  const [kind, setKind] = useState<'all' | 'solo' | 'group'>('all');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [remote, setRemote] = useState<Artist[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetry, setSearchRetry] = useState(0);
  const [portraits, setPortraits] = useState<Record<string, Portrait>>({});
  const [portraitError, setPortraitError] = useState(false);
  const [portraitRetry, setPortraitRetry] = useState(0);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState(initial.warning);
  const [saveError, setSaveError] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(board.title);
  const importInput = useRef<HTMLInputElement>(null);
  const downloadMenu = useRef<HTMLDetailsElement>(null);
  const requestedPortraits = useRef(new Set<string>());
  const lastSaved = useRef(JSON.stringify(initial.board));
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const artists = useMemo(() => allArtists(board), [board]);
  const combined = useMemo(() => [...artists, ...remote.filter(artist => !artists.some(item => item.id === artist.id))], [artists, remote]);
  const artistMap = useMemo(() => new Map(combined.map(artist => [artist.id, artist])), [combined]);
  const assignedIds = TIERS.flatMap(tier => board.tiers[tier]);
  const assigned = new Set(assignedIds);
  const filtered = combined.filter(artist => !assigned.has(artist.id) && matchesFilters(artist, { query, gender, kind, genre }));
  const visible = filtered.slice(0, pageSize);
  const currentPortraitIds = [...new Set([...visible.map(artist => artist.id), ...assignedIds, ...(selected ? [selected.id] : [])])].join(',');
  const favoriteCount = Object.values(board.favorites).reduce((sum, songs) => sum + songs.length, 0);
  const activeArtist = activeId ? artistMap.get(activeId) : undefined;

  useEffect(() => {
    const serialized = JSON.stringify(board);
    if (lastSaved.current === serialized) return;
    try { localStorage.setItem(STORAGE_KEY, serialized); lastSaved.current = serialized; setSaveError(false); }
    catch { setSaveError(true); }
  }, [board]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setPageSize(PAGE_SIZE); }, [query, gender, kind, genre]);

  useEffect(() => {
    const clean = query.trim();
    const controller = new AbortController();
    setRemote([]); setSearchError(''); setSearching(false);
    if (clean.length < 2 || CATALOG.some(artist => [artist.name, artist.englishName, ...artist.aliases, ...(artist.searchAliases ?? [])].some(name => normalize(name) === normalize(clean)))) return;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<{ artists: Artist[] }>(`/api/artists/search?q=${encodeURIComponent(clean)}`, controller.signal);
        setRemote(data.artists);
      } catch (error) { if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : '외부 검색을 연결하지 못했어요.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 600);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, searchRetry]);

  useEffect(() => {
    const missing = currentPortraitIds.split(',').filter(id => id && !requestedPortraits.current.has(id));
    if (!missing.length) return;
    missing.forEach(id => requestedPortraits.current.add(id));
    for (let offset = 0; offset < missing.length; offset += 40) {
      const ids = missing.slice(offset, offset + 40);
      getJson<{ portraits: Record<string, Portrait> }>(`/api/portraits?ids=${encodeURIComponent(ids.join(','))}`).then(data => setPortraits(current => ({ ...current, ...data.portraits }))).catch(() => setPortraitError(true));
    }
  }, [currentPortraitIds, portraitRetry]);

  function openArtist(artist: Artist) { setBoard(current => addCustom(current, artist)); setSelected(artist); }

  function finishDrag(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const artist = artistMap.get(String(event.active.id));
    if (!artist) return;
    const overId = String(event.over.id);
    setBoard(current => {
      const base = addCustom(current, artist);
      const source = findTier(base, artist.id);
      const target = overId.startsWith('tier:') ? overId.slice(5) as Tier : overId === 'pool' ? 'pool' : findTier(base, overId) ?? 'pool';
      if (source && target === source && base.tiers[source].includes(overId)) return { ...base, tiers: { ...base.tiers, [source]: arrayMove(base.tiers[source], base.tiers[source].indexOf(artist.id), base.tiers[source].indexOf(overId)) } };
      return moveArtist(base, artist.id, target, overId);
    });
  }

  function exportBoard() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'my-tier.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (downloadMenu.current) downloadMenu.current.open = false;
    setNotice('가수 티어와 대표곡을 저장 파일로 내보냈어요.');
  }

  async function importBoard(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('저장 파일은 2MB 이하로 골라 주세요.');
      const parsed = parseBoard(JSON.parse(await file.text()));
      if (!parsed) throw new Error('올바른 my tier. 저장 파일이 아니에요.');
      if ((assignedIds.length || favoriteCount) && !window.confirm('현재 보드를 저장 파일의 내용으로 바꿀까요?')) return;
      setBoard(parsed); setDraftTitle(parsed.title); setSelected(null); setNotice('저장한 음악 취향을 불러왔어요.');
    } catch (error) { setNotice(error instanceof Error ? error.message : '파일을 읽지 못했어요.'); }
    finally { if (importInput.current) importInput.current.value = ''; if (downloadMenu.current) downloadMenu.current.open = false; }
  }

  function resetBoard() {
    if (window.confirm('티어 배치와 대표곡을 모두 비울까요? 이 작업 전에 저장 파일로 보관할 수 있어요.')) {
      setBoard(createBoard()); setDraftTitle('나의 아티스트 티어'); setNotice('보드를 비웠어요. 새로운 취향으로 채워보세요.');
    }
  }

  function retryPortraits() { currentPortraitIds.split(',').forEach(id => requestedPortraits.current.delete(id)); setPortraitError(false); setPortraitRetry(value => value + 1); }
  function finishTitle() { const title = draftTitle.trim() || '나의 아티스트 티어'; setBoard(current => ({ ...current, title })); setDraftTitle(title); setEditingTitle(false); }

  const renderCard = (artist: Artist, compact = false) => <ArtistCard key={artist.id} artist={artist} portrait={portraits[artist.id]} songCount={board.favorites[artist.id]?.length ?? 0} onOpen={openArtist} compact={compact} />;

  return <>
    <header className="site-header"><div className="header-inner"><a className="brand" href={import.meta.env.BASE_URL} aria-label="my tier. 홈"><span className="brand-symbol"><i /><i /><i /><i /></span><span>my tier<span className="brand-period">.</span></span></a><div className="header-divider" /><span className="header-tagline">MY MUSIC, MY RULES</span><div className="header-right"><span className={`save-status ${saveError ? 'save-failed' : ''}`}><span className="status-dot" />{saveError ? '저장 파일로 보관해 주세요' : '이 브라우저에 자동 저장'}</span><details className="download-menu" ref={downloadMenu}><summary className="secondary-button"><ArrowDownToLine size={15} /> 내 티어 저장 <ChevronDown size={13} /></summary><div className="download-options"><button onClick={exportBoard}><ArrowDownToLine size={16} /> 저장 파일 내보내기</button><button onClick={() => importInput.current?.click()}><ArrowUpFromLine size={16} /> 저장 파일 불러오기</button></div></details><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event => importBoard(event.target.files?.[0])} /></div></div></header>
    <main className="page-shell">
      <section className="hero"><div className="hero-copy"><div className="hero-eyebrow"><span /> 취향에는 정답이 없으니까</div><h1>좋아하는 가수,<br /><span>나만의 티어로.</span></h1><p>최애는 S, 숨은 취향은 어디쯤?<br className="mobile-break" /> 가수를 놓고, 좋아하는 곡 세 개로 완성하세요.</p><div className="hero-steps"><span><b>01</b> 가수를 고르고</span><ArrowRight size={13} /><span><b>02</b> 티어에 놓고</span><ArrowRight size={13} /><span><b>03</b> 대표곡을 장착!</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-note note-one"><Heart size={13} fill="currentColor" /> 100% MY TASTE</div><div className="vinyl"><div className="vinyl-label"><Music2 size={28} /><span>ON REPEAT</span><i /></div></div><div className="floating-tier">S<span>FAVORITE<br />OF ALL TIME</span><Sparkles size={20} /></div><div className="art-note note-two">YOUR TASTE,<br />YOUR RULES.</div><div className="art-spark">✳</div></div></section>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => setActiveId(String(event.active.id))} onDragEnd={finishDrag} onDragCancel={() => setActiveId(null)} accessibility={{ announcements: { onDragStart: ({ active }) => `${artistMap.get(String(active.id))?.name ?? '가수'} 이동을 시작합니다.`, onDragOver: ({ over }) => over ? `${String(over.id).startsWith('tier:') ? `${String(over.id).slice(5)} 티어` : '가수 위치'} 위입니다.` : '이동 중입니다.', onDragEnd: () => '가수 배치를 완료했습니다.', onDragCancel: () => '이동을 취소했습니다.' }, screenReaderInstructions: { draggable: '스페이스 키로 가수를 집어 들고 방향키로 이동하세요. 다시 스페이스 키로 배치하거나 Escape 키로 취소할 수 있습니다. 가수 버튼에서 Enter 키를 누르면 티어 선택 창이 열립니다.' } }}>
        <section className="board-section" aria-labelledby="board-title">
          <div className="board-heading"><div className="board-heading-title"><span className="section-icon"><Grip size={18} /></span>{editingTitle ? <input className="title-input" aria-label="티어 보드 이름" autoFocus maxLength={80} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} onBlur={finishTitle} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraftTitle(board.title); setEditingTitle(false); } }} /> : <h2 id="board-title">{board.title}</h2>}<button className="icon-button edit-title" onClick={() => { setDraftTitle(board.title); setEditingTitle(true); }} aria-label="보드 이름 바꾸기"><Pencil size={14} /></button></div><div className="board-tools"><span className="board-count">{assignedIds.length}명의 가수 <span>·</span> {favoriteCount}개의 곡</span><button className="text-button reset-button" onClick={resetBoard} disabled={!assignedIds.length && !favoriteCount && !board.customArtists.length}><RotateCcw size={14} /> 초기화</button></div></div>
          <div className="tier-board">{TIERS.map(tier => <TierRow key={tier} tier={tier} count={board.tiers[tier].length}><SortableContext items={board.tiers[tier]} strategy={rectSortingStrategy}>{board.tiers[tier].map(id => artistMap.get(id)).filter((artist): artist is Artist => !!artist).map(artist => renderCard(artist, true))}</SortableContext></TierRow>)}</div>
          <div className="board-footnote"><span><HelpCircle size={13} /> 가수를 끌어 놓거나, 사진을 눌러 티어를 선택하세요.</span><span><Music2 size={13} /> 가수당 대표곡 최대 3개</span></div>
        </section>
        <div className="pool-connector"><ArrowDown size={16} /><span>아래에서 내 취향을 찾아보세요</span></div>
        <Pool>
          <div className="pool-heading"><div><div className="pool-eyebrow">THE ARTIST COLLECTION</div><h2 id="pool-title">가수 보관함 <span>{artists.length}</span></h2><p>이름으로 찾고, 끌어 놓고, 나만의 라인업을 만들어보세요.</p></div><span className="catalog-tag"><Disc3 size={14} /> KOREAN ARTISTS</span></div>
          <div className="pool-controls"><label className="search-field artist-search"><Search size={19} /><input aria-label="가수 이름 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="어떤 가수를 좋아하세요? 이름으로 검색" maxLength={100} />{query ? <button aria-label="가수 검색어 지우기" onClick={() => setQuery('')}><X size={16} /></button> : <span className="search-hint">가수 검색</span>}</label><label className="kind-filter genre-filter"><Music2 size={15} /><select aria-label="음악 장르 필터" value={genre} onChange={event => setGenre(event.target.value as typeof genre)}><option value="all">전체 장르</option>{Object.entries(GENRE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="kind-filter"><SlidersHorizontal size={15} /><select aria-label="솔로 및 그룹 필터" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="all">솔로 + 그룹</option><option value="solo">솔로만</option><option value="group">그룹만</option></select></label></div>
          <p className="genre-help">가수의 주요 활동 장르 기준 · 여러 장르에 표시될 수 있어요</p><div className="filter-bar"><div className="gender-filters" aria-label="성별 필터">{(['all', 'male', 'female', 'mixed'] as const).map(value => <button key={value} aria-pressed={gender === value} onClick={() => setGender(value)} className={gender === value ? 'active' : ''}>{value === 'all' ? '전체' : GENDER_LABELS[value]}</button>)}</div><span className="filter-count">{query ? `'${query}' 검색 · ` : ''}{filtered.length}명의 가수{gender !== 'all' && <span className="gender-note"> · 그룹은 멤버 구성 기준</span>}</span></div>
          <SortableContext items={visible.map(artist => artist.id)} strategy={rectSortingStrategy}><div className="artist-grid">{visible.map(artist => renderCard(artist))}</div></SortableContext>
          {!filtered.length && <div className="empty-search"><Search size={30} /><h3>{searching ? '목록 밖의 가수도 찾고 있어요' : query || gender !== 'all' || kind !== 'all' || genre !== 'all' ? '조건에 맞는 가수가 없어요' : '모든 가수가 티어에 배치됐어요'}</h3><p>{query || gender !== 'all' || kind !== 'all' || genre !== 'all' ? '다른 이름으로 검색하거나 필터를 바꿔보세요.' : '가수를 보관함으로 다시 끌어 놓을 수도 있어요.'}</p>{(query || gender !== 'all' || kind !== 'all' || genre !== 'all') && <button className="text-button" onClick={() => { setQuery(''); setGender('all'); setKind('all'); setGenre('all'); }}>검색 및 필터 초기화</button>}</div>}
          {filtered.length > pageSize && <button className="load-more" onClick={() => setPageSize(size => size + PAGE_SIZE)}>가수 더 보기 <span>{Math.min(pageSize, filtered.length)} / {filtered.length}</span><ChevronDown size={16} /></button>}
          {searching && <div className="remote-status"><LoaderCircle className="spin" size={14} /> 기본 목록 밖의 국내 가수를 검색하고 있어요.</div>}
          {searchError && <div className="remote-status remote-error"><span>추가 가수 검색을 연결하지 못했어요. 기본 목록은 계속 사용할 수 있어요.</span><button className="text-button" onClick={() => setSearchRetry(value => value + 1)}>다시 시도</button></div>}
          {portraitError && <div className="photo-status"><span>일부 가수 사진을 불러오지 못했어요.</span><button onClick={retryPortraits}>사진 다시 불러오기</button></div>}
          <div className="collection-tip"><span className="tip-icon"><Music2 size={16} /></span><div><strong>취향을 더 자세히 남기고 싶다면?</strong><span>가수 사진을 클릭하고, 좋아하는 곡을 대표곡 슬롯에 장착해 보세요.</span></div><span className="tip-decoration">♫</span></div>
        </Pool>
        <DragOverlay dropAnimation={null}>{activeArtist && <div className="artist-card compact overlay-card"><Avatar artist={activeArtist} portrait={portraits[activeArtist.id]} /><span className="artist-name">{activeArtist.name}</span></div>}</DragOverlay>
      </DndContext>
      <footer className="site-footer"><span className="footer-brand">my tier<span>.</span></span><p>좋아하는 음악을, 좋아하는 만큼.</p><div><span>사진 · 벅스 / Wikimedia</span><span>가수 검색 · MusicBrainz</span><span>곡 · iTunes</span></div></footer>
    </main>
    {selected && <ArtistDialog key={selected.id} artist={selected} portrait={portraits[selected.id]} tier={findTier(board, selected.id)} favorites={board.favorites[selected.id] ?? []} onMove={target => setBoard(current => moveArtist(current, selected.id, target))} onToggle={(song: Song) => setBoard(current => toggleSong(current, selected.id, song))} onClose={() => setSelected(null)} />}
    {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="알림 닫기"><X size={14} /></button></div>}
  </>;
}
