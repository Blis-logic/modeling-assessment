/**
 * 개인정보 수집·이용 동의 (학생만). 로그인 뒤 화면이 동의서를 보여 주고, 학생이 체크·서명(그림)하면
 * 소유자 Drive의 '모델링탐구_개인정보동의' 폴더(공유하지 않음)에 학생별 구글 문서를 만들고 '동의' 시트에 한 줄 남깁니다.
 * 동의서 문구는 여기 한 곳에만 둡니다(화면·문서가 같은 문구). 문구를 바꾸면 CONSENT_VER를 올려 모두에게 다시 받습니다.
 */
const CONSENT_VER = 'v1';
const CONSENT_ORG = '충북온라인학교';              // 학교·교과 이름 — 비어 있으면 머리에 넣지 않습니다
const CONSENT_KEEP = '해당 학년도 말(2027. 2. 28.)';
const CONSENT_FOLDER_NAME = '모델링탐구_개인정보동의';
const CONSENT_SHEET = '동의';
const CONSENT_HEAD = ['아이디', '학번', '이름', '동의서 판', '동의 시각', '문서 ID', '문서 주소'];
const CONSENT_SIGN_MAX = 300 * 1024;             // 서명 그림(PNG) 최대 크기

function consentText_() {
  return {
    ver: CONSENT_VER, org: CONSENT_ORG, title: '개인정보 수집·이용 동의서',
    sections: [
      { h: '1. 수집·이용 목적', items: ['수행평가 활동지 작성·자동 저장, 본인 확인(로그인)', '교사의 과정 평가·채점·피드백, 결과물 문서(보고서·PDF) 만들기'] },
      { h: '2. 수집 항목', items: [
        '필수(가입 때): 이름, 학번(5자리), 비밀번호(복원할 수 없는 암호값으로만 저장)',
        '활동 중 자동 생성: 활동지 답안·탐구 자료·모델 값, 활동 시간 기록(탐구·입력 시간, 활동 없음 횟수), 최근 저장·로그인 시각, 이 동의서의 서명',
        '선택(올릴 때만): 풀이 사진, 원본 자료 파일',
        '주민등록번호, 전화번호, 주소, 이메일, 위치 정보는 받지 않습니다. 사진에는 얼굴이나 다른 사람의 개인정보가 나오지 않게 찍어 주세요.'] },
      { h: '3. 보유·이용 기간', items: [CONSENT_KEEP + '까지 보관한 뒤 지체 없이 파기합니다. 매일 만드는 백업 사본은 7일이 지나면 삭제됩니다.'] },
      { h: '4. 처리 위탁·국외 이전', items: ['기록은 담당 교사의 Google 계정(Google 스프레드시트·드라이브)에 저장되며, Google의 해외 서버에 보관될 수 있습니다. 담당 교사 외의 제3자에게는 제공하지 않습니다.'] },
      { h: '5. 동의를 거부할 권리', items: ['동의하지 않을 수 있습니다. 동의하지 않으면 이 앱을 쓸 수 없으며, 담당 교사가 안내하는 종이 활동지로 같은 평가를 받을 수 있습니다(평가상 불이익 없음). 언제든 열람·정정·삭제를 요청할 수 있습니다.'] }
    ],
    agree: '위 내용을 읽고 개인정보 수집·이용에 동의합니다.'
  };
}

function consentSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONSENT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONSENT_SHEET); sh.appendRow(CONSENT_HEAD); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, CONSENT_HEAD.length).setFontWeight('bold').setBackground('#E1EFF0');
  }
  return sh;
}
/** 이 학생이 지금 판(CONSENT_VER)에 동의한 기록. 없으면 null */
function consentRecord_(id) {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONSENT_SHEET); if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, CONSENT_HEAD.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === id && String(rows[i][3]) === CONSENT_VER) return { at: new Date(rows[i][4]).getTime(), url: String(rows[i][6]) };
  return null;
}
/** me 응답에 붙이는 동의 상태. 학생이 아직 동의하지 않았을 때만 동의서 문구를 함께 보냅니다 */
function consentInfo_(user) {
  if (user.role !== 'student') return { need: false };
  const r = consentRecord_(user.id);
  return r ? { need: false, ver: CONSENT_VER, at: r.at } : { need: true, text: consentText_() };
}

