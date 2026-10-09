import { useState } from 'react';
import { Mic2 } from 'lucide-react';
import type { Artist, Portrait } from '../types';
import { imageUrl } from '../api';

export function Avatar({ artist, portrait, className = '' }: { artist: Artist; portrait?: Portrait; className?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  const color = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  const available = portrait && failedUrl !== portrait.url;
  return <div className={`avatar avatar-${color} ${className}`}>
    {available ? <img src={imageUrl(portrait.url)} alt={`${artist.name} 사진`} loading="lazy" draggable={false} onError={() => setFailedUrl(portrait.url)} /> : <><Mic2 size={24} aria-hidden="true" /><span>{artist.name.slice(0, 3)}</span></>}
  </div>;
}
