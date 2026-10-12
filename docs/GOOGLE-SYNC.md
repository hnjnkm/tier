# Google 로그인과 기기 간 티어 동기화

이 기능은 Google 계정으로 로그인한 사용자의 국내·해외 티어표를 Firebase Authentication과 Cloud Firestore에 저장합니다. 기존 비로그인 티어표와 JSON 파일 백업은 계속 사용할 수 있습니다. 프로젝트와 로그인 설정이 없는 배포본에서는 Google 서버에 연결하지 않습니다.

저장소에는 실제 Firebase 프로젝트의 공개 웹 설정이 아직 없습니다. `public/firebase-config.json`의 기본값은 `{"enabled":false}`입니다. 작동하는 로그인을 연결하려면 아래 설정을 사이트 운영자의 Firebase 프로젝트에서 완료해야 합니다. 임의의 프로젝트 ID나 다른 서비스의 관리자 인증 정보를 넣으면 안 됩니다.

## Firebase 콘솔 설정

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 운영자가 소유한 프로젝트를 선택하거나 새 프로젝트를 만듭니다. 이 사이트를 위해 Google Analytics를 연결할 필요는 없습니다.
2. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱**에서 앱을 등록합니다. Firebase Hosting 등록은 필요하지 않습니다. 표시된 `firebaseConfig`에서 `apiKey`, `authDomain`, `projectId`, `appId`를 복사합니다.
3. **Authentication → 로그인 방법 → Google**을 활성화하고 콘솔에서 요청하는 프로젝트 이름과 지원 이메일을 입력합니다. **설정 → 승인된 도메인**에 `hnjnkm.github.io`를 추가합니다. 도메인에는 `/tier/` 경로와 `https://`를 넣지 않습니다. 개발용 로그인이 필요할 때만 `localhost`도 추가합니다.
4. **Firestore Database → 데이터베이스 만들기**에서 기본 데이터베이스를 **프로덕션 모드**로 만듭니다. 한국 사용자가 주 대상이면 서울 리전 `asia-northeast3`를 선택할 수 있습니다. 생성 후 데이터베이스 위치를 변경하기 어려우므로 생성 전에 확인합니다. 테스트 모드의 공개 규칙은 사용하지 않습니다.
5. **Firestore Database → 규칙**에 저장소의 [firestore.rules](../firestore.rules) 전체 내용을 붙여 넣고 **게시**합니다. 로그인 사용자 자신의 `users/{uid}/boards/korean`과 `users/{uid}/boards/global`만 읽고 저장할 수 있습니다. 다른 사용자의 문서와 다른 경로는 열리지 않습니다.
6. `public/firebase-config.json`을 실제 웹 앱 설정으로 바꿉니다. JSON 형식은 다음과 같으며, 아래의 설명 문자열을 그대로 배포하면 안 됩니다.

```json
{
  "enabled": true,
  "apiKey": "Firebase 콘솔에서 복사한 apiKey",
  "authDomain": "Firebase 콘솔에서 복사한 authDomain",
  "projectId": "Firebase 콘솔에서 복사한 projectId",
  "appId": "Firebase 콘솔에서 복사한 appId"
}
```

웹 앱 설정은 브라우저에 공개되는 값입니다. **서비스 계정 JSON, private_key, Admin SDK 인증서, OAuth client secret**을 이 파일이나 GitHub에 넣지 않습니다. 접근 권한은 위 Firestore 규칙과 Firebase Authentication에서 제한합니다. Google 로그인에는 프로필 이름과 이메일만 사용하며 Google Drive나 추가 Google API 권한을 요청하지 않습니다.

`authDomain`에는 콘솔의 값을 그대로 사용합니다. Google OAuth 클라이언트를 별도로 편집해야 하는 경우에는 해당 Firebase 프로젝트의 웹 클라이언트와 `https://<authDomain>/__/auth/handler` 리디렉션을 확인합니다. 다른 프로젝트의 OAuth 설정을 공유하면 안 됩니다.

## 검증 후 배포

```sh
npm test
npm run test:cloud
npm run build:pages
npm run test:cloud:browser
```

Firestore 규칙은 웹사이트 코드와 별도로 게시해야 합니다. CLI를 쓸 경우 자신의 프로젝트를 명시해서 `npx firebase deploy --only firestore:rules --project ACTUAL_PROJECT_ID`를 실행합니다. 기본 프로젝트 별칭을 저장하지 않았으므로 프로젝트를 생략하지 않습니다. 이 문서는 배포 방법을 설명하며 클라우드 프로젝트 생성이나 실제 규칙 배포를 자동으로 수행하지 않습니다.

GitHub Pages 배포가 끝나면 다음을 실제 계정으로 확인합니다.

- `https://hnjnkm.github.io/tier/firebase-config.json`에 올바른 공개 설정이 표시되는지 확인합니다.
- PC에서 Google 로그인 후 국내·해외 티어를 수정하고, 같은 계정으로 모바일에서 로그인해 두 티어표가 각각 나타나는지 확인합니다.
- 다른 Google 계정에서는 이전 계정의 티어가 보이지 않아야 합니다. 로그아웃 후에는 로그인한 계정의 클라우드 티어를 계속 노출하지 않아야 합니다.
- 두 기기가 동시에 같은 티어표를 수정하면 먼저 저장한 데이터를 무조건 덮어쓰지 않고 충돌 확인이 표시되어야 합니다.
- 네트워크가 끊겼을 때 서버 저장 완료로 표시되면 안 됩니다. 다시 연결한 뒤 기기 간 변경 내용을 확인합니다.

