import { useId, useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { artistEra, countryLabel, countryOptions, ERA_LABELS, ERA_ORDER, type Era } from '../artist-facets';
import type { Artist } from '../types';

export interface DiscoveryTagFilters {
  artists: Artist[];
  countries: string[];
  eras: Era[];
  onCountries: (countries: string[]) => void;
  onEras: (eras: Era[]) => void;
}
const toggle = <T extends string,>(items: T[], item: T): T[] => items.includes(item) ? items.filter(value => value !== item) : [...items, item];

export function DiscoveryTags({ artists, countries, eras, onCountries, onEras }: DiscoveryTagFilters) {
  const [open, setOpen] = useState(false), [allCountries, setAllCountries] = useState(false);
  const id = useId();
  const options = useMemo(() => countryOptions(artists), [artists]);
  const eraOptions = useMemo(() => {
    const available = new Set(artists.map(artistEra));
    return ERA_ORDER.filter(era => available.has(era));
  }, [artists]);
  const active = countries.length + eras.length;
  return <div className="discovery-tags">
    <div className="discovery-summary">
      <button type="button" className="facet-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        더 좁히기 <ChevronDown size={14} className={open ? 'is-open' : ''} />
      </button>
      <div className="selected-facets" aria-label="선택한 태그">
        {countries.map(code => <button type="button" className="selected-facet" key={code} onClick={() => onCountries(toggle(countries, code))} aria-label={`${countryLabel(code)} 국가 필터 해제`}>{countryLabel(code)}<X size={12} /></button>)}
        {eras.map(era => <button type="button" className="selected-facet" key={era} onClick={() => onEras(toggle(eras, era))} aria-label={`${ERA_LABELS[era]} 데뷔 연대 필터 해제`}>{ERA_LABELS[era]}<X size={12} /></button>)}
      </div>
      {active > 0 && <button type="button" className="text-button facet-reset" onClick={() => { onCountries([]); onEras([]); }}>태그 초기화</button>}
    </div>
    <div id={id} className="facet-panel" hidden={!open}>
      <fieldset className="facet-group"><legend>국가</legend><div className="facet-options">
        {(allCountries ? options : options.slice(0, 8)).map(code => <button type="button" className="facet-tag" key={code} aria-pressed={countries.includes(code)} onClick={() => onCountries(toggle(countries, code))}>{countryLabel(code)}</button>)}
        {options.length > 8 && <button type="button" className="text-button facet-more" aria-expanded={allCountries} onClick={() => setAllCountries(value => !value)}>{allCountries ? '주요 국가만' : '다른 국가'}</button>}
      </div></fieldset>
      <fieldset className="facet-group"><legend>데뷔 연대 <span className="facet-hint">데뷔·활동 시작 기준</span></legend><div className="facet-options">
        {eraOptions.map(era => <button type="button" className="facet-tag" key={era} aria-pressed={eras.includes(era)} onClick={() => onEras(toggle(eras, era))}>{ERA_LABELS[era]}</button>)}
      </div></fieldset>
    </div>
  </div>;
}
