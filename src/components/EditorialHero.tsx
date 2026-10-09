import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { CATALOG } from '../data/artists';
import type { Artist } from '../types';

const selections = ['kr-kim-bumsoo', 'kr-park-hyoshin', 'kr-naul', 'kr-isu'];

export function EditorialHero({ onOpen }: { onOpen: (artist: Artist) => void }) {
  return <section className="editorial-hero" aria-labelledby="intro-title">
    <div className="hero-register"><span>PERSONAL SOUND ARCHIVE</span><span>SEOUL, KR · VOL. 02</span></div>
    <div className="editorial-intro">
      <span className="eyebrow">A COLLECTION, BY YOU.</span>
      <h1 id="intro-title">Sound,<br />in your order.</h1>
      <p>좋아하는 목소리.<br />당신만의 순서.</p>
    </div>
    <div className="voice-exhibition" aria-label="한국의 목소리, 김나박이">
      {selections.map((id, index) => {
        const artist = CATALOG.find(item => item.id === id)!;
        return <figure className={`exhibition-piece piece-${index + 1}`} key={id}>
          <button className="exhibition-photo" onClick={() => onOpen(artist)} aria-label={`${artist.name} 프로필 열기`}>
            <img src={`${import.meta.env.BASE_URL}images/editorial/${id}.jpg`} alt={`${artist.name} 공식 프로필 사진`} draggable={false} fetchPriority={index === 1 ? 'high' : 'auto'} />
            <span className="exhibition-open" aria-hidden="true"><ArrowUpRight size={17} /></span>
          </button>
          <figcaption><span>0{index + 1} /</span><span>{artist.name}</span></figcaption>
        </figure>;
      })}
    </div>
    <div className="exhibition-note"><span>FOUR VOICES.<br />ENDLESS RESONANCE.</span><span>김범수 · 나얼 · 박효신 · 이수</span></div>
    <div className="hero-bottom"><p>순서를 정하고, 세 곡을 남기세요.<br /><span>음악 취향을 기록하는 가장 개인적인 방식.</span></p><a href="#my-tier">나의 티어 만들기 <ArrowDown size={15} /></a></div>
  </section>;
}