`auth/unauthorized-domain`은 Authentication 승인 도메인, `permission-denied`는 게시된 Firestore 규칙과 로그인 계정, `operation-not-allowed`는 Google 로그인 활성화 여부를 먼저 확인합니다. 팝업이 차단되면 브라우저 팝업 설정을 확인하고 로그인 버튼을 다시 누릅니다. 사용자가 로그인 팝업을 닫은 경우에는 데이터가 변경되지 않습니다.

## 저장 데이터와 운영

Firestore에는 사용자별로 국내·해외 문서가 하나씩 저장됩니다. 문서의 필드는 `schemaVersion`, JSON 문자열 `payload`, 증가하는 `revision`, 저장 식별자 `writeId`, 서버 시간 `updatedAt`입니다. `payload`에는 티어표 제목, 아티스트 배치, 선택한 곡, 직접 추가한 아티스트만 들어갑니다. 원본 인물 이미지나 음악 파일을 업로드하지 않습니다. 한 티어표의 JSON은 UTF-8 기준 700,000바이트까지입니다.

Google 계정의 프로필 이름과 이메일은 로그인 표시를 위해 브라우저에서 사용하며 티어 문서에 별도로 저장하지 않습니다. Firebase Authentication의 사용자 기록은 Firebase에서 관리합니다. 회원 간 공개 페이지나 티어 전체 목록 API는 제공하지 않습니다.

저장은 Firestore 트랜잭션으로 이전 버전을 확인합니다. 버전이 달라지면 다른 기기의 수정 내용을 그대로 덮어쓰지 않습니다. 깨진 데이터나 다른 티어표의 데이터를 읽었을 때에도 빈 티어표로 간주해서 자동 덮어쓰지 않습니다. 초기화는 빈 티어표를 새 버전으로 저장하며 클라이언트 문서 삭제는 허용하지 않습니다.

계정 및 클라우드 데이터 삭제가 필요한 경우 현재 [GitHub 문의](https://github.com/hnjnkm/tier/issues/new)를 이용합니다. 문의는 공개되므로 이메일, 인증 토큰, 전체 티어 파일과 같은 개인 정보를 게시하지 않습니다. 운영자가 요청자를 확인한 다음 Firestore의 해당 사용자 문서와 Firebase Authentication 사용자 기록을 콘솔에서 삭제할 수 있습니다. 다른 사용자의 요청만으로 계정을 삭제하면 안 됩니다. 브라우저의 데이터와 다운로드한 백업 파일은 사용자가 별도로 삭제해야 합니다. 삭제 기능을 앱에 추가할 경우 최근 로그인 확인과 기기 캐시 정리도 함께 구현합니다.

활성화된 배포는 개인정보처리방침에 Google/Firebase 로그인과 클라우드 저장을 설명해야 합니다. 이 저장소의 페이지 생성기는 활성화 설정에 맞춰 정책 문구를 선택합니다. 서비스 운영자와 문의 창구는 기존 GitHub 계정 `hnjnkm`과 공개 문의 링크를 유지합니다.

Firestore와 Authentication의 이용량은 Firebase 콘솔에서 확인합니다. 무료 할당량과 결제 여부는 프로젝트의 실제 요금제에 따라 달라집니다. 알림이나 예산 설정이 필요하면 해당 프로젝트에서 설정합니다. 아직 요금제나 예산을 변경하지 않았습니다.

## 로컬 에뮬레이터 테스트

`npm run test:cloud`는 Java 21이 필요합니다. Firebase CLI가 필요한 에뮬레이터를 `.runtime/firebase-emulators/`에 내려받고 실제 Google 리소스가 없는 `demo-tier-sync` 프로젝트만 실행합니다. 테스트는 익명/다른 계정 접근 차단, 필드 및 용량 제한, 서버 시간과 버전 검사, 실제 SDK 트랜잭션의 오래된 저장 충돌, 손상 데이터 보호를 확인합니다. 환경의 관리자 인증 파일과 Firebase CLI 토큰은 테스트 프로세스에서 제거합니다.

수동 브라우저 테스트에는 테스트 전용 설정을 사용할 수 있습니다. 이 설정을 운영 사이트에 배포하지 않습니다.

```json
{
  "enabled": true,
  "apiKey": "emulator-only-key",
  "authDomain": "demo-tier-sync.firebaseapp.com",
  "projectId": "demo-tier-sync",
  "appId": "1:1234567890:web:0123abcdef",
  "emulators": { "authPort": 9099, "firestorePort": 8080 }
}
```

에뮬레이터 연결은 `localhost` 또는 루프백 IP에서만 허용하고 목적지는 `127.0.0.1`로 고정합니다. 운영 도메인에서 에뮬레이터 설정을 읽으면 연결을 거부합니다. 실제 모바일 로그인을 확인하려면 콘솔의 실제 프로젝트 설정과 승인된 운영 도메인을 사용합니다.

공식 문서: [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/rules-conditions), [트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions), [Firebase 로컬 에뮬레이터](https://firebase.google.com/docs/emulator-suite).
