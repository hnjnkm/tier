# 나의 아티스트 티어

상단의 국내·해외로 티어표를 바로 전환합니다. 햄버거 메뉴에는 두 티어표와 사이트 소개, 이용 안내, 개인정보처리방침, 이용약관, 문의가 있습니다. 하단에서도 안내 페이지를 열 수 있습니다. 각 페이지는 직접 주소(`/about/`, `/guide/`, `/privacy/`, `/terms/`, `/contact/`)로 접속·새로고침할 수 있는 HTML로 배포되며 GitHub Pages에서는 `/tier/` 아래에 있습니다. 앱의 브라우저 저장, 외부 검색·이미지 연결, 광고·쿠키 현황을 실제 동작 기준으로 안내합니다. 운영 연락처와 사이트 주소는 `src/site.ts`에서 관리하고, 안내 내용은 `scripts/site-pages.ts`에서 수정합니다. 빌드 시 canonical·공유 메타데이터와 `sitemap.xml`, `robots.txt`를 생성합니다. Google AdSense를 연결할 때 필요한 도메인·게시자 ID·루트 ads.txt·정책 및 동의 설정은 [광고 연결 준비 문서](docs/ADVERTISING.md)에 정리했습니다.

국내·해외 아티스트를 S~F 티어에 배치하고, 가수마다 내가 좋아하는 곡을 최대 3개 고르는 웹앱입니다. 햄버거 메뉴에서 국내 아티스트(931명)와 해외 아티스트(1,124명) 티어표를 선택합니다. 해외 목록은 원래 활동명을 표시하며 한글 별칭으로도 검색할 수 있습니다. 두 티어표는 배치·대표곡·제목·추가 검색 아티스트를 각각 저장합니다. 기존 국내 저장 데이터와 JSON 파일도 그대로 사용할 수 있습니다.

해외 티어표의 직접 주소는 `https://hnjnkm.github.io/tier/?chart=global`입니다. 메뉴 전환은 브라우저 뒤로·앞으로 가기를 지원합니다. 저장 파일은 국내 `my-tier.json`, 해외 `my-tier-global.json`으로 구분하며, 다른 티어표의 파일은 해당 메뉴를 선택한 뒤 불러오도록 안내합니다. 해외 아티스트도 동일한 검색·장르·성별·솔로/그룹 필터, 50명씩 확장, 모바일 추가 버튼과 대표곡 3개 선택을 제공합니다. 해외 목록은 팝·힙합·록·R&B·재즈·포크와 여러 세대의 솔로·그룹을 포함합니다. 프로필은 고유 아티스트 ID와 두 곡 이상의 독립적인 음반 크레딧으로 신원을 확인한 벅스 사진을 정사각 WebP로 함께 배포하고, 곡 목록은 신원을 별도로 검증한 YouTube Music 채널의 전체 앨범·싱글과 곡을 사용합니다. 같은 벅스 ID나 YouTube Music 채널을 가진 아티스트를 중복 등록하지 않습니다.

해외 검색과 각 티어의 추가 창에서 ‘상세 필터’를 펼치면 국가·데뷔 연대 태그를 선택할 수 있습니다. 같은 종류의 태그는 여러 개 중 하나만 맞아도 포함하며, 국가와 연대 사이에는 두 조건을 모두 적용합니다. 예를 들어 미국·영국과 1990년대를 선택하면 두 나라의 1990년대 데뷔 아티스트를 찾습니다. 검색·장르·성별·솔로/그룹과 함께 사용할 수 있으며 선택한 태그는 접어도 남습니다. 기본 화면은 접혀 있고, 다른 국가들도 필요할 때 펼칩니다. 필터를 바꾸면 다시 50명부터 표시하며, 태그 초기화는 기존 장르·성별 조건을 유지합니다. 검색 조건은 저장된 티어·대표곡에 영향을 주지 않습니다.

