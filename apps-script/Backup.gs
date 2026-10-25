/**
 * 하루 한 번 기록 스프레드시트(설정·계정·기록·채점·문서 시트) 전체를 백업 폴더에 사본으로 남깁니다.
 * 처음 한 번: 소유자가 편집기에서 installBackup 을 실행해 권한을 허용합니다(매일 새벽 3시쯤 트리거 + 첫 백업).
 * 백업 폴더는 소유자만 봅니다(비밀번호 해시가 들어 있으므로 다른 교사에게 공유하지 않습니다).
 * 원본 시트는 읽기만 하고, 학생 사진·탐구자료 파일은 복사하지 않습니다(시트에는 파일 ID만 있음).
 */
const BACKUP_FOLDER_NAME = '모델링탐구_백업';
const BACKUP_PREFIX = '백업_';
const BACKUP_KEEP_DAYS = 7;   // 이보다 오래된 사본은 휴지통으로(휴지통에서 30일 동안 되살릴 수 있음)
const BACKUP_HOUR = 3;        // 매일 이 시각쯤(Asia/Seoul) 실행

function backupFolder_(create) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  if (!create) return null;
  const f = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  props.setProperties({ BACKUP_FOLDER_ID: f.getId(), BACKUP_FOLDER_URL: f.getUrl() });
  return f;
}

/** 지금 바로 사본을 하나 만들고, 오래된 사본을 정리합니다. 트리거·시트 메뉴·교사 대시보드가 부릅니다. */
function backupNow() {
  const props = PropertiesService.getScriptProperties();
  try {
    const folder = backupFolder_(true), ss = SpreadsheetApp.getActive();
    const name = BACKUP_PREFIX + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    const copy = DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
    const cut = Date.now() - BACKUP_KEEP_DAYS * 86400000;
    let removed = 0;
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getId() !== copy.getId() && f.getName().indexOf(BACKUP_PREFIX) === 0 && f.getDateCreated().getTime() < cut) { f.setTrashed(true); removed++; }
    }
    props.setProperties({ BACKUP_LAST: String(Date.now()), BACKUP_LAST_NAME: name, BACKUP_LAST_URL: copy.getUrl(), BACKUP_ERR: '' });
    return { name: name, url: copy.getUrl(), removed: removed };
  } catch (e) {
    props.setProperty('BACKUP_ERR', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ' ' + String(e && e.message || e).slice(0, 300));
    throw e;
  }
}

/** 소유자가 편집기(또는 시트 메뉴)에서 한 번 실행: 매일 백업 트리거를 (다시) 설치하고 첫 백업을 만듭니다. */
function installBackup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'backupNow') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(BACKUP_HOUR).inTimezone(Session.getScriptTimeZone()).create();
  const r = backupNow();
  const msg = '매일 백업을 설치했습니다(새벽 ' + BACKUP_HOUR + '시쯤, 최근 ' + BACKUP_KEEP_DAYS + '일 보관).\n\n첫 백업: ' + r.name + '\n백업 폴더: ' + backupFolder_(false).getUrl();
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}
function backupMenu_() {
  const r = backupNow();
  SpreadsheetApp.getUi().alert('백업했습니다: ' + r.name + (r.removed ? '\n오래된 사본 ' + r.removed + '개를 휴지통으로 옮겼습니다.' : ''));
}

/** 교사 대시보드용 상태(driveInfo 에 함께 실어 보냅니다). 실패해도 다른 정보는 보이게 오류를 삼킵니다. */
function backupInfo_() {
  const props = PropertiesService.getScriptProperties();
  let trigger = null;
  try { trigger = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backupNow'); } catch (e) {}  // 권한 허용 전에는 알 수 없음(null)
  let count = 0;
  const f = backupFolder_(false);
  if (f) { try { const it = f.getFiles(); while (it.hasNext()) if (it.next().getName().indexOf(BACKUP_PREFIX) === 0) count++; } catch (e) {} }
  return {
    folderUrl: f ? f.getUrl() : '', last: Number(props.getProperty('BACKUP_LAST') || 0), lastName: props.getProperty('BACKUP_LAST_NAME') || '',
    err: props.getProperty('BACKUP_ERR') || '', trigger: trigger, count: count, keepDays: BACKUP_KEEP_DAYS, hour: BACKUP_HOUR
  };
}
function apiBackupNow_() {
  const c = CacheService.getScriptCache();
  if (c.get('bk_busy')) fail_('BUSY');  // 연달아 누르면 사본이 여러 개 생기지 않게 1분 막음
  c.put('bk_busy', '1', 60);
  const r = backupNow();
  return { made: r, backup: backupInfo_() };
}
