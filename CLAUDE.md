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
| `apps-script/Files.gs` | 학생 파일 올리기: 2단계 원본 자료(`탐구자료_학번_이름`), 풀이 사진(화면에서 50KB 이하 JPEG로 압축). 공유 폴더 안 `탐구자료` 폴더(스크립트 속성 `UP_FOLDER_ID`). 파일 설명에 `학생아이디|종류|칸`을 적고 `ownFile_`로 주인 확인 |
| `apps-script/Docs.gs` | 학생 결과물 구글 문서 생성·PDF 내보내기·교사 공유 폴더. 화면이 보낸 "문서 명세(spec)"를 활동지 서식으로 그리기만 하므로 문항이 바뀌어도 고칠 필요 없음 |
| `apps-script/app.html` | **자동 생성**(`node tools/build-gas.js`): `index.html`+`config.js`+`mathtool.js`를 합친 화면. `/exec`를 그냥 열면 이 화면이 뜬다 |
| `tools/build-gas.js` | `app.html` 생성기. `index.html`·`config.js`·`mathtool.js`를 고친 뒤 `clasp push` 전에 실행 |
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

## 수식 입력기 · 기호 그리기 (`mathtool.js`, `apps-script/Math.gs`)

- 수식 칸(`math`·`longmath`)마다 [∑ 수식] 버튼, 기호 막대에 [∑ 수식 입력기](마지막으로 누른 칸). 수식은 칸 안에 `$LaTeX$`로 저장되고, 칸 아래·교사 읽기 화면에 수식으로 그려진다.
- 편집기는 MathLive 0.110.0(CDN, 필요할 때만 불러옴) + 직접 만든 갈래별 키보드(기본·삼각함수·미적분·모델 식·문자·기호·숫자).
- [기호 그리기] 판: 기호 **하나**를 그리면 비슷한 기호 8개를 보여 준다. 그린 모양과 견본(기호마다 여러 글꼴로 그린 모양 + `HW_HAND` 손글씨 모양)을 40×40 격자에서 챔퍼 거리·가로세로 비율로 비교한다. **API·서버·인터넷 없이 기기 안에서** 동작(1회 약 8ms). 식 전체 인식은 하지 않는다(교사가 무료·무키 방식만 원함). 잘 안 맞는 기호는 `HW_HAND`에 손글씨 견본을 더한다.
- 구글 문서: `makeDoc`이 `$…$`를 MathJax 3.2.2 SVG → PNG로 바꿔 `spec.math`로 보내고, `Docs.gs`가 글자 사이에 그림으로 넣는다(대체 텍스트 = LaTeX 원문). 구글 문서에는 수식을 만드는 API가 없어서 그림 방식을 쓴다.
- 예전의 Claude API 손글씨 인식(`recognize`·`setAiKey`, `script.external_request` 권한)은 제거했다. 스크립트 속성 `ANTHROPIC_API_KEY`가 남아 있어도 쓰지 않는다.
- 디자인 시안: `design/student-mockups.html` (A 차분한 집중 · B 데이터 벤토 · C 손에 잡히는 노트). **적용안 = B 배치 + A 색·폰트**: 상단 고정 막대(단계 버튼 + 한 줄 상황판), 블록마다 카드(12칸 격자, `chart:"deriv"`는 오른쪽에 f·f′ 그래프 카드, `last:1`은 맨 아래), 아래 고정 수식 독. 색은 남색 `#4F46E5` 계열, 글꼴은 IBM Plex Sans KR.

## 학생 화면 구성 (2026-10-19 개편)