국가는 솔로의 국적 또는 그룹의 출신 국가 기준으로, 복수 국적은 여러 국가에 포함합니다. 연대는 벅스 프로필에 명시된 데뷔 연도를 우선하며, 없으면 확인된 활동 시작·그룹 결성 연도를 사용합니다. 생년이나 재발매 음반의 연도를 데뷔로 추정하지 않습니다. Olivia Rodrigo·Ado처럼 연기·커버 활동과 음원 데뷔가 다른 경우는 확인한 음원 데뷔 연도를 사용합니다. 확인되지 않은 연대는 ‘미확인’으로 찾을 수 있으며, 태그를 선택하지 않으면 모두 포함합니다. 고유 벅스 프로필과 연결된 Wikipedia·Wikidata를 교차 확인한 출처는 `src/data/global-facets.json`, 보완한 전기와 음악 데뷔 기준은 `src/data/artist-facet-pins.json`에 보관합니다. 갱신은 `scripts/ytmusic-requirements.txt`로 준비한 Python 환경에서 `python scripts/refresh-artist-facets.py`로 수행합니다. 이 작업에는 `music.bugs.co.kr`, `en.wikipedia.org`, `ko.wikipedia.org`, `www.wikidata.org` 접근이 필요하며 TLS 검증을 유지합니다.

작은 정사각 썸네일, 장르·성별·솔로/그룹 필터, 가수별 대표곡 3개 선택과 저장을 제공합니다. S티어에 가수를 넣으면 상단에 최애 가수와 선택한 곡의 브리핑이 나타납니다. 비어 있으면 안내와 아티스트 추가 버튼이 표시되며, 목록에서 선택한 가수를 S티어에 바로 추가하고 곡 선택 창을 엽니다. 각 티어의 + 버튼을 누르면 검색 가능한 아티스트 선택 창이 열립니다. 누르는 즉시 해당 티어에 추가하며 여러 명을 연속 선택할 수 있습니다. 다른 티어의 가수도 이동할 수 있고 기존 대표곡은 유지합니다. 창의 검색은 하단 목록 필터와 독립적이며 50명씩 더 볼 수 있습니다. 표 밖으로 드래그하면 목록으로 돌아가며 선택한 곡은 유지됩니다. 최애 곡 제목은 한 줄 말줄임으로 표시하며 전체 제목은 마우스를 올리거나 상세 창에서 확인할 수 있습니다. 글자는 Pretendard 400 한 굵기, 11·13·16px 세 가지 크기로 통일하며 로고는 표시하지 않습니다. 검증된 아티스트 프로필 사진은 구도를 유지한 정사각 썸네일로 제공합니다. 글꼴은 앱에서 직접 제공합니다. 키보드, 동작 감소 설정과 기존 브라우저 저장 데이터·JSON 파일을 지원합니다.

