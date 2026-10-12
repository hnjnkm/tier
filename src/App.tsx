import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, LoaderCircle, Menu, Music2, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { GENDER_LABELS } from './data/artists';
import { allArtists, createBoard, findTier, localizeFavorites, matchesFilters, moveArtist, normalize, parseBoard, toggleSong } from './domain';
import { COLLECTION_IDS, COLLECTIONS, collectionFromUrl, collectionUrl, type CollectionId } from './collections';
import { SITE, SITE_LINKS, sitePageUrl } from './site';
import { getJson } from './api';
import { GENRE_LABELS, TIERS, type Genre, type Artist, type Board, type Gender, type Portrait, type Song, type Tier } from './types';
import portraitCatalog from './data/portraits.json';
import { Avatar } from './components/Avatar';
import { ArtistCard } from './components/ArtistCard';
import { ArtistDialog } from './components/ArtistDialog';
import { ArtistPicker } from './components/ArtistPicker';
import { FavoritesBriefing } from './components/FavoritesBriefing';
import { boardCollisionDetection } from './drag';
import { CollectionMenu } from './components/CollectionMenu';
import { DiscoveryTags } from './components/DiscoveryTags';
import type { Era } from './artist-facets';
import { TierSyncProvider, useTierSync } from './components/TierSyncProvider';
import { AccountDialog } from './components/AccountDialog';
import { SyncConflictDialog } from './components/SyncConflictDialog';

const PAGE_SIZE = 50;