- 맨 앞 탭 **[0 나의 수행]**(`stage=-1`, `homeHTML`): ① 기본 정보(학번·이름은 가입 정보로 고정 — 서버 `apiSave_`도 덮어씀, 탐구 제목, 탐구 주제는 1단계 `s1_card`와 같은 칸) ② 활동 대시보드(`dashHTML`) ③ 내 결과물(문서 반영·PDF·올린 파일) ④ 출처와 도구(5단계에서 옮김, 도구 체크 `doc.tools`, AI 활용 규칙). 보고서에는 출처와 도구가 5단계 끝(⑧)에 들어간다.
- 활동 시간 기록(`doc.act`): 15초마다 확인. 탐구 시간 = 화면이 보이고 2분 안에 움직임, 입력 시간 = 1분 안에 입력, 2분 넘게 움직임이 없으면 '활동 없음' 1회(30분 넘으면 기록 중지). 시간만 바뀌면 1분마다 저장하고 문서는 다시 만들지 않는다.
- 단계 머리는 `STAGE_LOOK`(그라데이션 색·아이콘), 칸 이름 설명은 `FIELD_HELP`(마우스를 대거나 누르면 풍선). 안 쓴 칸은 초록(`:placeholder-shown` — 입력칸에 `placeholder=" "` 필수), 쓰면 흰색.
- 라벨·안내·도움말의 `$…# 모델링 탐구 수행평가 웹 앱

전문 수학(삼각함수·미적분) 수학적 모델링 탐구 수행평가(40점) 웹 앱. 사용자는 수학 교사이며 한국어로 대화한다.

- 학생: 아이디·비밀번호로 가입(구글 계정 불필요) → 5단계 활동지 작성(자동 저장)
- 교사: 교사 가입 코드로 가입 → 대시보드에서 실시간 작성 현황, 채점, 작성 마감, 학생 비밀번호 초기화

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 전체. GitHub Pages로 배포: https://blis-logic.github.io/modeling-assessment/ (main 브랜치 / root, 커밋 후 1~2분 뒤 반영) |
| `config.js` | `apiUrl` = Apps Script 웹 앱 주소(끝이 `/exec`) |
| `apps-script/Code.gs` | 저장 서버. `doPost`로 JSON API 제공. 저장소는 컨테이너 스프레드시트의 시트 `설정`·`계정`·`기록`·`채점`·`문서` |
| `apps-script/Files.gs` | 학생 파일 올리기: 2단계 원본 자료(`탐구자료_학번_이름`), 풀이 사진(화면에서 50KB 이하 JPEG로 압축). 공유 폴더 안 `탐구자료` 폴더(스크립트 속성 `UP_FOLDER_ID`). 파일 설명에 `학생아이디|종류|칸`을 적고 `ownFile_`로 주인 확인 |
| `apps-script/Docs.gs` | 학생 결과물 구글 문서 생성·PDF 내보내기·교사 공유 폴더. 화면이 보낸 "문서 명세(spec)"를 활동지 서식으로 그리기만 하므로 문항이 바뀌어도 고칠 필요 없음 |
| `apps-script/app.html` | **자동 생성**(`node tools/build-gas.js`): `index.html`+`config.js`+`mathtool.js`를 합친 화면. `/exec`를 그냥 열면 이 화면이 뜬다 |
| `tools/build-gas.js` | `app.html` 생성기. `index.html`·`config.js`·`mathtool.js`를 고친 뒤 `clasp push` 전에 실행 |
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

## 수식 입력기 · 기호 그리기 (`mathtool.js`, `apps-script/Math.gs`)

- 수식 칸(`math`·`longmath`)마다 [∑ 수식] 버튼, 기호 막대에 [∑ 수식 입력기](마지막으로 누른 칸). 수식은 칸 안에 `$LaTeX$`로 저장되고, 칸 아래·교사 읽기 화면에 수식으로 그려진다.
- 편집기는 MathLive 0.110.0(CDN, 필요할 때만 불러옴) + 직접 만든 갈래별 키보드(기본·삼각함수·미적분·모델 식·문자·기호·숫자).
- [기호 그리기] 판: 기호 **하나**를 그리면 비슷한 기호 8개를 보여 준다. 그린 모양과 견본(기호마다 여러 글꼴로 그린 모양 + `HW_HAND` 손글씨 모양)을 40×40 격자에서 챔퍼 거리·가로세로 비율로 비교한다. **API·서버·인터넷 없이 기기 안에서** 동작(1회 약 8ms). 식 전체 인식은 하지 않는다(교사가 무료·무키 방식만 원함). 잘 안 맞는 기호는 `HW_HAND`에 손글씨 견본을 더한다.
- 구글 문서: `makeDoc`이 `$…$`를 MathJax 3.2.2 SVG → PNG로 바꿔 `spec.math`로 보내고, `Docs.gs`가 글자 사이에 그림으로 넣는다(대체 텍스트 = LaTeX 원문). 구글 문서에는 수식을 만드는 API가 없어서 그림 방식을 쓴다.
- 예전의 Claude API 손글씨 인식(`recognize`·`setAiKey`, `script.external_request` 권한)은 제거했다. 스크립트 속성 `ANTHROPIC_API_KEY`가 남아 있어도 쓰지 않는다.
- 디자인 시안: `design/student-mockups.html` (A 차분한 집중 · B 데이터 벤토 · C 손에 잡히는 노트). **적용안 = B 배치 + A 색·폰트**: 상단 고정 막대(단계 버튼 + 한 줄 상황판), 블록마다 카드(12칸 격자, `chart:"deriv"`는 오른쪽에 f·f′ 그래프 카드, `last:1`은 맨 아래), 아래 고정 수식 독. 색은 남색 `#4F46E5` 계열, 글꼴은 IBM Plex Sans KR.

