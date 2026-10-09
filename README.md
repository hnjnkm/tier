# my tier.

국내 가수를 S~F 티어에 배치하고, 가수마다 내가 좋아하는 곡을 최대 3개 고르는 웹앱입니다.

## GitHub에서 웹으로 열기

GitHub 저장소 화면은 코드와 파일을 보여줍니다. 앱을 웹으로 실행하려면 GitHub Pages를 사용합니다. 서버와 API 키 없이 브라우저에서 Wikipedia, MusicBrainz, iTunes의 공개 API를 직접 호출하는 Pages 빌드를 제공합니다. 사진, 가수·곡 검색, 티어 이동, 대표곡 3개 선택과 저장을 지원합니다.

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
- 국내 가수 156명의 기본 목록, 한글·영문·별칭 검색, 남자/여자/혼성 및 솔로/그룹 필터
- MusicBrainz에서 기본 목록 밖의 국내 가수 검색 및 추가
- 가수 사진을 눌러 곡 검색, 대표곡 3개 선택/제거, 제공되는 곡의 미리듣기
- 티어와 대표곡을 브라우저에 자동 저장, JSON 파일 내보내기/불러오기
- 보드 이름 변경, 초기화, 모바일 화면 지원

계정이나 데이터베이스는 필요하지 않습니다. 자동 저장은 해당 브라우저에 한정됩니다. 다른 기기로 옮길 때는 저장 파일을 사용하세요.

## 데이터 출처와 제한

- 기본 가수 목록의 이름·성별·그룹 구성은 `src/data/artists.ts`의 수동 관리 목록입니다. 인기도 순위나 국내 가수 전체 목록은 아닙니다.
- 사진: Wikipedia pageimages / Wikimedia. 기본 목록은 명시한 문서 제목을 사용합니다. 추가 검색 가수는 MusicBrainz의 Wikipedia/Wikidata 연결을 우선 사용하며, 연결이 없으면 이름이 일치하고 한국 가수·밴드라는 설명이 있는 위키 문서만 사용합니다. 모호한 동명이인 사진이나 앨범 표지를 가수 얼굴로 대체하지 않습니다. 공개 사진이 없으면 이름이 있는 기본 이미지가 표시됩니다. 가수 상세 창의 출처 링크에서 원본 문서와 사진 라이선스를 확인할 수 있습니다.
- 추가 가수: MusicBrainz의 `country:KR` 검색. 별칭을 함께 검색합니다. 그룹 성별은 기본 목록에서 멤버 구성 기준이며, 외부 데이터에 없는 성별은 추측하지 않고 `정보 없음`으로 표시합니다. 해외 활동·국적 가수 등은 이 검색 조건에서 빠질 수 있습니다.
- 곡: 인증 키 없이 이용 가능한 iTunes Search API. 한국 지역은 음악 판매 카탈로그를 제공하지 않으므로 국내 가수 음원이 조회되는 US 지역을 사용합니다. 한국어 곡 검색도 가능하지만 결과 제목은 영문일 수 있습니다. 정확한 아티스트 ID에 속한 곡만 반환하고, 동명이인을 구분할 수 없으면 곡을 잘못 연결하는 대신 안내합니다. 음원 권리·지역·제공처에 따라 일부 곡과 미리듣기가 없을 수 있습니다.
- 공급자 응답은 서버 실행 시 서버에, Pages 실행 시 열린 페이지의 메모리에 캐시합니다. MusicBrainz 요청은 각각 초당 1회 이하로 제한합니다. 서버 실행은 사진·미리듣기에 정해진 제공처만 허용하는 중계를 사용하고, Pages는 HTTPS 제공처 주소를 직접 사용합니다. 인증 정보는 필요하지 않습니다.

클라우드에서 다음 HTTPS 도메인을 허용해야 합니다:

```text
itunes.apple.com
en.wikipedia.org
ko.wikipedia.org
www.wikidata.org
upload.wikimedia.org
thumb.wikimedia.org
musicbrainz.org
is1-ssl.mzstatic.com
is2-ssl.mzstatic.com
is3-ssl.mzstatic.com
is4-ssl.mzstatic.com
is5-ssl.mzstatic.com
audio-ssl.itunes.apple.com
cdn.jsdelivr.net
```

`cdn.jsdelivr.net`은 Pretendard 글꼴을 처음 준비할 때 사용하며, 포함된 글꼴 파일은 앱에서 직접 제공합니다. 폰트의 SIL Open Font License는 `public/fonts/OFL.txt`에 있습니다. 서버는 기존 `HTTPS_PROXY`와 CA 인증서를 사용하며 TLS 검증을 유지합니다.

## 검증

```sh
npm test
npm run build
npm run test:e2e
npm run build:pages
npm run test:pages
```

브라우저 테스트는 제공된 `/usr/bin/chromium`을 사용합니다. 다른 환경에서는 `CHROMIUM_PATH`를 지정하거나 Playwright 설정을 조정하세요. 테스트용 API 응답을 사용하는 UI 테스트와 제공처 형태의 응답을 사용하는 서버 테스트는 공개 API 가용성을 검증하는 테스트와 구분됩니다. Pages 테스트는 정적 파일 서버에서 `/tier/` 경로와 외부 API 호출, 사진 표시, 곡 검색·선택·저장을 검증하며 제공처 응답은 테스트용입니다. 실제 API는 서버 실행 후 `/api/portraits?ids=kr-iu`와 `/api/artists/kr-iu/songs?q=밤편지` 등으로 확인할 수 있습니다.