이전 안정 버전은 [v1.0-collection](https://github.com/hnjnkm/tier/tree/v1.0-collection) 태그와 `archive/v1-collection` 브랜치에 보관합니다. 디자인을 바꾸기 전의 931개 가수·그룹 목록, 공식 사진, 장르 필터가 포함되어 있습니다.

## GitHub에서 웹으로 열기

나의 최애의 **스토리로 공유**에서 S티어 아티스트와 선택한 곡을 1080 × 1920 PNG로 내보냅니다. 네 명씩 나눈 각 이미지를 PC·모바일에서 저장할 수 있습니다. 파일 공유를 지원하는 브라우저에서는 미리 준비한 PNG를 사용자 탭 안에서 Web Share API로 전달합니다. Instagram 표시 여부는 휴대폰·앱의 공유 지원에 따라 달라지며, 지원하지 않을 때는 저장한 이미지를 스토리에 올립니다. 휴대폰에서는 미리보기를 길게 눌러 사진 저장도 할 수 있습니다. 공유 대상 앱을 강제로 지정하거나 Instagram에 자동 게시하지 않습니다. 이미지는 브라우저에서 만들고 업로드하지 않습니다. 검증된 로컬 프로필을 우선 사용하며, 외부 사진은 CORS가 허용되는 경우에만 넣어 PNG 저장이 차단되지 않도록 합니다. 사진 실패는 미리보기의 안내와 다시 시도로 확인할 수 있습니다.

GitHub 저장소 화면은 코드와 파일을 보여줍니다. 앱을 웹으로 실행하려면 GitHub Pages를 사용합니다. 서버와 API 키 없이 사용하는 Pages 빌드를 제공합니다. 아티스트 사진과 YouTube Music 곡 목록은 사이트에 함께 배포하며, 추가 가수 검색은 MusicBrainz를 사용합니다. 사진, 가수·곡 검색, 티어 이동, 대표곡 3개 선택과 저장을 지원합니다.

1. 이 프로젝트를 `hnjnkm/tier` 저장소의 `main` 브랜치에 업로드합니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. **Actions → Deploy my tier to GitHub Pages → Run workflow**를 실행합니다. 이후 `main`에 변경을 올리면 자동 배포됩니다.
4. 배포가 성공하면 `https://hnjnkm.github.io/tier/`를 엽니다. 이 주소는 배포 완료 후 사용할 수 있습니다.

배포 워크플로는 공개 주소의 HTML과 앱 파일이 실제로 정상 응답하는지까지 확인합니다.

별도 설치 없이 휴대폰이나 PC에서 이용할 수 있습니다. 선택한 내용은 각 브라우저에 저장되며 다른 기기로 옮길 때는 저장 파일을 사용합니다. 외부 API에 없는 사진·곡은 표시되지 않을 수 있습니다.

Pages 빌드를 로컬에서 확인하려면:

```sh
npm run build:pages
node scripts/serve-pages.mjs
```

빌드 결과는 `dist-pages/`에 저장됩니다. 서버는 정적 파일만 제공합니다. 테스트 경로는 `http://127.0.0.1:5180/tier/`이며 `index.html`을 파일로 직접 열면 모듈·API 보안 정책에 의해 동작하지 않을 수 있습니다. GitHub Actions는 저장소 이름에 맞춰 앱의 기본 경로를 자동 설정합니다.

## 실행 패키지

ZIP을 압축 해제한 뒤 Windows는 `START-Windows.bat`, macOS는 `START-macOS.command`, Linux는 `START-Linux.sh`를 실행합니다. 첫 실행에 필요한 Node.js와 의존성을 자동으로 준비하고 브라우저를 엽니다. 인터넷 연결이 필요합니다. 실행 창을 열어 두고 사용하며 Ctrl+C로 종료합니다. 다운로드한 Node.js는 공식 SHA-256 체크섬으로 검증합니다.

패키지 생성은 `npm run build` 후 `python3 scripts/package.py`로 실행합니다. 생성된 `release/my-tier.zip`에는 실행 파일과 빌드 결과를 포함하며, 머신별 캐시·비밀 파일은 포함하지 않습니다.

## 시작하기

Node.js 22.12 이상이 필요합니다. 이 클라우드 환경에서는 제공된 Node.js 24를 사용합니다.

```sh
cd /workspace/tier
npm ci --cache /tmp/tier-npm-cache
npm run dev
```

개발 서버는 포트 5173에서 실행됩니다. 프론트엔드와 API가 같은 서버를 사용하고, 코드 변경 시 자동 갱신됩니다. 다른 포트는 `PORT=3000 npm run dev`처럼 지정합니다. 기존 체크아웃을 사용하며 새 Git worktree는 필요하지 않습니다.

프로덕션 실행:

```sh
npm run build
npm start
```

## 기능

- S, A, B, C, D, E, F 티어와 보관함 사이의 드래그 이동, 티어 안에서 순서 변경
- 마우스로 사진을 끌어서 이동, 모바일에서는 길게 누른 뒤 이동
- 키보드: 이동 핸들에서 Space → 방향키 → Space. 가수 버튼의 Enter로 상세 창을 열어 직접 티어를 선택할 수도 있습니다.
- 국내 가수·그룹 931명과 해외 가수·그룹 1,124명의 독립적인 기본 목록, 한글·영문·별칭 검색, 남자/여자/혼성 및 솔로/그룹 필터
- 발라드·힙합·록·R&B·인디·댄스·트로트·포크·재즈·크로스오버·국악 장르 필터: 보관함 검색에만 적용하며 티어 배치를 바꾸지 않습니다. 여러 장르로 활동하는 가수는 여러 필터에 표시됩니다.
- 아이돌은 그룹 중심으로 표시합니다. 멤버 이름으로도 그룹을 찾을 수 있고 NCT 유닛은 NCT로 통합합니다. 이전에 저장한 솔로·유닛의 티어와 곡 선택은 유지됩니다.
- MusicBrainz에서 기본 목록 밖의 국내 가수 검색 및 추가
- 가수 사진을 눌러 곡 검색, 인기순·최신순·앨범순 정렬, 최신 연도순 앨범 선택(연도 미확인 앨범은 마지막), 대표곡 3개 선택/제거, YouTube Music에서 듣기
- 티어와 대표곡을 브라우저에 자동 저장, JSON 파일 내보내기/불러오기
- 보드 이름 변경, 초기화, 모바일 화면 지원

계정이나 데이터베이스는 필요하지 않습니다. 자동 저장은 해당 브라우저에 한정됩니다. 다른 기기로 옮길 때는 저장 파일을 사용하세요.

## 데이터 출처와 제한

- 기본 가수 목록의 성별·그룹 구성·주요 장르는 `src/data/artists.ts`, `extra-artists.ts`, `catalog-config.ts`에서 관리합니다. 확인된 가수 이름은 `provider-names.json`에 저장된 국내 음원 사이트 공식 표기로 표시하며, 기존 한글 표기도 검색 별칭으로 유지합니다. 추가 검색은 MusicBrainz의 원래 표기를 유지합니다. 인기도 순위나 국내 가수 전체 목록은 아닙니다.
- 아티스트 목록은 처음 50개를 표시하고 더 보기를 누를 때마다 50개씩 확장됩니다. 목록과 티어표의 썸네일은 PC에서 52px, 모바일에서 50px 정사각형으로 동일합니다.
- 사진: 벅스의 실제 아티스트 프로필 사진을 사용하고, 벅스에 올바른 인물 프로필이 없는 경우 별도로 검증된 멜론 프로필을 사용합니다. 이름 검색 순위로 동명이인을 선택하지 않고 검증된 아티스트 고유 ID에 연결합니다. YouTube 영상 캡처와 가로 배너는 인물 사진으로 사용하지 않습니다. 원본 구도를 보존한 256×256 WebP를 `public/portraits`에 배포하며, 정사각형이 아닌 원본은 여백을 더해 얼굴이나 그룹 구성원을 자르지 않습니다. 개별 확인한 크롭만 명시적으로 적용합니다. 상세 창에는 실제 사진 출처를 표시합니다. `npm run refresh:portraits`는 벅스 프로필을 갱신하며 `-- --all`로 기존 프로필도 확인합니다. 새 사진은 다운로드·디코딩 검증이 성공한 후 반영하며 실패하면 기존 사진과 출처를 함께 보존합니다. `npm run cache:portraits -- --rebuild`는 현재 원본을 다시 내려받아 썸네일을 생성합니다.
- 추가 가수: MusicBrainz에서 국내는 `country:KR`, 해외는 `NOT country:KR` 조건으로 분리해 검색합니다. 별칭을 함께 검색합니다. 그룹 성별은 기본 목록에서 멤버 구성 기준이며, 외부 데이터에 없는 성별은 추측하지 않고 `정보 없음`으로 표시합니다. 해외 활동·국적 가수 등은 이 검색 조건에서 빠질 수 있습니다.
- 곡: YouTube Music 한국 지역·한국어 메타데이터를 사용합니다. `scripts/refresh-music.py`는 계정 없이 공개 메타데이터를 읽는 ytmusicapi를 사용합니다. 이 라이브러리는 공식 YouTube API가 아니므로 제공처가 형식을 변경하면 갱신 로직을 수정해야 합니다. 이름 검색 결과를 바로 선택하지 않고 기존 검증 음반의 곡 제목 2개 이상과 맞는 고유 채널을 찾은 뒤 ID를 저장합니다. 음원이 1개인 가수는 곡과 앨범 제목이 모두 일치하는 고유 채널만 연결합니다. 전곡 플레이리스트와 앨범·싱글의 연속 페이지를 끝까지 읽어 `public/music/<artist-id>.json`으로 배포하며, 브라우저는 같은 사이트의 파일을 읽어 CORS에 의존하지 않습니다. 이전의 200곡 검색 제한은 적용하지 않습니다. 참여곡·OST도 채널 크레딧이 일치하면 포함합니다. 원래 영문인 곡명은 그대로 표시합니다.
- 국내 보완 목록: YouTube Music에 등록되지 않았거나 검증 음반과 일치하는 인물을 확정하지 못한 가수는 `scripts/refresh-supplements.ts`로 검증된 벅스 아티스트 ID의 전곡 페이지와 앨범 수록곡을 읽습니다. 한국 음원 분류 또는 한국 국적·등록 이름·기존 검증 음반과의 일치를 확인하며, 임의의 검색 결과로 ID를 대체하지 않습니다. 해당 화면에는 실제 출처인 “벅스 · 한국”과 보완 이유를 표시합니다. `music-supplements.json`에 확인된 ID가 있는 목록만 사용할 수 있습니다. 벅스 페이지에 접근할 수 없는 경우에는 별도로 검증한 `melon-artists.json`의 멜론 고유 ID와 `scripts/refresh-melon.ts`를 사용합니다. 멜론은 전체 곡을 발매순 연속 페이지로 수집한 후, 별도의 인기곡 순위를 연결합니다. 인기곡 페이지가 전체 곡보다 작더라도 전체 수집을 중단하지 않습니다. 해당 화면에는 “멜론 · 한국”을 표시합니다. 정상 YouTube Music 목록은 보완 목록으로 덮어쓰지 않으며, 이후 YouTube Music에서 인물이 확인되면 우선 제공처로 전환합니다.
- 그룹 음반: 검색 목록에서 하나로 표시하는 NCT에는 검증된 NCT U·127·DREAM·WayV·WISH의 음반을 함께 연결합니다. 유닛을 검색해도 부모 그룹에서 곡을 선택할 수 있으며, 원래 수록곡의 가수 크레딧은 유지합니다. 같은 음원의 중복 ID를 제거하고 공유 앨범의 수록곡은 합칩니다. 합친 목록의 인기순은 유닛별 제공처 순위를 번갈아 표시하는 방식으로 화면에 명시합니다.
- 곡 정렬: 인기순은 YouTube Music 아티스트 곡 목록의 순서입니다. 최신순은 발매일·발매연도를 우선하며, 날짜를 제공하지 않는 곡은 연도 기준이라고 표시합니다. 앨범순은 최신 발매연도의 앨범부터 표시하며 같은 앨범 안에서는 트랙 번호 순서입니다. 앨범 필터에는 수록곡 전체가 포함됩니다. 제목 검색·정렬·앨범 선택은 전체 목록 안에서 즉시 적용되며 검색할 때마다 제공처에 다시 요청하지 않습니다. 새 음원은 자동 갱신 워크플로에서 수집합니다. 갱신에 실패하면 이전 정상 목록을 보존합니다.
- 기존 대표곡: 저장된 iTunes 곡 ID와 선택 순서는 유지합니다. 한국 지역 조회로 영문 표기를 보정하고, 제목과 앨범이 일치하는 YouTube Music 곡은 같은 선택으로 표시하여 해제할 수 있습니다. 정확히 일치하지 않는 이전 선택을 임의의 다른 곡으로 바꾸거나 삭제하지 않습니다. YouTube Music의 음원 권리·지역·카탈로그 등록 범위 밖의 곡까지 존재한다고 보장하지 않습니다.
- 공급자 응답은 서버 실행 시 서버에, Pages 실행 시 열린 페이지의 메모리에 캐시합니다. MusicBrainz 요청은 각각 초당 1회 이하로 제한합니다. 서버 실행은 앨범 이미지·기존 미리듣기에 정해진 제공처만 허용하는 중계를 사용하고, Pages는 HTTPS 제공처 주소를 직접 사용합니다. 기본 아티스트 사진은 로컬 배포 파일을 사용합니다. 인증 정보는 필요하지 않습니다.

클라우드에서 다음 HTTPS 도메인을 허용해야 합니다:

```text
itunes.apple.com
music.bugs.co.kr
image.bugsm.co.kr
www.melon.com
cdnimg.melon.co.kr
en.wikipedia.org
ko.wikipedia.org
www.wikidata.org
upload.wikimedia.org
thumb.wikimedia.org
musicbrainz.org
music.youtube.com
youtubei.googleapis.com
www.youtube.com
i.ytimg.com
yt3.googleusercontent.com
lh3.googleusercontent.com
is1-ssl.mzstatic.com
is2-ssl.mzstatic.com
is3-ssl.mzstatic.com
is4-ssl.mzstatic.com
is5-ssl.mzstatic.com
audio-ssl.itunes.apple.com
cdn.jsdelivr.net
```

`cdn.jsdelivr.net`은 Pretendard 글꼴을 처음 준비할 때 사용하며, 포함된 글꼴 파일은 앱에서 직접 제공합니다. 사용하는 Pretendard의 SIL Open Font License는 `public/fonts/OFL.txt`에 있습니다. 서버는 기존 `HTTPS_PROXY`와 CA 인증서를 사용하며 TLS 검증을 유지합니다.

## YouTube Music 목록 갱신

목록은 Google의 공식 `youtubei.googleapis.com` 서버에서 한국어·한국 지역의 YouTube Music 메타데이터를 가져와 생성합니다. 웹페이지를 가져오거나 로그인 쿠키를 요구하지 않습니다. UI 테스트의 예시 곡 데이터를 배포 목록으로 사용하지 않습니다.

```sh
python3 -m venv /tmp/tier-music-venv
/tmp/tier-music-venv/bin/python -m pip install -r scripts/ytmusic-requirements.txt
node --import tsx scripts/export-music-artists.ts
/tmp/tier-music-venv/bin/python scripts/refresh-music.py --artists /tmp/tier-music-artists.json
npm run check:media
```

특정 가수만 확인하려면 `--ids kr-gil,kr-iu,kr-roy-kim`을 추가합니다. 채널을 자동 검증할 음반 정보가 부족한 가수는 공식 채널을 확인한 후 `src/data/youtube-channels.json`에 등록합니다. 연결 오류를 동명이인 데이터로 대체하지 않습니다. 자동 갱신은 `.github/workflows/refresh-music.yml`에서 가장 오래 갱신되지 않은 가수를 100명씩 처리하며, 갱신 시각은 파일 수정 시간이 아닌 저장된 메타데이터를 사용합니다.

`npm run check:media`는 기본 목록 전체의 실제 이미지 디코딩·정사각형 규격과 곡·아티스트 ID·앨범 연결을 검사합니다. YouTube Music과 국내 보완 목록의 개수도 따로 보고합니다. 누락된 데이터가 있으면 배포 준비 실패로 종료하고 `/tmp/tier-media-readiness.json`에 대상 목록을 저장합니다.

## 검증

```sh
npm test
npm run build
npm run test:e2e
npm run build:pages
npm run test:pages
```

수집기 테스트는 위 가상환경의 Python으로 `python -m unittest discover -s tests -p '*_test.py'`를 실행합니다.

브라우저 테스트는 제공된 `/usr/bin/chromium`을 사용합니다. 다른 환경에서는 `CHROMIUM_PATH`를 지정하거나 Playwright 설정을 조정하세요. 테스트용 API 응답을 사용하는 UI 테스트와 제공처 형태의 응답을 사용하는 서버 테스트는 공개 API 가용성을 검증하는 테스트와 구분됩니다. Pages 테스트는 정적 파일 서버에서 `/tier/` 경로와 외부 API 호출, 사진 표시, 곡 검색·선택·저장을 검증하며 제공처 응답은 테스트용입니다. 실제 API는 서버 실행 후 `/api/portraits?ids=kr-iu`와 `/api/artists/kr-iu/songs?q=밤편지` 등으로 확인할 수 있습니다.

해외 목록 확장 도구인 `scripts/discover-global-artists.py`는 벅스의 해외 장르 차트와 원래 활동명을 사용해 후보를 모으고, 정규 프로필의 국적·해외 장르 분류·성별·유형·공식 사진·독립적인 곡 크레딧을 확인합니다. `scripts/seed-global-reference-songs.py`는 정확한 활동명이 같은 벅스 고유 ID가 하나인 경우에만 Apple Music 미국 공개 검색의 단일 아티스트 ID에서 보조 신원 검증용 곡 크레딧을 가져옵니다. 해외 티어표에 제공하는 곡·앨범 데이터는 전부 검증된 YouTube Music 한국 목록입니다. 확장용 캐시는 재시작에 견디도록 `.runtime/global-expansion`에 저장하며, `TIER_GLOBAL_CACHE`로 위치를 지정할 수 있습니다. 후보는 완성된 곡 목록과 정상 프로필 이미지 검증이 끝나기 전까지 서비스 목록에 포함하지 않습니다.
