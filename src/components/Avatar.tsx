import { useState } from 'react';
import { Mic2 } from 'lucide-react';
import type { Artist, Portrait } from '../types';
import { imageUrl } from '../api';

export function Avatar({ artist, portrait, className = '' }: { artist: Artist; portrait?: Portrait; className?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  const color = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  const source = portrait?.localPath ? `${import.meta.env.BASE_URL}${portrait.localPath}` : portrait ? imageUrl(portrait.url) : undefined;
  const available = source && failedUrl !== source;
  return <div className={`avatar avatar-${color} ${artist.kind === 'group' ? 'avatar-group' : ''} ${className}`}>
    {available ? <img src={source} alt={`${artist.name} 사진`} loading="lazy" draggable={false} onError={() => setFailedUrl(source)} /> : <><Mic2 size={24} aria-hidden="true" /><span>{artist.name.slice(0, 3)}</span></>}
  </div>;
}
