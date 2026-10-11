# Google AdSense 연결 준비

현재 공개 사이트에는 광고·분석 스크립트가 없습니다. 사이트 메뉴와 하단에서 소개, 이용 안내, 개인정보처리방침, 이용약관, 문의 페이지를 직접 열 수 있습니다. 각 페이지는 JavaScript 없이도 읽을 수 있는 HTML로 배포합니다. 이 구성은 사이트 공개에 필요한 기본 정보를 제공하며, AdSense 승인이나 사진·음원 자료의 상업적 이용 허락을 의미하지 않습니다.

## 사이트 주소와 운영 연락처

`src/site.ts`의 `SITE`가 운영 계정, 문의 이메일, 공개 주소와 정책 수정일의 기준입니다. 이메일을 지정하면 문의 페이지와 정책의 연락 창구가 이메일로 바뀝니다. 현재 문의 창구는 실제로 사용 가능한 저장소의 GitHub 공개 이슈입니다.

공개 사이트는 `https://hnjnkm.github.io/tier/`에 있습니다. AdSense에서 등록할 사이트와 소유권 확인 방식을 먼저 정합니다. 자체 도메인이나 루트 사이트로 옮기면 `SITE.url`을 새 HTTPS 주소로 변경하고 끝의 `/`를 유지합니다. Pages 빌드의 경로, 정책 링크, canonical, sitemap과 robots는 이 주소를 기준으로 함께 생성됩니다. DNS·GitHub Pages 도메인 설정은 별도로 적용해야 합니다.

프로젝트 경로의 `/tier/robots.txt`는 호스트 루트의 `/robots.txt`가 아닙니다. Search Console에 URL 접두어 속성으로 사이트를 등록할 때 `/tier/sitemap.xml`을 제출할 수 있습니다. 루트 도메인의 robots를 제어하려면 루트 사이트나 자체 도메인을 사용합니다.

## 계정 연결과 ads.txt

AdSense 계정의 사이트 등록 화면에서 실제 게시자 ID와 Google이 제공한 소유권 확인 방법을 사용합니다. 게시자 ID가 확인되기 전에는 가짜 `pub-...` 값이나 광고 SDK를 배포하지 않습니다.

`ads.txt`를 사용할 때는 Google에서 제공하는 정확한 게시자 항목을 호스트 루트에 게시합니다. 프로젝트 폴더의 `/tier/ads.txt`를 만드는 것만으로 `https://hnjnkm.github.io/ads.txt`가 생성되지는 않습니다. 현재 프로젝트 사이트 외에 루트 저장소를 수정하거나 자체 도메인을 연결하는 작업은 포함하지 않았습니다. 운영자가 제어할 수 있는 루트 사이트에서 파일을 제공하고 실제 URL과 AdSense 상태를 확인합니다.

## 광고를 켜기 전 변경

`scripts/site-pages.ts`의 개인정보처리방침에서 현재 광고 현황을 실제 도입 내용으로 바꿉니다. Google·제3자 공급업체의 쿠키 사용, 방문 기록 기반 광고, 개인 맞춤 광고 설정과 거부 방법을 명시합니다. Google이 요구하는 지역의 사용자에게는 인증된 CMP를 통한 필요한 동의 기능을 광고 코드보다 먼저 적용합니다. 단순히 배너를 띄우거나 localStorage에 동의를 저장하는 것만으로 인증된 CMP를 대체하지 않습니다.

프로필 사진과 앨범 자료의 출처 표기는 상업적 이용 권한을 증명하지 않습니다. 광고를 포함하는 운영에 사용할 수 있는 권리·제공 조건을 확인하고, 필요한 경우 허락된 자료로 교체합니다. 자료 수정·삭제 요청은 공개 문의 창구에서 접수할 수 있습니다.

승인 및 동의 구성이 준비되면 실제 게시자 ID와 광고 단위 ID를 연결합니다. 티어의 추가 버튼, 아티스트 카드, 곡 선택 버튼과 광고가 혼동되지 않도록 별도의 위치와 광고 표시를 사용하고, 모바일에서 조작 영역을 가리지 않는지 확인합니다. 현재 화면에 빈 광고 카드나 추적 스크립트는 추가하지 않았습니다.

Google 안내:

- [사이트 등록과 소유권 확인](https://support.google.com/adsense/answer/12169212?hl=ko)
- [ads.txt 안내](https://support.google.com/adsense/answer/12171612?hl=ko)
- [광고 쿠키와 개인정보처리방침](https://support.google.com/adsense/answer/1348695?hl=ko)
- [Google의 EU 사용자 동의 정책](https://www.google.com/about/company/user-consent-policy/)
- [인증 CMP 안내](https://support.google.com/adsense/answer/13554116?hl=ko)
