import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Music2 } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Artist, Portrait } from '../types';

export function ArtistCard({ artist, portrait, songCount, onOpen, compact = false, overlay = false }: {
  artist: Artist; portrait?: Portrait; songCount: number; onOpen: (artist: Artist) => void; compact?: boolean; overlay?: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: artist.id, disabled: overlay });
  return <div ref={setNodeRef} className={`artist-card ${compact ? 'compact' : ''} ${isDragging ? 'dragging' : ''} ${overlay ? 'overlay-card' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }} data-artist-id={artist.id}>
    <button className="artist-main" onMouseDown={event => listeners?.onMouseDown?.(event)} onTouchStart={event => listeners?.onTouchStart?.(event)} onClick={() => onOpen(artist)} aria-label={`${artist.name} 곡 선택 및 티어 변경`}>
      <Avatar artist={artist} portrait={portrait} />
      <span className="artist-name">{artist.name}</span>
      {!compact && <span className="artist-sub">{artist.englishName}</span>}
      {songCount > 0 && <span className="song-badge" aria-label={`대표곡 ${songCount}개`}><Music2 size={10} />{songCount}</span>}
    </button>
    {!overlay && <button ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} aria-label={`${artist.name} 끌어서 이동`} title="끌어서 배치 · 키보드로는 스페이스 후 방향키"><GripVertical size={15} /></button>}
  </div>;
}
