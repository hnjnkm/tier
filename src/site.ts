export const SITE = {
  name: '나의 아티스트 티어',
  url: 'https://hnjnkm.github.io/tier/',
  operator: 'hnjnkm',
  contactEmail: null as string | null,
  issuesUrl: 'https://github.com/hnjnkm/tier/issues/new',
  policyDate: '2026-10-13',
};
export const SITE_LINKS = [
  { id: 'about', label: '사이트 소개' },
  { id: 'guide', label: '이용 안내' },
  { id: 'privacy', label: '개인정보처리방침' },
  { id: 'terms', label: '이용약관' },
  { id: 'contact', label: '문의' },
] as const;
export type SitePage = typeof SITE_LINKS[number]['id'];
export const sitePageUrl = (id: SitePage, base = import.meta.env?.BASE_URL ?? '/') => `${base}${id}/`;
export const contactUrl = () => SITE.contactEmail ? `mailto:${SITE.contactEmail}` : SITE.issuesUrl;
