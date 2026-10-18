/**
 * 모델링 탐구 수행평가 — 구글 Apps Script 웹 앱 (서버)
 * 학생은 아이디·비밀번호로 가입하고, 기록은 이 스프레드시트에 쌓입니다.
 * 처음 한 번: 편집기에서 setup 을 실행해 시트를 만들고 권한을 허용합니다.
 * 그다음 배포 → 새 배포 → 웹 앱(실행: 나, 액세스: 모든 사용자) → /exec 주소를 config.js 에 넣습니다.
 */
const SHEETS = { cfg: '설정', acc: '계정', rec: '기록', grd: '채점' };
const ACC_HEAD = ['아이디', '역할', '학번', '이름', 'salt', 'hash', '가입 시각', '최근 로그인', '비밀번호 바꾸기 필요'];
const REC_HEAD = ['아이디', '학번', '이름', '탐구 제목', '상태', '최근 저장', '제출 시각', '작성률(%)', '자료 수', '모델 A 식', '모델 A 평균 오차율(%)', '데이터'];
const GRD_HEAD = ['아이디', '학번', '이름', '실험 설계 및 자료 수집', '자료 처리 및 수학적 표현', '수학적 모델링', '결과 분석·검증 및 성찰', '총점', '학생 공개', '종합 피드백', '최근 채점', '데이터'];
const REC_DATA_COL = REC_HEAD.length;   // 12번째 열부터 JSON 조각
const GRD_DATA_COL = GRD_HEAD.length;
const CHUNK = 40000;                    // 셀 하나에 5만 자까지 들어가므로 4만 자씩 나눕니다
const SESSION_SEC = 21600;              // 6시간
const HASH_ROUNDS = 200;

/* ───── 웹 앱 진입: 화면은 GitHub Pages, 여기는 저장 서버(API)만 맡습니다 ───── */
function doGet() { return json_({ ok: true, service: '모델링 탐구 수행평가 API', time: Date.now() }); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'BAD_REQUEST' }); }
  return json_(api(body.action, body.payload, body.token));
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('수행평가 앱').addItem('초기 설정 (처음 한 번)', 'setup').addToUi();
}

/** 시트와 머리글을 만들고, 교사 가입 코드가 비어 있으면 새로 정합니다. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, head) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#E1EFF0'); }
    return sh;
  };
  const cfg = make(SHEETS.cfg, ['항목', '값', '설명']);
  if (cfg.getLastRow() < 5) {
    cfg.getRange(2, 1, 4, 3).setValues([
      ['교사 가입 코드', makeCode_(8), '교사 계정을 만들 때 가입 화면의 "교사 가입 코드" 칸에 넣습니다. 학생에게 알려 주지 마세요.'],
      ['학급 코드', '', '비워 두면 링크를 아는 누구나 학생으로 가입합니다. 값을 넣으면 그 코드를 아는 학생만 가입합니다.'],
      ['작성 마감', false, 'TRUE면 학생이 고칠 수 없습니다. 교사 대시보드에서 바꿀 수 있습니다.'],
      ['공지', '', '학생 화면 맨 위에 보이는 공지입니다.']
    ]);
    cfg.setColumnWidth(3, 520);
  }
  make(SHEETS.acc, ACC_HEAD).hideColumns(5, 2);  // salt·hash 열 숨김
  make(SHEETS.rec, REC_HEAD);
  make(SHEETS.grd, GRD_HEAD);
  const code = cfg.getRange(2, 2).getValue();
  try { SpreadsheetApp.getUi().alert('설정을 마쳤습니다.\n\n교사 가입 코드: ' + code + '\n\n이 코드는 "설정" 시트에서 언제든 바꿀 수 있습니다.'); } catch (e) { Logger.log('교사 가입 코드: ' + code); }
}

/* ───── 하나의 입구: 화면이 POST {action, payload, token} 으로 부릅니다 ───── */
function api(action, payload, token) {
  payload = payload || {};
  try {
    const pub = { config: apiConfig_, signup: apiSignup_, login: apiLogin_ };
    if (pub[action]) return Object.assign({ ok: true }, pub[action](payload));
    const user = sessionUser_(token);
    if (!user) return { ok: false, error: 'SESSION' };
    const mine = { me: apiMe_, save: apiSave_, status: apiStatus_, changePw: apiChangePw_, logout: apiLogout_ };
    if (mine[action]) return Object.assign({ ok: true }, mine[action](user, payload, token));
    const teach = { roster: apiRoster_, saveGrade: apiSaveGrade_, setConfig: apiSetConfig_, reopen: apiReopen_, accounts: apiAccounts_, resetPw: apiResetPw_, deleteAccount: apiDeleteAccount_ };
    if (teach[action]) {
      if (user.role !== 'teacher') return { ok: false, error: 'FORBIDDEN' };
      return Object.assign({ ok: true }, teach[action](user, payload));
    }
    return { ok: false, error: 'UNKNOWN_ACTION' };
  } catch (e) {
    if (e && e.code) return { ok: false, error: e.code };
    return { ok: false, error: 'SERVER', message: String(e && e.message || e) };
  }
}
function fail_(code) { const e = new Error(code); e.code = code; throw e; }