/** 동의 폴더: 소유자만 봅니다(교사 공유 폴더와 따로, 누구에게도 공유하지 않음) */
function consentFolder_() {
  const props = PropertiesService.getScriptProperties();
  const find = () => {
    const id = props.getProperty('CONSENT_FOLDER_ID'); if (!id) return null;
    try { const f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
  };
  const have = find(); if (have) return have;
  return withLock_(() => {
    const again = find(); if (again) return again;
    const f = DriveApp.createFolder(CONSENT_FOLDER_NAME);
    props.setProperty('CONSENT_FOLDER_ID', f.getId());
    return f;
  });
}

function apiConsent_(user, p) {
  if (user.role !== 'student') fail_('FORBIDDEN');
  if (String(p.ver || '') !== CONSENT_VER) fail_('CONSENT_VER');
  if (p.agree !== true) fail_('CONSENT_AGREE');
  const done = consentRecord_(user.id); if (done) return { consent: { need: false, ver: CONSENT_VER, at: done.at } };  // 이미 동의함(두 번 눌러도 문서는 하나)
  let bytes;
  try { bytes = Utilities.base64Decode(String(p.sign || '')); } catch (e) { fail_('CONSENT_SIGN'); }
  if (!bytes || bytes.length < 200 || bytes.length > CONSENT_SIGN_MAX || (bytes[0] & 255) !== 0x89 || bytes[1] !== 0x50) fail_('CONSENT_SIGN');  // PNG만
  const now = new Date(), when = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const doc = DocumentApp.create('개인정보동의_' + (user.sid || '') + '_' + user.name);
  writeConsentDoc_(doc, user, Utilities.newBlob(bytes, 'image/png', 'sign.png'), when);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId()); file.moveTo(consentFolder_());
  withLock_(() => consentSheet_().appendRow([user.id, user.sid, user.name, CONSENT_VER, now, doc.getId(), doc.getUrl()]));
  return { consent: { need: false, ver: CONSENT_VER, at: now.getTime() } };
}

function writeConsentDoc_(doc, user, signBlob, when) {
  const A = DocumentApp.Attribute, t = consentText_(), body = doc.getBody();
  body.setMarginTop(48).setMarginBottom(48).setMarginLeft(56).setMarginRight(56);
  const style = (size, bold, color) => { const a = {}; a[A.FONT_FAMILY] = DOC_FONT; a[A.FONT_SIZE] = size; a[A.BOLD] = !!bold; a[A.FOREGROUND_COLOR] = color || '#18272B'; return a; };
  const para = (text, size, bold, color, after) => { const p = body.appendParagraph(String(text) || ' '); p.setAttributes(style(size, bold, color)).setSpacingAfter(after == null ? 4 : after); return p; };
  const first = body.getChild(0).asParagraph(); first.setText(t.title); first.setAttributes(style(18, true)).setSpacingAfter(4);
  para((t.org ? t.org + ' · ' : '') + '수학적 모델링 탐구 수행평가 웹 앱 · 동의서 판 ' + t.ver, 9.5, false, '#5B6B70', 12);
  t.sections.forEach(s => { para(s.h, 11.5, true, '#4F46E5', 2).setSpacingBefore(8); s.items.forEach(it => para('· ' + it, 10.5, false, null, 2)); });
  para('■  ' + t.agree, 11, true, null, 10).setSpacingBefore(14);
  const tb = body.appendTable([['학번', String(user.sid || '')], ['이름', String(user.name || '')], ['아이디', String(user.id || '')], ['동의 시각', when + ' (한국 시각)']]);
  tb.setBorderColor('#C9D3D6').setBorderWidth(0.75).setColumnWidth(0, 90);
  for (let r = 0; r < tb.getNumRows(); r++) { tb.getCell(r, 0).setBackgroundColor('#EEF0FF').setAttributes(style(10, true)); tb.getCell(r, 1).setAttributes(style(10.5)); }
  para('서명', 10.5, true, null, 2).setSpacingBefore(10);
  const sp = body.appendParagraph(' '), img = sp.appendInlineImage(signBlob), k = Math.min(1, 300 / img.getWidth());
  img.setWidth(Math.round(img.getWidth() * k)).setHeight(Math.round(img.getHeight() * k)).setAltTitle('서명').setAltDescription(user.name + ' 서명');
}
