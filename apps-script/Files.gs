/**
 * 학생별 폴더: 교사 공유 폴더(모델링탐구_학생결과물) 안에 가입 정보로 [학번_이름] 폴더를 만들고
 * 그 학생의 보고서 문서, 2단계 원본 자료(탐구자료_학번_이름), 풀이 사진(50KB 이하로 화면에서 압축), 평가 결과 문서를 모두 넣습니다.
 * 파일 설명(description)에 "학생아이디|종류|칸" 을 적어 두고, 꺼내거나 문서에 넣을 때 이 값으로 주인을 확인합니다.
 * 예전 버전이 쓰던 "탐구자료" 폴더(스크립트 속성 UP_FOLDER_ID)의 파일도 읽을 수 있고, 교사 탭 [학생별 폴더로 정리]로 옮깁니다.
 */
const DATA_MAX_B64 = 14000000;   // 원본 자료: 약 10MB
const PHOTO_MAX_B64 = 80000;     // 풀이 사진: 50KB(+base64 여유)
const safeName_ = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

/** 학생의 [학번_이름] 폴더. 폴더 ID는 스크립트 속성 SF_<아이디>에 기억하고, 학번·이름이 바뀌면 폴더 이름도 맞춥니다. withLock_ 안에서 부르지 마세요. */
function studentFolder_(id) {
  const acc = sheet_(SHEETS.acc), row = findRow_(acc, id); if (row < 0) fail_('NOT_FOUND');
  const r = acc.getRange(row, 1, 1, 4).getValues()[0];
  const want = safeName_(String(r[2] || '').trim() || id) + '_' + safeName_(String(r[3] || '').trim() || id);
  const props = PropertiesService.getScriptProperties(), key = 'SF_' + id, fid = props.getProperty(key);
  if (fid) { try { const f = DriveApp.getFolderById(fid); if (!f.isTrashed()) { if (f.getName() !== want) f.setName(want); return f; } } catch (e) {} }
  const root = rootFolder_(), it = root.getFoldersByName(want), f = it.hasNext() ? it.next() : root.createFolder(want);
  props.setProperty(key, f.getId());
  return f;
}
/** 예전 "탐구자료" 폴더 (없으면 null, 새로 만들지 않음) */
function legacyUploadFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty('UP_FOLDER_ID'); if (!id) return null;
  try { const f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
}
function inFolder_(file, folder) { const ps = file.getParents(); while (ps.hasNext()) if (ps.next().getId() === folder.getId()) return true; return false; }

function apiUpload_(user, p) {
  if (user.role !== 'student') fail_('FORBIDDEN');
  if (readConfig_().locked) fail_('LOCKED');
  const kind = p.kind === 'photo' ? 'photo' : 'data';
  const key = kind === 'photo' ? String(p.key || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20) : 'data';
  const b64 = String(p.b64 || '');
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) fail_('BAD_FILE');
  if (b64.length > (kind === 'photo' ? PHOTO_MAX_B64 : DATA_MAX_B64)) fail_('BIG_FILE');
  const extM = String(p.name || '').match(/\.([A-Za-z0-9]{1,6})$/);
  const ext = kind === 'photo' ? 'jpg' : (extM ? extM[1].toLowerCase() : 'bin');
  const base = kind === 'photo' ? `풀이사진_${safeName_(user.sid)}_${safeName_(user.name)}_${key}` : `탐구자료_${safeName_(user.sid)}_${safeName_(user.name)}`;
  const fname = base + '.' + ext;
  const mime = kind === 'photo' ? 'image/jpeg' : (/^[\w.+-]+\/[\w.+-]+$/.test(String(p.mime || '')) ? String(p.mime) : 'application/octet-stream');
  const tag = user.id + '|' + kind + '|' + key, folder = studentFolder_(user.id);
  // 같은 칸의 예전 파일은 휴지통으로 (이름을 바꿨을 수도 있으니 설명으로 찾습니다)
  [folder, legacyUploadFolder_()].forEach(fd => { if (!fd) return; const it = fd.getFiles(); while (it.hasNext()) { const f = it.next(); if (String(f.getDescription() || '') === tag) f.setTrashed(true); } });
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, fname));
  file.setDescription(tag);
  return { file: { id: file.getId(), name: fname, url: file.getUrl(), at: Date.now(), size: file.getSize() } };
}

