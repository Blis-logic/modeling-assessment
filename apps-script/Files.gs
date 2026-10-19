/**
 * 학생이 올리는 파일: 2단계 원본 자료(탐구자료_학번_이름), 풀이 사진(50KB 이하로 화면에서 압축).
 * 교사 공유 폴더(모델링탐구_학생결과물) 안의 "탐구자료" 폴더에 저장합니다.
 * 파일 설명(description)에 "학생아이디|종류|칸" 을 적어 두고, 꺼내거나 문서에 넣을 때 이 값으로 주인을 확인합니다.
 */
const UP_FOLDER_NAME = '탐구자료';
const DATA_MAX_B64 = 14000000;   // 원본 자료: 약 10MB
const PHOTO_MAX_B64 = 80000;     // 풀이 사진: 50KB(+base64 여유)

function uploadFolder_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('UP_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const root = rootFolder_(), it = root.getFoldersByName(UP_FOLDER_NAME);
  const f = it.hasNext() ? it.next() : root.createFolder(UP_FOLDER_NAME);
  props.setProperty('UP_FOLDER_ID', f.getId());
  return f;
}
const safeName_ = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

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
  const tag = user.id + '|' + kind + '|' + key, folder = uploadFolder_();
  // 같은 칸의 예전 파일은 휴지통으로 (이름을 바꿨을 수도 있으니 설명으로 찾습니다)
  const old = folder.getFiles();
  while (old.hasNext()) { const f = old.next(); if (String(f.getDescription() || '') === tag) f.setTrashed(true); }
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, fname));
  file.setDescription(tag);
  return { file: { id: file.getId(), name: fname, url: file.getUrl(), at: Date.now(), size: file.getSize() } };
}

/** id 파일이 탐구자료 폴더에 있고 ownerId 학생의 것인지 확인한 뒤 돌려줍니다. */
function ownFile_(id, ownerId) {
  let f; try { f = DriveApp.getFileById(String(id || '')); } catch (e) { fail_('NOT_FOUND'); }
  if (f.isTrashed() || String(f.getDescription() || '').split('|')[0] !== String(ownerId)) fail_('FORBIDDEN');
  const up = uploadFolder_().getId(), ps = f.getParents(); let inside = false;
  while (ps.hasNext()) if (ps.next().getId() === up) inside = true;
  if (!inside) fail_('FORBIDDEN');
  return f;
}
/** 풀이 사진 미리보기용. 학생은 자기 것, 교사는 p.owner 학생 것. */
function apiGetFile_(user, p) {
  const owner = user.role === 'teacher' && p.owner ? String(p.owner) : user.id;
  const f = ownFile_(p.id, owner), blob = f.getBlob();
  if (f.getSize() > 300000) fail_('BIG_FILE');
  return { b64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() };
}
