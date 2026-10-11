import { SITE, SITE_LINKS, contactUrl, type SitePage } from '../src/site';

type Link = { label: string; href: string };
type Section = { title: string; paragraphs: string[]; links?: Link[] };
type Page = { description: string; intro: string; sections: Section[] };
export function siteContent(): Record<SitePage, Page> {
const contact: Link = { label: SITE.contactEmail ? '이메일로 문의하기' : 'GitHub에서 문의하기', href: contactUrl() };
return {
  about: {
    description: '국내·해외 아티스트와 좋아하는 곡으로 만드는 개인 취향 티어표를 소개합니다.',
    intro: '좋아하는 아티스트와 곡을 한곳에 정리하는 개인 취향 기록 도구입니다.',
    sections: [
      { title: '아티스트와 세 곡', paragraphs: ['국내·해외 티어표를 각각 만들고, 아티스트를 S부터 F까지 배치합니다. 한 아티스트마다 좋아하는 곡을 최대 세 개 선택할 수 있습니다. S티어의 아티스트와 곡은 상단의 나의 최애에 모입니다.', '순위는 사용자가 정하는 개인적인 취향입니다. 여러 사람의 평가를 모으거나 아티스트의 객관적인 실력을 산정하지 않습니다.'] },
      { title: '내 브라우저에 보관', paragraphs: ['티어, 제목, 대표곡과 추가한 아티스트는 사용하는 브라우저에 저장됩니다. 회원가입 없이 사용할 수 있으며, 저장 파일을 내려받아 다른 기기에서 불러올 수 있습니다.'] },
      { title: '데이터와 출처', paragraphs: ['아티스트 사진은 신원을 확인한 벅스·멜론 프로필을 중심으로 제공하며, 추가 검색의 일부 사진은 Wikimedia 자료를 사용합니다. 곡 목록은 YouTube Music과 검증한 국내 음원 목록을 사용합니다. 추가 아티스트 검색은 MusicBrainz 자료를 활용합니다.', '외부 사이트의 사진과 곡 메타데이터에 대한 권리는 각 권리자에게 있습니다. 아티스트 상세 창에서 사진 출처를 확인하고, 곡 링크로 원래 음원 서비스에 이동할 수 있습니다. 원곡 오디오를 배포하거나 다운로드하는 서비스가 아닙니다.', '이 사이트는 Google, YouTube Music, 벅스, 멜론, Apple 또는 MusicBrainz의 공식 서비스가 아닙니다. 이름·사진·곡 연결의 오류나 권리 관련 요청은 문의 페이지로 알려주세요.'], links: [contact] },
      { title: '운영', paragraphs: [`운영 계정: ${SITE.operator}. 기능 제안과 오류 제보는 문의 페이지에서 접수합니다.`] },
    ],
  },
  guide: {
    description: '국내·해외 티어표 선택, 모바일 아티스트 추가, 대표곡 선택과 저장 파일 사용 방법입니다.',
    intro: '아티스트를 배치하고, 좋아하는 곡 세 개를 고르면 나의 티어표가 완성됩니다.',
    sections: [
      { title: '티어표 고르기', paragraphs: ['상단의 국내·해외를 눌러 티어표를 전환합니다. 두 티어표의 배치, 제목과 대표곡은 따로 저장됩니다.'] },
      { title: '아티스트 추가하기', paragraphs: ['목록에서 아티스트를 원하는 티어로 드래그하거나 각 티어의 + 버튼을 누릅니다. 모바일에서는 + 버튼으로 검색과 필터를 사용하면서 여러 아티스트를 연속 추가할 수 있습니다.', '이름, 한글 별칭, 장르, 성별, 솔로·그룹 조건으로 찾습니다. 해외 목록의 상세 필터에서는 국가와 데뷔 연대를 여러 개 선택할 수 있습니다. 같은 종류의 태그 중 하나만 맞으면 포함하고, 국가와 연대 조건은 함께 적용합니다. 목록은 더 보기로 50명씩 확장합니다.'] },
      { title: '대표곡 선택하기', paragraphs: ['아티스트 사진을 누르면 티어와 곡을 선택하는 창이 열립니다. 좋아하는 곡을 최대 세 개 고릅니다. 이미 선택한 곡을 다시 누르면 선택을 해제하고 다른 곡을 넣을 수 있습니다.', '곡 제목으로 검색하거나 인기순·최신순·앨범순으로 정렬할 수 있습니다. 특정 앨범을 골라 그 앨범의 곡만 찾을 수도 있습니다. 외부 음원 서비스에서 듣기는 새 탭으로 열립니다.'] },
      { title: '티어 옮기기와 빼기', paragraphs: ['아티스트를 다른 티어로 드래그하거나 아티스트 상세 창의 티어 버튼을 누릅니다. 표 밖으로 드래그하거나 보관함을 선택하면 티어에서 빠집니다. 티어를 옮겨도 고른 대표곡은 유지됩니다.'] },
      { title: '저장과 복원', paragraphs: ['변경 사항은 현재 브라우저에 자동 저장됩니다. 브라우저 데이터를 지우거나 다른 기기를 사용하면 이 저장 내용을 볼 수 없으므로, 내 티어 저장에서 파일로 보관해 주세요.', '국내 파일은 국내 티어표에서, 해외 파일은 해외 티어표에서 불러옵니다. 파일 불러오기는 현재 티어표를 파일 내용으로 교체합니다. 먼저 기존 티어표를 내보내 두면 안전하게 복원할 수 있습니다.', '초기화는 현재 티어표의 배치와 대표곡을 비웁니다. 국내·해외 전체 브라우저 저장을 삭제하려면 브라우저 설정에서 이 사이트의 데이터를 삭제합니다.'] },
    ],
  },
  privacy: {
    description: '브라우저 저장 정보, 외부 서비스 연결, 광고·쿠키 현황과 개인정보 관련 문의 방법을 안내합니다.',
    intro: '이 사이트에서 어떤 정보가 저장되고 외부 서비스에 연결되는지 안내합니다.',
    sections: [
      { title: '브라우저에 저장하는 정보', paragraphs: ['티어표 제목, 아티스트 배치, 대표곡과 직접 추가한 아티스트 정보를 기기의 브라우저 저장소(localStorage)에 저장합니다. 이전에 만든 티어표를 복원하기 위한 기능이며, 이 저장 정보는 운영자에게 전송하지 않습니다.', '저장 내용은 브라우저 데이터를 삭제하거나 해당 티어표를 초기화·교체할 때까지 남습니다. 저장 파일 내보내기는 기기에 JSON 파일을 만들며, 불러오기는 기기에서 파일을 읽습니다. 저장 파일을 사이트 서버에 업로드하지 않습니다.', '사이트에는 회원가입, 로그인, 결제, 이용 통계 수집 또는 광고 추적 기능이 현재 없습니다. 서비스 이용을 위해 이름, 이메일, 전화번호를 입력할 필요가 없습니다.'] },
      { title: '외부 서비스 연결', paragraphs: ['기본 아티스트 사진과 곡 목록은 사이트에서 제공합니다. 기본 목록 밖의 아티스트를 검색하면 검색어가 MusicBrainz로 전달될 수 있습니다. 추가 아티스트의 인물 확인과 사진 검색에는 Wikipedia·Wikidata·Wikimedia가 사용될 수 있습니다. 이전에 저장한 곡 제목을 한국어로 갱신할 때는 해당 곡 ID가 Apple의 음원 API로 전달될 수 있습니다.', '앨범 이미지, 제공되는 미리듣기 또는 외부 링크를 사용하면 Google·YouTube Music, Apple, 벅스, 멜론 등 해당 제공처에 연결될 수 있습니다. 브라우저가 외부 서비스를 요청할 때 IP 주소, 브라우저 정보와 페이지 출처 등이 제공처에 전달될 수 있으며, 각 서비스의 처리 정책이 적용됩니다.', '공개 사이트는 GitHub Pages에서 제공합니다. GitHub는 보안 등을 위해 방문자의 IP 주소와 요청 정보를 처리할 수 있습니다. 운영자는 GitHub Pages 방문 기록을 이 앱의 티어 저장 정보와 연결해 분석하지 않습니다.'], links: [{ label: 'GitHub 개인정보처리방침', href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement' }, { label: 'Google 개인정보처리방침', href: 'https://policies.google.com/privacy?hl=ko' }, { label: 'MusicBrainz 개인정보 안내', href: 'https://metabrainz.org/privacy' }, { label: 'Wikimedia 개인정보처리방침', href: 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy' }, { label: 'Apple 개인정보처리방침', href: 'https://www.apple.com/legal/privacy/kr/' }] },
      { title: '쿠키와 광고', paragraphs: ['앱은 티어 저장을 위해 localStorage를 사용하며 자체 추적 쿠키를 설정하지 않습니다. 현재 Google AdSense 광고 코드와 광고용 쿠키는 사용하지 않습니다.', '광고나 분석 도구를 도입할 때는 제공 사업자, 처리 정보, 쿠키 사용과 선택 방법을 이 페이지에 먼저 반영합니다. 동의가 필요한 지역에서는 필요한 동의 기능을 적용한 후 광고를 제공합니다.'] },
      { title: '열람과 삭제', paragraphs: ['아티스트 상세 창과 티어표에서 저장된 선택을 확인하고 수정할 수 있습니다. 현재 티어표의 초기화 또는 브라우저의 사이트 데이터 삭제로 저장 내용을 지울 수 있습니다. 별도로 내려받은 JSON 파일은 기기에서 직접 삭제해 주세요.', '사이트 운영자가 저장된 티어를 보유하지 않으므로, 다른 기기의 티어를 대신 조회하거나 삭제할 수는 없습니다. 개인정보 관련 문의와 외부 서비스 연결에 대한 질문은 아래 연락 창구로 접수합니다.'], links: [contact] },
      { title: '문의와 운영 연락처', paragraphs: [`운영 계정: ${SITE.operator}. ${SITE.contactEmail ? `문의 이메일: ${SITE.contactEmail}.` : '문의는 GitHub 공개 이슈로 접수합니다. 문의 제목과 내용은 다른 사람이 볼 수 있으므로 이메일 주소, 전화번호, 저장 파일 등 개인정보를 공개 게시하지 마세요.'}`, 'GitHub로 접수한 문의는 GitHub 계정과 게시물 정책에 따라 보관됩니다. 문의 기록의 삭제는 게시물 작성자의 GitHub 기능을 이용하거나 해당 문의에서 요청할 수 있습니다.'], links: [contact] },
      { title: '정책 변경', paragraphs: [`시행일·최종 수정일: ${SITE.policyDate}. 정보 처리 방식이 달라지면 이 페이지의 내용과 수정일을 갱신합니다.`] },
    ],
  },
  terms: {
    description: '티어표 이용, 저장 파일, 외부 자료의 권리와 오류·권리 문의 방법을 안내합니다.',
    intro: '티어표를 사용하는 방법과 외부 자료의 권리에 관한 기본 사항입니다.',
    sections: [
      { title: '서비스 이용', paragraphs: ['이 사이트는 아티스트를 배치하고 좋아하는 곡을 선택하는 개인 취향 기록 도구입니다. 회원가입 없이 제공하며, 현재 이용 요금을 받지 않습니다. 티어표는 사용자의 주관적인 선택입니다.'] },
      { title: '사용자 기록과 저장 파일', paragraphs: ['사용자가 만든 배치와 곡 선택은 현재 브라우저에 저장됩니다. 기기 변경, 브라우저 저장소 삭제 또는 파일 불러오기로 기록이 달라질 수 있으므로 중요한 티어표는 직접 내보내 보관해 주세요.', '사이트에는 티어표를 공개 업로드하는 기능이 없습니다. 내보낸 파일이나 화면을 다른 곳에 공유할 때에는 포함된 정보와 제3자의 권리를 확인해 주세요.'] },
      { title: '외부 자료와 저작권', paragraphs: ['아티스트 이름, 프로필 사진, 앨범 이미지와 곡 정보의 권리는 각 아티스트·기획사·음원 서비스 등 해당 권리자에게 있습니다. 사이트에 자료가 표시된다는 이유로 그 자료를 재배포하거나 상업적으로 사용할 권한이 생기지는 않습니다.', '외부 음원 링크는 해당 제공처의 이용 조건을 따릅니다. 이 사이트는 원곡 음원을 판매하거나 다운로드 기능으로 제공하지 않습니다. 이미지와 정보의 출처는 아티스트 상세 창과 사이트 소개에서 확인할 수 있습니다.'] },
      { title: '오류와 변경', paragraphs: ['외부 카탈로그 변경이나 연결 상태에 따라 특정 아티스트, 사진 또는 곡이 일시적으로 표시되지 않을 수 있습니다. 잘못 연결된 인물·곡·연도 등의 오류를 제보하면 제공처와 고유 ID를 확인해 수정합니다.', '기능과 데이터는 개선 과정에서 바뀔 수 있습니다. 변경 시 기존 기록을 유지하도록 처리하며, 저장 파일로 별도 보관할 수 있습니다.'] },
      { title: '문의와 권리 요청', paragraphs: ['오류 제보, 자료 수정·삭제 요청 또는 권리 관련 문의에는 문제가 있는 페이지나 아티스트·곡 이름, 원본 출처와 요청 사항을 알려주세요. 공개 문의에 민감한 개인정보를 올리지 마세요.'], links: [contact] },
      { title: '시행일', paragraphs: [`시행일·최종 수정일: ${SITE.policyDate}. 운영 계정: ${SITE.operator}.`] },
    ],
  },
  contact: {
    description: '아티스트·곡 정보 오류, 기능 제안과 개인정보·권리 관련 문의를 접수합니다.',
    intro: '오류 제보, 기능 제안과 개인정보·권리 관련 요청을 접수합니다.',
    sections: [
      { title: '연락 창구', paragraphs: [`운영 계정: ${SITE.operator}. ${SITE.contactEmail ? `문의 이메일: ${SITE.contactEmail}.` : 'GitHub 이슈로 문의할 수 있습니다. 작성에는 GitHub 계정이 필요하며, 문의 내용은 공개됩니다.'}`], links: [contact] },
      { title: '오류 제보', paragraphs: ['국내·해외 중 어느 티어표인지, 문제가 있는 아티스트·곡 이름과 발생 상황을 적어주세요. 사진이나 곡이 다른 인물로 연결된 경우 올바른 제공처의 주소를 함께 남겨주시면 확인에 도움이 됩니다.'] },
      { title: '개인정보·권리 문의', paragraphs: ['관련 페이지와 자료의 출처, 수정·삭제를 요청하는 내용을 알려주세요. 공개 이슈에는 이메일, 전화번호, 주소나 개인 티어 저장 파일을 첨부하지 마세요. 권리 확인에 필요한 자료가 있는 경우 먼저 별도 전달 방법을 요청해 주세요.'] },
      { title: '저장된 티어에 대한 문의', paragraphs: ['운영자는 브라우저에 저장된 개인 티어를 보유하지 않습니다. 기기를 바꾸기 전 내 티어 저장에서 파일을 내보내 주세요. 브라우저 데이터가 삭제된 뒤에는 보관한 저장 파일로 복원할 수 있습니다.'] },
    ],
  },
};
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function renderSitePage(id: SitePage, base: string): string {
  const page = siteContent()[id], title = SITE_LINKS.find(item => item.id === id)!.label;
  const infoLinks = SITE_LINKS.map(item => `<a href="${escape(`${base}${item.id}/`)}"${item.id === id ? ' aria-current="page"' : ''}>${escape(item.label)}</a>`).join('');
  const chartLinks = `<a href="${escape(base)}">국내</a><a href="${escape(`${base}?chart=global`)}">해외</a>`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#fafafa"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="description" content="${escape(page.description)}"><title>${escape(title)} · ${escape(SITE.name)}</title><link rel="canonical" href="${escape(`${SITE.url}${id}/`)}"><meta property="og:title" content="${escape(`${title} · ${SITE.name}`)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${escape(`${SITE.url}${id}/`)}"><meta property="og:locale" content="ko_KR"><link rel="icon" href="${escape(`${base}favicon.svg`)}"><link rel="stylesheet" href="${escape(`${base}site.css`)}"></head>
<body><a class="skip-link" href="#content">본문으로 이동</a><header class="info-header"><details class="info-menu"><summary aria-label="사이트 메뉴"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></summary><nav aria-label="사이트 메뉴 링크">${chartLinks}${infoLinks}</nav></details><nav class="chart-nav" aria-label="티어표 선택">${chartLinks}</nav></header>
<main id="content" class="info-content"><h1>${escape(title)}</h1><p class="info-intro">${escape(page.intro)}</p>${page.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}${section.links?.map(link => `<p class="info-link"><a href="${escape(link.href)}"${link.href.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(link.label)} <span aria-hidden="true">↗</span></a></p>`).join('') ?? ''}</section>`).join('')}</main>
<footer class="info-footer"><nav aria-label="사이트 정보">${infoLinks}</nav><p>${escape(SITE.name)} · ${escape(SITE.operator)}</p></footer></body></html>\n`;
}

export const renderSitemap = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[SITE.url, `${SITE.url}?chart=global`, ...SITE_LINKS.map(item => `${SITE.url}${item.id}/`)].map(url => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>\n`;
export const renderRobots = () => `User-agent: *\nAllow: /\nSitemap: ${SITE.url}sitemap.xml\n`;