/** id 파일이 ownerId 학생의 것이고 그 학생 폴더(또는 예전 탐구자료 폴더)에 있는지 확인한 뒤 돌려줍니다. */
function ownFile_(id, ownerId) {
  let f; try { f = DriveApp.getFileById(String(id || '')); } catch (e) { fail_('NOT_FOUND'); }
  if (f.isTrashed() || String(f.getDescription() || '').split('|')[0] !== String(ownerId)) fail_('FORBIDDEN');
  const legacy = legacyUploadFolder_();
  if (!inFolder_(f, studentFolder_(ownerId)) && !(legacy && inFolder_(f, legacy))) fail_('FORBIDDEN');
  return f;
}
/** 풀이 사진 미리보기용. 학생은 자기 것, 교사는 p.owner 학생 것. */
function apiGetFile_(user, p) {
  const owner = user.role === 'teacher' && p.owner ? String(p.owner) : user.id;
  const f = ownFile_(p.id, owner), blob = f.getBlob();
  if (f.getSize() > 300000) fail_('BIG_FILE');
  return { b64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() };
}

/* ───── 평가 결과 문서: 교사가 채점을 저장할 때마다 학생 폴더의 "평가결과_학번_이름"을 새로 씁니다 ───── */
function writeGradeDoc_(id, g) {
  const acc = sheet_(SHEETS.acc), row = findRow_(acc, id); if (row < 0) return;
  const r = acc.getRange(row, 1, 1, 4).getValues()[0], sid = String(r[2] || ''), name = String(r[3] || id);
  const props = PropertiesService.getScriptProperties(), key = 'GD_' + id, folder = studentFolder_(id);
  const title = `평가결과_${safeName_(sid)}_${safeName_(name)}`;
  let doc = null; const did = props.getProperty(key);
  if (did) { try { if (!DriveApp.getFileById(did).isTrashed()) doc = DocumentApp.openById(did); } catch (e) {} }
  if (!doc) { doc = DocumentApp.create(title); const file = DriveApp.getFileById(doc.getId()); file.moveTo(folder); file.setDescription(id + '|grade|grade'); props.setProperty(key, doc.getId()); }
  else { const file = DriveApp.getFileById(doc.getId()); if (!inFolder_(file, folder)) file.moveTo(folder); }
  if (doc.getName() !== title) doc.setName(title);
  const body = doc.getBody(); body.clear();
  const sc = g.scores || {}, notes = g.notes || {}, els = GRD_HEAD.slice(3, 7);
  const nums = [1, 2, 3, 4].map(i => (sc['s' + i] === '' || sc['s' + i] == null) ? '' : Number(sc['s' + i]));
  body.appendParagraph('모델링 탐구 수행평가 · 평가 결과').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`학번 ${sid || '–'} · 이름 ${name}`);
  const rows = [['평가요소', '점수', '의견']].concat(els.map((e, i) => [e, nums[i] === '' ? '–' : String(nums[i]), String(notes['s' + (i + 1)] || '') || ' ']));
  rows.push(['총점', String(nums.reduce((s, v) => s + (v === '' ? 0 : v), 0)), ' ']);
  const t = body.appendTable(rows); t.getRow(0).editAsText().setBold(true);
  body.appendParagraph('종합 피드백').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(String(g.overall || '') || '(없음)');
  body.appendParagraph(`학생 공개: ${g.released ? '공개' : '공개 안 함'} · 채점: ${g.by || ''} · ${Utilities.formatDate(new Date(g.updatedAt || Date.now()), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
  doc.saveAndClose();
}

/* ───── 교사: 예전 파일을 학생별 폴더로 옮기기 (한 번 누르면 됨) ───── */
function apiOrganize_(user) {
  const accs = sheet_(SHEETS.acc).getDataRange().getValues().slice(1).filter(r => r[0] && String(r[1]) !== 'teacher');
  const legacy = legacyUploadFolder_(); let folders = 0, moved = 0, graded = 0;
  const byOwner = {};
  if (legacy) { const it = legacy.getFiles(); while (it.hasNext()) { const f = it.next(), o = String(f.getDescription() || '').split('|')[0]; if (o) (byOwner[o] = byOwner[o] || []).push(f); } }
  accs.forEach(r => {
    const id = String(r[0]), folder = studentFolder_(id); folders++;
    const rec = docRecord_(id);
    if (rec && rec.docId) { try { const f = DriveApp.getFileById(rec.docId); if (!f.isTrashed() && !inFolder_(f, folder)) { f.moveTo(folder); moved++; } } catch (e) {} }
    (byOwner[id] || []).forEach(f => { f.moveTo(folder); moved++; });
    const g = readJson_(SHEETS.grd, id, GRD_DATA_COL);
    if (g && g.scores) { try { writeGradeDoc_(id, g); graded++; } catch (e) {} }
  });
  return { folders: folders, moved: moved, graded: graded };
}