/* ───── 설정 ───── */
function readConfig_() {
  const sh = sheet_(SHEETS.cfg), vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
  const m = {}; vals.forEach(r => { m[String(r[0]).trim()] = r[1]; });
  return {
    teacherCode: String(m['교사 가입 코드'] || '').trim(),
    classCode: String(m['학급 코드'] || '').trim(),
    locked: m['작성 마감'] === true || String(m['작성 마감']).toUpperCase() === 'TRUE',
    notice: String(m['공지'] || '')
  };
}
function publicConfig_() { const c = readConfig_(); return { needClassCode: !!c.classCode, locked: c.locked, notice: c.notice }; }
function apiConfig_() { return { config: publicConfig_() }; }
function writeConfigValue_(label, value) {
  const sh = sheet_(SHEETS.cfg), col = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]).trim());
  const i = col.indexOf(label);
  if (i < 0) sh.appendRow([label, value]); else sh.getRange(i + 1, 2).setValue(value);
}

/* ───── 계정 ───── */
function apiSignup_(p) {
  const id = String(p.id || '').trim(), pw = String(p.pw || '');
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(id)) fail_('BAD_ID');
  if (pw.length < 4 || pw.length > 64) fail_('BAD_PW');
  const cfg = readConfig_();
  let role = 'student';
  if (p.teacherCode) { if (!cfg.teacherCode || String(p.teacherCode).trim() !== cfg.teacherCode) fail_('TEACHER_CODE'); role = 'teacher'; }
  else if (cfg.classCode && String(p.classCode || '').trim() !== cfg.classCode) fail_('CLASS_CODE');
  return withLock_(() => {
    const sh = sheet_(SHEETS.acc);
    if (findRow_(sh, id) > 0) fail_('DUP_ID');
    const salt = makeCode_(16), now = new Date();
    sh.appendRow([id, role, String(p.sid || '').trim(), String(p.name || '').trim(), salt, hash_(salt, pw), now, now, false]);
    const token = newSession_(id);
    return { token: token, user: { id: id, role: role, sid: String(p.sid || '').trim(), name: String(p.name || '').trim(), mustChange: false } };
  });
}
function apiLogin_(p) {
  const id = String(p.id || '').trim(), sh = sheet_(SHEETS.acc), row = findRow_(sh, id);
  if (row < 0) fail_('WRONG_LOGIN');
  const r = sh.getRange(row, 1, 1, ACC_HEAD.length).getValues()[0];
  if (hash_(r[4], String(p.pw || '')) !== r[5]) fail_('WRONG_LOGIN');
  sh.getRange(row, 8).setValue(new Date());
  return { token: newSession_(id), user: userFromRow_(r) };
}
function apiChangePw_(user, p) {
  const pw = String(p.newPw || '');
  if (pw.length < 4 || pw.length > 64) fail_('BAD_PW');
  return withLock_(() => {
    const sh = sheet_(SHEETS.acc), row = findRow_(sh, user.id), r = sh.getRange(row, 1, 1, ACC_HEAD.length).getValues()[0];
    if (!r[8] && hash_(r[4], String(p.oldPw || '')) !== r[5]) fail_('WRONG_PW');
    const salt = makeCode_(16);
    sh.getRange(row, 5, 1, 2).setValues([[salt, hash_(salt, pw)]]);
    sh.getRange(row, 9).setValue(false);
    return {};
  });
}
function apiLogout_(user, p, token) { CacheService.getScriptCache().remove('s_' + token); return {}; }
function userFromRow_(r) { return { id: String(r[0]), role: String(r[1]) === 'teacher' ? 'teacher' : 'student', sid: String(r[2]), name: String(r[3]), mustChange: r[8] === true || String(r[8]).toUpperCase() === 'TRUE' }; }

