# 모델링 탐구 수행평가 웹 앱

전문 수학(삼각함수·미적분) 수학적 모델링 탐구 수행평가(40점) 웹 앱. 사용자는 수학 교사이며 한국어로 대화한다.

- 학생: 아이디·비밀번호로 가입(구글 계정 불필요) → 5단계 활동지 작성(자동 저장)
- 교사: 교사 가입 코드로 가입 → 대시보드에서 실시간 작성 현황, 채점, 작성 마감, 학생 비밀번호 초기화

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 전체. GitHub Pages로 배포: https://blis-logic.github.io/modeling-assessment/ (main 브랜치 / root, 커밋 후 1~2분 뒤 반영) |
| `config.js` | `apiUrl` = Apps Script 웹 앱 주소(끝이 `/exec`) |
| `apps-script/Code.gs` | 저장 서버. `doPost`로 JSON API 제공. 저장소는 컨테이너 스프레드시트의 시트 `설정`·`계정`·`기록`·`채점`·`문서` |
| `apps-script/Docs.gs` | 학생 결과물 구글 문서 생성·PDF 내보내기·교사 공유 폴더. 화면이 보낸 "문서 명세(spec)"를 활동지 서식으로 그리기만 하므로 문항이 바뀌어도 고칠 필요 없음 |
| `apps-script/appsscript.json` | Apps Script 매니페스트(웹 앱: 실행 계정 나, 액세스 ANYONE_ANONYMOUS) |
| `.clasp.json` | clasp가 만드는 scriptId 기록. 커밋해도 됨. 자격 증명(`~/.clasprc.json`)은 홈 폴더에 있으며 절대 커밋하지 않음 |

수학 엔진(`Code.gs`의 "수학 엔진" 부분과 화면 쪽 계산)은 구글 시트 v9 계산식과 **똑같이** 유지한다. 계산식을 바꿀 때는 두 곳을 함께 맞춘다.

비밀번호는 salt+해시로 `계정` 시트에만 저장된다. 학생 기록·비밀번호는 저장소에 올라가지 않는다.

## 학생 결과물 문서 · PDF · 교사 공유

- 화면(`index.html`의 `buildSpec`)이 `STAGES`와 학생 답으로 문서 명세를 만들고, 그래프 SVG는 PNG로 바꿔 함께 보낸다 → `Docs.gs`가 교사 Drive의 `모델링탐구_학생결과물` 폴더에 학생별 구글 문서(활동지 서식)로 그린다. 내용이 바뀐 경우에만(해시 비교) 다시 그린다.
- 학생이 쓰면 저장 후 20초쯤 지나 문서에 반영(한 방향: 앱 → 문서). 문서를 직접 고치면 다음 반영 때 덮어써진다.
- PDF는 같은 문서를 `getAs(PDF)`로 내보내 base64로 내려받는다(학생 화면 [PDF로 받기]).
- 교사 가입 시 구글 이메일을 받아 폴더 편집자로 공유한다. 이미 있는 교사는 대시보드 [교사 공유·문서] 탭에서 이메일을 넣어 공유한다. 학생은 구글 계정이 없으므로 문서에 접근하지 못한다(PDF만).
- 문서는 `문서` 시트(아이디·문서 ID·주소·해시)로 추적한다. 폴더 ID는 스크립트 속성 `FOLDER_ID`.
- **권한 범위가 늘었다**(`documents`, `drive`). 이 버전을 처음 배포할 때는 소유자가 편집기에서 `setup`을 다시 실행해 권한을 새로 허용해야 한다. 허용 전에 `clasp deploy -i`로 갱신하면 기존 학생 기능까지 멈출 수 있으니 순서를 지킨다.

## 저장 서버 배포 (clasp)

1. `npm i -g @google/clasp`
2. 사용자가 https://script.google.com/home/usersettings 에서 **Google Apps Script API**를 켠다.
3. `clasp login` — 브라우저 로그인은 사용자가 직접 한다(개인 Gmail 권장).
4. `clasp create --type sheets --title "모델링탐구_수행평가_기록" --rootDir apps-script`
   (만들어진 `appsscript.json`이 덮어써졌으면 저장소 버전으로 되돌린다.)
5. `clasp push`
6. `clasp open-script`로 편집기를 열고 사용자가 **setup**을 한 번 실행해 권한을 허용한다(구글 정책상 직접 해야 함). `설정` 시트에 교사 가입 코드가 생긴다.
7. `clasp deploy` → 배포 ID로 만든 `https://script.google.com/macros/s/<배포ID>/exec` 주소를 얻는다.
8. 시크릿 창에서 `/exec` 주소가 `{"ok":true,"service":"모델링 탐구 수행평가 API",...}`를 돌려주는지 확인한다.
9. `config.js`의 `apiUrl`에 넣고 커밋·`git push` 한다.

서버 코드를 고친 뒤에는 `clasp push` 후 **기존 배포를 새 버전으로 갱신**한다(`clasp deploy -i <배포ID>`). 새 배포를 만들면 주소가 바뀐다.

## 주의

- `/dev` 주소(테스트 배포)는 학생에게 절대 동작하지 않는다. 항상 `/exec`.
- 액세스는 반드시 `ANYONE_ANONYMOUS`(모든 사용자). 아니면 "현재 파일을 열 수 없습니다"나 로그인 화면이 뜬다.
- 학교 Workspace 계정은 익명 접근을 막을 수 있다. "모든 사용자" 옵션이 없으면 개인 Gmail 계정으로 만든다.
- 학교망이 TLS를 가로챈다. Node/npm은 `NODE_OPTIONS=--use-system-ca`(이미 설정됨)로 동작한다. TLS 검증을 끄지 않는다.