는 `tx()`로 표시해 `mathPass`가 LaTeX로 그린다. 모델 식은 `formulaTex`(화면·문서), 시트 요약 열에는 여전히 `formulaText`.
- 2단계 자료는 엑셀형 표(`data.grid`): y를 넣으면 x를 위 두 줄 간격으로 자동 채움, 붙여 넣기, Enter로 아래 칸. 계산은 예전처럼 `data.xs`·`data.ys`(빈 y 줄 제외)를 쓰므로 수학 엔진은 그대로. 자료 요약(`s2_n`·`s2_xr`·`s2_yr`)은 자동 칸. 자료 목표 `DATA_GOAL=20`.
- 풀이·계산 칸(`longmath`)에는 [사진](흑백·50KB 이하로 줄여 Files.gs로 올림, `doc.photos[칸]`, 문서에 그림으로 들어감)과 [`-AI를 활용함-`] 넣기 단추, AI 안내가 붙는다.
- 변화율 표는 `x=a`로 표기하고 `f_A`·`f_B` 정의를 위에 보여 준다. 오차 그래프는 ±1 기준선, |오차|>1 은 `1+log10|오차|`로 줄여 그린다(`rz`).

## 접속 경로 두 가지 (github.io가 막힌 학교망 대비)

- 기본: https://blis-logic.github.io/modeling-assessment/ (GitHub Pages)
- 예비: `https://script.google.com/macros/s/<배포ID>/exec` 를 그냥 열면 같은 화면이 뜬다(`doGet`이 `app.html`을 보여 줌). 서버 상태 확인은 `/exec?ping=1`.
- 학교 와이파이가 `github.io`를 막은 적이 있다(`script.google.com`은 열림). 학생에게는 예비 주소도 함께 알려 준다.
- 예비 경로는 구글이 iframe 안에서 보여 주므로 `localStorage`가 막힐 수 있다(로그인이 새로고침 때 풀림). PDF 내려받기가 막히면 [내려받기가 시작되지 않으면 여기를 누르세요] 링크를 쓴다.
- 화면을 고친 뒤 순서: `node tools/build-gas.js` → 커밋·`git push`(GitHub Pages) → `clasp push` → `clasp deploy -i <배포ID>`(예비 경로).

## 저장 서버 배포 (clasp)

1. `npm i -g @google/clasp`
2. 사용자가 https://script.google.com/home/usersettings 에서 **Google Apps Script API**를 켠다.
3. `clasp login` — 브라우저 로그인은 사용자가 직접 한다(개인 Gmail 권장).
4. `clasp create --type sheets --title "모델링탐구_수행평가_기록" --rootDir apps-script`
   (만들어진 `appsscript.json`이 덮어써졌으면 저장소 버전으로 되돌린다.)
5. `clasp push`
6. `clasp open-script`로 편집기를 열고 사용자가 **setup**을 한 번 실행해 권한을 허용한다(구글 정책상 직접 해야 함). `설정` 시트에 교사 가입 코드가 생긴다.
7. `clasp deploy` → 배포 ID로 만든 `https://script.google.com/macros/s/<배포ID>/exec` 주소를 얻는다.
8. 시크릿 창에서 `/exec?ping=1` 주소가 `{"ok":true,"service":"모델링 탐구 수행평가 API",...}`를 돌려주는지 확인한다.
9. `config.js`의 `apiUrl`에 넣고 커밋·`git push` 한다.

서버 코드를 고친 뒤에는 `clasp push` 후 **기존 배포를 새 버전으로 갱신**한다(`clasp deploy -i <배포ID>`). 새 배포를 만들면 주소가 바뀐다.

## 주의

- `/dev` 주소(테스트 배포)는 학생에게 절대 동작하지 않는다. 항상 `/exec`.
- 액세스는 반드시 `ANYONE_ANONYMOUS`(모든 사용자). 아니면 "현재 파일을 열 수 없습니다"나 로그인 화면이 뜬다.
- 학교 Workspace 계정은 익명 접근을 막을 수 있다. "모든 사용자" 옵션이 없으면 개인 Gmail 계정으로 만든다.
- 학교망이 TLS를 가로챈다. Node/npm은 `NODE_OPTIONS=--use-system-ca`(이미 설정됨)로 동작한다. TLS 검증을 끄지 않는다.