/* ───── 세션 ───── */
function newSession_(id) { const t = Utilities.getUuid() + makeCode_(8); CacheService.getScriptCache().put('s_' + t, id, SESSION_SEC); return t; }
function sessionUser_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache(), id = cache.get('s_' + token);
  if (!id) return null;
  const sh = sheet_(SHEETS.acc), row = findRow_(sh, id);
  if (row < 0) return null;
  cache.put('s_' + token, id, SESSION_SEC);  // 쓰는 동안은 계속 연장
  return userFromRow_(sh.getRange(row, 1, 1, ACC_HEAD.length).getValues()[0]);
}

/* ───── 학생 기록 ───── */
function apiMe_(user) {
  return { user: user, doc: readJson_(SHEETS.rec, user.id, REC_DATA_COL), grade: releasedGrade_(user.id), config: publicConfig_() };
}
function apiStatus_(user) {
  const doc = readJson_(SHEETS.rec, user.id, REC_DATA_COL) || {};
  return { config: publicConfig_(), grade: releasedGrade_(user.id), status: doc.status || 'draft', reopenAt: doc.reopenAt || null };
}
function releasedGrade_(id) { const g = readJson_(SHEETS.grd, id, GRD_DATA_COL); return g && g.released ? g : null; }
function apiSave_(user, p) {
  const doc = p.doc;
  if (!doc || typeof doc !== 'object') fail_('BAD_DOC');
  if (readConfig_().locked && user.role !== 'teacher') fail_('LOCKED');
  return withLock_(() => {
    const prev = readJson_(SHEETS.rec, user.id, REC_DATA_COL);
    if (prev && prev.reopenAt && prev.reopenAt !== doc.reopenAt) { doc.reopenAt = prev.reopenAt; }  // 교사가 다시 연 기록은 유지
    doc.updatedAt = Date.now();
    const s = p.summary || {};
    const info = doc.info || {};
    writeJson_(SHEETS.rec, user.id, REC_DATA_COL, doc, [user.id, info.sid || user.sid, info.name || user.name, info.title || '', doc.status === 'submitted' ? '제출' : '작성 중',
      new Date(doc.updatedAt), doc.submittedAt ? new Date(doc.submittedAt) : '', s.progress == null ? '' : s.progress, s.n == null ? '' : s.n, s.formA || '', s.errA == null ? '' : s.errA]);
    return { updatedAt: doc.updatedAt, reopenAt: doc.reopenAt || null };
  });
}