function TierRow({ tier, children, count, onAdd }: { tier: Tier; children: React.ReactNode; count: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier:${tier}` });
  return <div ref={setNodeRef} className={`tier-row ${isOver ? 'drop-active' : ''}`} data-testid={`tier-${tier}`} aria-label={`${tier} 티어`}>
    <div className={`tier-label tier-${tier}`}><strong>{tier}</strong>{count > 0 && <span>{count}</span>}</div>
    <div className="tier-content">{children}<button className="tier-add" onClick={onAdd} aria-label={`${tier} 티어에 아티스트 추가`} aria-haspopup="dialog" title={`${tier} 티어에 아티스트 추가`}><Plus size={20} /></button>{!count && isOver && <span className="tier-drop-hint">여기에 놓기</span>}</div>
  </div>;
}

function Pool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return <section id="artist-archive" className={`artist-pool ${isOver ? 'pool-drop-active' : ''}`} ref={setNodeRef} aria-labelledby="pool-title" data-testid="artist-pool">{children}</section>;
}

function addCustom(board: Board, artist: Artist): Board {
  return allArtists(board).some(item => item.id === artist.id) ? board : { ...board, customArtists: [...board.customArtists, artist] };
}

export default function App() {
  return <TierSyncProvider><AppContent /></TierSyncProvider>;
}
function AppContent() {
  const { state } = useTierSync();
  const [collection, setCollection] = useState(collectionFromUrl);
  useEffect(() => {
    document.title = COLLECTIONS[collection].title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = `${SITE.url}${collection === 'global' ? '?chart=global' : ''}`;
  }, [collection]);
  useEffect(() => {
    const restore = () => setCollection(collectionFromUrl());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function selectCollection(next: CollectionId) {
    if (next === collection) return;
    history.pushState(null, '', collectionUrl(next));
    setCollection(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => document.getElementById(`chart-nav-${next}`)?.focus({ preventScroll: true }));
  }
  return <TierBoard key={`${collection}:${state.session}`} collection={collection} onSelectCollection={selectCollection} />;
}

function TierBoard({ collection, onSelectCollection }: { collection: CollectionId; onSelectCollection: (collection: CollectionId) => void }) {
  const definition = COLLECTIONS[collection];
  const { state: syncState, store: syncStore } = useTierSync();
  const board = syncState.boards[collection], sync = syncState.collections[collection];
  const setBoard = (update: Board | ((current: Board) => Board)) => {
    if (syncStore.getSnapshot().session === syncState.session) syncStore.updateBoard(collection, update);
  };
  const accountAvailable = syncState.mode === 'guest' || syncState.mode === 'signed-in';
  const [accountOpen, setAccountOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [genre, setGenre] = useState<Genre | 'all'>('all');
  const [kind, setKind] = useState<'all' | 'solo' | 'group'>('all');
  const [countries, setCountries] = useState<string[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [remote, setRemote] = useState<Artist[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetry, setSearchRetry] = useState(0);
  const [portraits, setPortraits] = useState<Record<string, Portrait>>(portraitCatalog.portraits as Record<string, Portrait>);
  const [portraitError, setPortraitError] = useState(false);
  const [portraitRetry, setPortraitRetry] = useState(0);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [pickerTier, setPickerTier] = useState<Tier | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerGender, setPickerGender] = useState<Gender | 'all'>('all');
  const [pickerGenre, setPickerGenre] = useState<Genre | 'all'>('all');
  const [pickerKind, setPickerKind] = useState<Artist['kind'] | 'all'>('all');
  const [pickerCountries, setPickerCountries] = useState<string[]>([]);
  const [pickerEras, setPickerEras] = useState<Era[]>([]);
  const [pickerPageSize, setPickerPageSize] = useState(PAGE_SIZE);
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState(sync.localError || sync.error);
  const saveError = !!sync.localError;
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(board.title);
  const importInput = useRef<HTMLInputElement>(null);
  const artistOpener = useRef<HTMLElement | null>(null);
  const pickerOpener = useRef<HTMLElement | null>(null);
  const downloadMenu = useRef<HTMLDetailsElement>(null);
  const requestedPortraits = useRef(new Set<string>());
  const requestedSongs = useRef(new Set<string>());
  const artistSearch = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const artists = useMemo(() => allArtists(board), [board]);
  const combined = useMemo(() => [...artists, ...remote.filter(artist => !artists.some(item => item.id === artist.id))], [artists, remote]);
  const artistMap = useMemo(() => new Map(combined.map(artist => [artist.id, artist])), [combined]);
  const assignedIds = TIERS.flatMap(tier => board.tiers[tier]);
  const assigned = new Set(assignedIds);
  const filtered = combined.filter(artist => !assigned.has(artist.id) && matchesFilters(artist, { query, gender, kind, genre, countries, eras }));
  const visible = filtered.slice(0, pageSize);
  const pickerArtists = pickerTier ? combined.filter(artist => matchesFilters(artist, { query: pickerQuery, gender: pickerGender, kind: pickerKind, genre: pickerGenre, countries: pickerCountries, eras: pickerEras })) : [];
  const pickerVisible = pickerArtists.slice(0, pickerPageSize);
  const placements = new Map(TIERS.flatMap(tier => board.tiers[tier].map(id => [id, tier] as const)));
  const currentSearchQuery = pickerTier ? pickerQuery : query;
  const currentPortraitIds = [...new Set([...visible.map(artist => artist.id), ...pickerVisible.map(artist => artist.id), ...assignedIds, ...(selected ? [selected.id] : [])])].join(',');
  const favoriteCount = Object.values(board.favorites).reduce((sum, songs) => sum + songs.length, 0);
  const activeArtist = activeId ? artistMap.get(activeId) : undefined;
  const hasFilters = !!query || gender !== 'all' || kind !== 'all' || genre !== 'all' || countries.length > 0 || eras.length > 0;

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setPageSize(PAGE_SIZE); }, [query, gender, kind, genre, countries, eras]);
  useEffect(() => { setPickerPageSize(PAGE_SIZE); }, [pickerQuery, pickerGender, pickerKind, pickerGenre, pickerCountries, pickerEras]);

  useEffect(() => {
    const songs = Object.values(board.favorites).flat().filter(song => song.locale !== 'ko-KR' && /^itunes:[1-9]\d*$/.test(song.id) && !requestedSongs.current.has(song.id));
    const ids = [...new Set(songs.map(song => song.id.slice(7)))];
    if (!ids.length) return;
    songs.forEach(song => requestedSongs.current.add(song.id));
    void (async () => {
      for (let offset = 0; offset < ids.length; offset += 100) {
        try {
          const data = await getJson<{ songs: Song[] }>(`/api/songs/localize?ids=${ids.slice(offset, offset + 100).join(',')}`);
          setBoard(current => localizeFavorites(current, data.songs));
        } catch { /* Preserve saved selections if regional metadata is temporarily unavailable. */ }
      }
    })();
  }, [board.favorites]);

  useEffect(() => {
    const clean = currentSearchQuery.trim();
    const controller = new AbortController();
    setRemote([]); setSearchError(''); setSearching(false);
    if (clean.length < 2 || definition.artists.some(artist => [artist.name, artist.englishName, ...artist.aliases, ...(artist.searchAliases ?? [])].some(name => normalize(name) === normalize(clean)))) return;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<{ artists: Artist[] }>(`/api/artists/search?q=${encodeURIComponent(clean)}${collection === 'global' ? '&collection=global' : ''}`, controller.signal);
        setRemote(data.artists);
      } catch (error) { if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : '외부 검색을 연결하지 못했어요.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 600);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentSearchQuery, searchRetry, collection, definition.artists]);

  useEffect(() => {
    const missing = currentPortraitIds.split(',').filter(id => id && !portraits[id] && !requestedPortraits.current.has(id));
    if (!missing.length) return;
    missing.forEach(id => requestedPortraits.current.add(id));
    for (let offset = 0; offset < missing.length; offset += 40) {
      const ids = missing.slice(offset, offset + 40);
      getJson<{ portraits: Record<string, Portrait> }>(`/api/portraits?ids=${encodeURIComponent(ids.join(','))}`).then(data => setPortraits(current => ({ ...current, ...data.portraits }))).catch(() => setPortraitError(true));
    }
  }, [currentPortraitIds, portraitRetry]);

  function openArtist(artist: Artist) {
    artistOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBoard(current => addingFavorite ? moveArtist(addCustom(current, artist), artist.id, 'S') : addCustom(current, artist));
    setAddingFavorite(false); setSelected(artist);
  }
  function addFavorite() {
    setAddingFavorite(true); resetFilters();
    document.getElementById('artist-archive')?.scrollIntoView({ block: 'start' });
    artistSearch.current?.focus({ preventScroll: true });
  }
  function openTierPicker(tier: Tier) {
    pickerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAddingFavorite(false); resetPickerFilters(); setPickerPageSize(PAGE_SIZE); setPickerTier(tier);
  }
  function resetPickerFilters() {
    setPickerQuery(''); setPickerGender('all'); setPickerGenre('all'); setPickerKind('all');
    setPickerCountries([]); setPickerEras([]);
  }
  function resetFilters() { setQuery(''); setGender('all'); setGenre('all'); setKind('all'); setCountries([]); setEras([]); }
  function addPickedArtist(artist: Artist) {
    if (!pickerTier) return;
    setBoard(current => findTier(current, artist.id) === pickerTier ? current : moveArtist(addCustom(current, artist), artist.id, pickerTier));
  }
  function closeTierPicker() {
    setPickerTier(null);
    requestAnimationFrame(() => { if (pickerOpener.current?.isConnected) pickerOpener.current.focus({ preventScroll: true }); });
  }
  function closeArtist() {
    const id = selected?.id;
    setSelected(null);
    requestAnimationFrame(() => {
      const opener = artistOpener.current;
      const target = opener?.isConnected ? opener : id ? document.querySelector<HTMLElement>(`[data-artist-id="${CSS.escape(id)}"] .artist-main`) : null;
      target?.focus({ preventScroll: true });
    });
  }

  function finishDrag(event: DragEndEvent) {
    setActiveId(null);
    if (event.active.id === event.over?.id) return;
    const artist = artistMap.get(String(event.active.id));
    if (!artist) return;
    setAddingFavorite(false);
    const overId = event.over ? String(event.over.id) : null;
    setBoard(current => {
      if (!overId) return findTier(current, artist.id) ? moveArtist(current, artist.id, 'pool') : current;
      const base = addCustom(current, artist);
      const source = findTier(base, artist.id);
      const target = overId.startsWith('tier:') ? overId.slice(5) as Tier : overId === 'pool' ? 'pool' : findTier(base, overId) ?? 'pool';
      if (source && target === source && base.tiers[source].includes(overId)) return { ...base, tiers: { ...base.tiers, [source]: arrayMove(base.tiers[source], base.tiers[source].indexOf(artist.id), base.tiers[source].indexOf(overId)) } };
      return moveArtist(base, artist.id, target, overId);
    });
  }

  function exportBoard() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = collection === 'global' ? 'my-tier-global.json' : 'my-tier.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (downloadMenu.current) downloadMenu.current.open = false;
    setNotice('가수 티어와 대표곡을 저장 파일로 내보냈어요.');
  }

  async function importBoard(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('저장 파일은 2MB 이하로 골라 주세요.');
      const parsed = parseBoard(JSON.parse(await file.text()));
      if (syncStore.getSnapshot().session !== syncState.session) return;
      if (!parsed) throw new Error('올바른 티어 저장 파일이 아니에요.');
      if ((parsed.collection ?? 'korean') !== collection) throw new Error(`${COLLECTIONS[parsed.collection ?? 'korean'].label} 티어표를 메뉴에서 선택한 뒤 불러와 주세요.`);
      if ((assignedIds.length || favoriteCount) && !window.confirm('현재 보드를 저장 파일의 내용으로 바꿀까요?')) return;
      requestedSongs.current.clear(); setBoard(parsed); setDraftTitle(parsed.title); setSelected(null); setAddingFavorite(false); setNotice('저장한 음악 취향을 불러왔어요.');
    } catch (error) { setNotice(error instanceof Error ? error.message : '파일을 읽지 못했어요.'); }
    finally { if (importInput.current) importInput.current.value = ''; if (downloadMenu.current) downloadMenu.current.open = false; }
  }

  function resetBoard() {
    if (window.confirm('티어 배치와 대표곡을 모두 비울까요? 이 작업 전에 저장 파일로 보관할 수 있어요.')) {
      requestedSongs.current.clear(); setBoard(createBoard(collection)); setDraftTitle(definition.title); setAddingFavorite(false); setNotice('보드를 비웠어요. 새로운 취향으로 채워보세요.');
    }
  }

  function retryPortraits() { currentPortraitIds.split(',').forEach(id => requestedPortraits.current.delete(id)); setPortraitError(false); setPortraitRetry(value => value + 1); }
  function finishTitle() { const title = draftTitle.trim() || definition.title; setBoard(current => ({ ...current, title })); setDraftTitle(title); setEditingTitle(false); }
  function closeMenu() { setMenuOpen(false); requestAnimationFrame(() => document.getElementById('collection-menu-button')?.focus({ preventScroll: true })); }

  const renderCard = (artist: Artist, compact = false) => <ArtistCard key={artist.id} artist={artist} portrait={portraits[artist.id]} songCount={board.favorites[artist.id]?.length ?? 0} onOpen={openArtist} compact={compact} />;
  const syncLabel = !syncState.user ? '자동 저장' : ({ local: '이 기기에 저장', loading: '티어 불러오는 중', saved: '동기화됨', syncing: '동기화 중', offline: '오프라인 · 이 기기에 보관', conflict: '티어 선택 필요', error: '동기화 확인 필요' } as const)[sync.status];
  const accountSummary = !syncState.user ? 'Google 계정으로 국내·해외 티어를 함께 보관합니다.' : COLLECTION_IDS.map(id => `${id === 'korean' ? '국내' : '해외'} · ${({ local: '이 기기에 저장', loading: '불러오는 중', saved: '동기화됨', syncing: '동기화 중', offline: '오프라인 보관', conflict: '사용할 티어 선택 필요', error: '다시 연결 필요' } as const)[syncState.collections[id].status]}`).join(' / ');

  return <>
    <header className="site-header"><div className="header-inner">
      <div className="header-collection"><button id="collection-menu-button" className="icon-button menu-button" aria-label="사이트 메뉴 열기" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button></div>
      <nav className="header-navigation" aria-label="티어표 선택">{COLLECTION_IDS.map(id => <a key={id} id={`chart-nav-${id}`} href={collectionUrl(id)} aria-current={id === collection ? 'page' : undefined} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); onSelectCollection(id);
      }}>{id === 'korean' ? '국내' : '해외'}</a>)}</nav>
      <div className="header-right"><span className={`save-status ${saveError ? 'save-failed' : ''}`}><span className="status-dot" />{saveError ? '저장 파일로 보관해 주세요' : syncLabel}</span>{accountAvailable && <button className="icon-button header-account" aria-label={syncState.user ? '계정과 동기화' : 'Google 로그인'} aria-haspopup="dialog" onClick={() => setAccountOpen(true)}><UserRound size={18} /></button>}<details className="download-menu" ref={downloadMenu}><summary className="secondary-button">내 티어 저장 <ArrowDownToLine size={15} /></summary><div className="download-options"><button onClick={exportBoard}><ArrowDownToLine size={16} /> 저장 파일 내보내기</button><button onClick={() => importInput.current?.click()}><ArrowUpFromLine size={16} /> 저장 파일 불러오기</button></div></details><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event => importBoard(event.target.files?.[0])} /></div>
    </div></header>
    {menuOpen && <CollectionMenu collection={collection} onSelect={onSelectCollection} onClose={closeMenu} account={accountAvailable ? { label: syncState.user ? '계정과 동기화' : 'Google 로그인', onOpen: () => { setMenuOpen(false); setAccountOpen(true); } } : undefined} />}
    <main className="page-shell">
      {!!syncState.user && (sync.status !== 'saved' || saveError) && <div className="sync-banner" role="status"><p>{sync.error || sync.localError || syncLabel}{sync.status === 'offline' ? ' · 다시 연결하면 동기화합니다.' : ''}</p>{sync.conflict ? <button className="text-button" onClick={() => setConflictOpen(true)}>티어 비교</button> : sync.status === 'error' ? <button className="text-button" onClick={() => syncStore.retry(collection)}>다시 시도</button> : null}</div>}
      <FavoritesBriefing artists={board.tiers.S.map(id => artistMap.get(id)).filter((artist): artist is Artist => !!artist)} favorites={board.favorites} portraits={portraits} collection={collection} onOpen={openArtist} onAdd={addFavorite} />
      <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragStart={event => setActiveId(String(event.active.id))} onDragEnd={finishDrag} onDragCancel={() => setActiveId(null)} accessibility={{ announcements: { onDragStart: ({ active }) => `${artistMap.get(String(active.id))?.name ?? '가수'} 이동을 시작합니다.`, onDragOver: ({ over }) => over ? `${String(over.id).startsWith('tier:') ? `${String(over.id).slice(5)} 티어` : '가수 위치'} 위입니다.` : '이동 중입니다.', onDragEnd: () => '가수 배치를 완료했습니다.', onDragCancel: () => '이동을 취소했습니다.' }, screenReaderInstructions: { draggable: '스페이스 키로 가수를 집어 들고 방향키로 이동하세요. 다시 스페이스 키로 배치하거나 Escape 키로 취소할 수 있습니다. 가수 버튼에서 Enter 키를 누르면 티어 선택 창이 열립니다.' } }}>
        <section id="my-tier" className="board-section" aria-labelledby="board-title">
          <div className="board-heading"><div className="board-heading-title">{editingTitle ? <input className="title-input" aria-label="티어 보드 이름" autoFocus maxLength={80} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} onBlur={finishTitle} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraftTitle(board.title); setEditingTitle(false); } }} /> : <h1 id="board-title">{board.title}</h1>}<button className="icon-button edit-title" onClick={() => { setDraftTitle(board.title); setEditingTitle(true); }} aria-label="보드 이름 바꾸기"><Pencil size={14} /></button></div><div className="board-tools">{(assignedIds.length > 0 || favoriteCount > 0) && <span className="board-count">{assignedIds.length}명 <span>·</span> {favoriteCount}곡</span>}<button className="text-button reset-button" onClick={resetBoard} disabled={!assignedIds.length && !favoriteCount && !board.customArtists.length}><RotateCcw size={14} /> 초기화</button></div></div>
          <div className="tier-board">{TIERS.map(tier => <TierRow key={tier} tier={tier} count={board.tiers[tier].length} onAdd={() => openTierPicker(tier)}><SortableContext id={`tier:${tier}`} items={board.tiers[tier]} strategy={rectSortingStrategy}>{board.tiers[tier].map(id => artistMap.get(id)).filter((artist): artist is Artist => !!artist).map(artist => renderCard(artist, true))}</SortableContext></TierRow>)}</div>
          <p className="board-footnote">+ 버튼이나 드래그로 배치 · 표 밖에 놓으면 목록으로 · 사진을 눌러 곡 선택</p>
        </section>
        <Pool>
          <div className="pool-heading"><h2 id="pool-title">아티스트</h2></div>
          {addingFavorite && <div className="favorite-picking"><p role="status">최애로 추가할 아티스트를 선택해 주세요.</p><button className="text-button" onClick={() => setAddingFavorite(false)}>취소</button></div>}
          <div className="pool-controls"><label className="search-field artist-search"><Search size={19} /><input ref={artistSearch} aria-label="가수 이름 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="아티스트 이름 검색" maxLength={100} />{query ? <button aria-label="가수 검색어 지우기" onClick={() => setQuery('')}><X size={16} /></button> : null}</label><label className="kind-filter genre-filter"><Music2 size={15} /><select title="주요 활동 장르 기준 · 여러 장르에 포함될 수 있습니다" aria-label="음악 장르 필터" value={genre} onChange={event => setGenre(event.target.value as typeof genre)}><option value="all">전체 장르</option>{Object.entries(GENRE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="kind-filter"><SlidersHorizontal size={15} /><select aria-label="솔로 및 그룹 필터" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="all">솔로 + 그룹</option><option value="solo">솔로만</option><option value="group">그룹만</option></select></label></div>
          <div className="filter-bar"><div className="gender-filters" aria-label="성별 필터" title="그룹은 멤버 구성 기준">{(['all', 'male', 'female', 'mixed'] as const).map(value => <button key={value} aria-pressed={gender === value} onClick={() => setGender(value)} className={gender === value ? 'active' : ''}>{value === 'all' ? '전체' : GENDER_LABELS[value]}</button>)}</div><span className="filter-count">{filtered.length}명</span></div>
          {collection === 'global' && <DiscoveryTags artists={combined} countries={countries} eras={eras} onCountries={setCountries} onEras={setEras} />}
          <SortableContext id="pool" items={visible.map(artist => artist.id)} strategy={rectSortingStrategy}><div className="artist-grid">{visible.map(artist => renderCard(artist))}</div></SortableContext>
          {!filtered.length && <div className="empty-search"><Search size={30} /><h3>{searching ? '목록 밖의 가수도 찾고 있어요' : hasFilters ? '조건에 맞는 가수가 없어요' : '모든 가수가 티어에 배치됐어요'}</h3><p>{hasFilters ? '다른 이름으로 검색하거나 필터를 바꿔보세요.' : '가수를 보관함으로 다시 끌어 놓을 수도 있어요.'}</p>{hasFilters && <button className="text-button" onClick={resetFilters}>검색 및 필터 초기화</button>}</div>}
          {filtered.length > pageSize && <button className="load-more" onClick={() => setPageSize(size => size + PAGE_SIZE)}>더 보기 <span>{Math.min(pageSize, filtered.length)} / {filtered.length}</span><ChevronDown size={16} /></button>}
          {searching && <div className="remote-status"><LoaderCircle className="spin" size={14} /> 기본 목록 밖의 국내 가수를 검색하고 있어요.</div>}
          {searchError && <div className="remote-status remote-error"><span>추가 가수 검색을 연결하지 못했어요. 기본 목록은 계속 사용할 수 있어요.</span><button className="text-button" onClick={() => setSearchRetry(value => value + 1)}>다시 시도</button></div>}
          {portraitError && <div className="photo-status"><span>일부 가수 사진을 불러오지 못했어요.</span><button onClick={retryPortraits}>사진 다시 불러오기</button></div>}

        </Pool>
        <DragOverlay dropAnimation={null}>{activeArtist && <div className="artist-card compact overlay-card"><Avatar artist={activeArtist} portrait={portraits[activeArtist.id]} /><span className="artist-name">{activeArtist.name}</span></div>}</DragOverlay>
      </DndContext>
      <footer className="site-footer"><nav aria-label="사이트 정보">{SITE_LINKS.map(item => <a key={item.id} href={sitePageUrl(item.id)}>{item.label}</a>)}</nav><p>사진 · 벅스 / 멜론 / Wikimedia &nbsp; 가수 · MusicBrainz &nbsp; 곡 · YouTube Music / 국내 음원</p></footer>
    </main>
    {accountOpen && <AccountDialog user={syncState.user} busy={syncState.authBusy} error={syncState.authError || COLLECTION_IDS.map(id => syncState.collections[id].error).filter(Boolean).join(' ')} syncSummary={accountSummary} onSignIn={() => void syncStore.signIn()} onSignOut={() => void syncStore.signOut()} onRetry={() => { if (syncState.user) syncStore.retry(); else void syncStore.signIn(); }} onClose={() => setAccountOpen(false)} />}
    {conflictOpen && sync.conflict && <SyncConflictDialog collection={collection} {...sync.conflict} onResolve={choice => { setConflictOpen(false); syncStore.resolve(collection, choice); }} onClose={() => setConflictOpen(false)} />}
    {selected && <ArtistDialog key={selected.id} artist={selected} portrait={portraits[selected.id]} tier={findTier(board, selected.id)} favorites={board.favorites[selected.id] ?? []} onMove={target => setBoard(current => moveArtist(current, selected.id, target))} onToggle={(song: Song) => setBoard(current => toggleSong(current, selected.id, song))} onClose={closeArtist} />}
    {pickerTier && <ArtistPicker tier={pickerTier} artists={pickerVisible} portraits={portraits} placements={placements} count={board.tiers[pickerTier].length}
      query={pickerQuery} onQuery={setPickerQuery} total={pickerArtists.length} onMore={() => setPickerPageSize(size => size + PAGE_SIZE)}
      genre={pickerGenre} onGenre={setPickerGenre} gender={pickerGender} onGender={setPickerGender} kind={pickerKind} onKind={setPickerKind} onReset={resetPickerFilters}
      tagFilters={collection === 'global' ? { artists: combined, countries: pickerCountries, eras: pickerEras, onCountries: setPickerCountries, onEras: setPickerEras } : undefined}
      searching={searching} searchError={searchError} onRetry={() => setSearchRetry(value => value + 1)} onAdd={addPickedArtist} onClose={closeTierPicker} />}
    {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="알림 닫기"><X size={14} /></button></div>}
  </>;
}