/* ───── 교사 ───── */
function apiRoster_(user, p) {
  const since = Number(p.since || 0);
  const accs = sheet_(SHEETS.acc).getDataRange().getValues().slice(1).filter(r => r[0] && String(r[1]) !== 'teacher');
  const recs = mapJson_(SHEETS.rec, REC_DATA_COL), grades = mapJson_(SHEETS.grd, GRD_DATA_COL);
  const students = accs.map(r => {
    const id = String(r[0]), doc = recs[id] || null, upd = doc && doc.updatedAt || 0;
    return { id: id, sid: String(r[2]), name: String(r[3]), lastLogin: r[7] ? new Date(r[7]).getTime() : 0, updatedAt: upd, doc: upd > since ? doc : undefined };
  });
  return { students: students, grades: grades, config: publicConfig_(), sheetUrl: SpreadsheetApp.getActive().getUrl(), serverTime: Date.now() };
}
function apiSaveGrade_(user, p) {
  const id = String(p.id || ''), g = p.grade || {};
  return withLock_(() => {
    const acc = sheet_(SHEETS.acc), row = findRow_(acc, id);
    if (row < 0) fail_('NOT_FOUND');
    const a = acc.getRange(row, 1, 1, 4).getValues()[0], doc = readJson_(SHEETS.rec, id, REC_DATA_COL) || {}, info = doc.info || {};
    const sc = g.scores || {}, nums = [1, 2, 3, 4].map(i => (sc['s' + i] === '' || sc['s' + i] == null) ? '' : Number(sc['s' + i]));
    g.updatedAt = Date.now();
    writeJson_(SHEETS.grd, id, GRD_DATA_COL, g, [id, info.sid || a[2], info.name || a[3], nums[0], nums[1], nums[2], nums[3],
      nums.reduce((s, v) => s + (v === '' ? 0 : v), 0), g.released ? '공개' : '', g.overall || '', new Date(g.updatedAt)]);
    return { updatedAt: g.updatedAt };
  });
}
function apiSetConfig_(user, p) {
  return withLock_(() => {
    if ('locked' in p) writeConfigValue_('작성 마감', !!p.locked);
    if ('notice' in p) writeConfigValue_('공지', String(p.notice || ''));
    return { config: publicConfig_() };
  });
}
function apiReopen_(user, p) {
  return withLock_(() => {
    const doc = readJson_(SHEETS.rec, String(p.id), REC_DATA_COL);
    if (!doc) fail_('NOT_FOUND');
    doc.status = 'draft'; doc.reopenAt = Date.now(); doc.updatedAt = Date.now();
    writeJson_(SHEETS.rec, String(p.id), REC_DATA_COL, doc, null);
    const sh = sheet_(SHEETS.rec), row = findRow_(sh, String(p.id)); sh.getRange(row, 5, 1, 2).setValues([['작성 중', new Date()]]);
    return {};
  });
}
function apiAccounts_() {
  const rows = sheet_(SHEETS.acc).getDataRange().getValues().slice(1).filter(r => r[0]);
  return { accounts: rows.map(r => ({ id: String(r[0]), role: String(r[1]), sid: String(r[2]), name: String(r[3]),
    created: r[6] ? new Date(r[6]).getTime() : 0, lastLogin: r[7] ? new Date(r[7]).getTime() : 0, mustChange: r[8] === true })) };
}
function apiResetPw_(user, p) {
  const pw = String(p.newPw || '');
  if (pw.length < 4 || pw.length > 64) fail_('BAD_PW');
  return withLock_(() => {
    const sh = sheet_(SHEETS.acc), row = findRow_(sh, String(p.id));
    if (row < 0) fail_('NOT_FOUND');
    const salt = makeCode_(16);
    sh.getRange(row, 5, 1, 2).setValues([[salt, hash_(salt, pw)]]);
    sh.getRange(row, 9).setValue(true);  // 학생이 다음 로그인 때 새 비밀번호를 정합니다
    return {};
  });
}
function apiDeleteAccount_(user, p) {
  const id = String(p.id || '');
  if (id === user.id) fail_('SELF');
  return withLock_(() => {
    [SHEETS.acc, SHEETS.rec, SHEETS.grd].forEach(n => { const sh = sheet_(n), row = findRow_(sh, id); if (row > 0) sh.deleteRow(row); });
    return {};
  });
}

/* ───── 시트 도우미 ───── */
function sheet_(name) { const sh = SpreadsheetApp.getActive().getSheetByName(name); if (!sh) fail_('NO_SETUP'); return sh; }
function findRow_(sh, id) {
  const n = sh.getLastRow(); if (n < 2) return -1;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function readJson_(name, id, dataCol) {
  const sh = sheet_(name), row = findRow_(sh, id); if (row < 0) return null;
  const w = sh.getLastColumn(); if (w < dataCol) return null;
  const parts = sh.getRange(row, dataCol, 1, w - dataCol + 1).getValues()[0];
  return parseParts_(parts);
}
function mapJson_(name, dataCol) {
  const vals = sheet_(name).getDataRange().getValues().slice(1), out = {};
  vals.forEach(r => { if (r[0]) { const d = parseParts_(r.slice(dataCol - 1)); if (d) out[String(r[0])] = d; } });
  return out;
}
function parseParts_(parts) { const s = parts.map(v => String(v == null ? '' : v)).join(''); if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; } }
function writeJson_(name, id, dataCol, obj, headVals) {
  const sh = sheet_(name), s = JSON.stringify(obj), chunks = [];
  for (let i = 0; i < s.length; i += CHUNK) chunks.push(s.slice(i, i + CHUNK));
  let row = findRow_(sh, id);
  if (row < 0) { row = sh.getLastRow() + 1; sh.getRange(row, 1).setValue(id); }
  if (headVals) sh.getRange(row, 1, 1, headVals.length).setValues([headVals]);
  const oldW = Math.max(sh.getLastColumn() - dataCol + 1, 0), w = Math.max(chunks.length, oldW, 1);
  const line = []; for (let i = 0; i < w; i++) line.push(chunks[i] || '');
  const rg = sh.getRange(row, dataCol, 1, w); rg.setNumberFormat('@'); rg.setValues([line]);
}
function withLock_(fn) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function hash_(salt, pw) {
  let h = salt + '|' + pw;
  for (let i = 0; i < HASH_ROUNDS; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function makeCode_(n) { const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += cs.charAt(Math.floor(Math.random() * cs.length)); return s; }
