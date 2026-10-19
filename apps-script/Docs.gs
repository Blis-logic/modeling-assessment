/**
 * 학생 결과물을 활동지 서식의 구글 문서로 만들어 교사 공유 폴더에 저장하고, PDF로 내보냅니다.
 * 화면(index.html)이 활동지 내용을 "문서 명세(spec)"로 만들어 보내면, 여기서는 명세를 그대로 그립니다.
 * 활동지 문항이 바뀌어도 이 파일은 고칠 필요가 없습니다.
 */
const C_INK = '#18272B', C_ACCENT = '#0E6874', C_SOFT = '#E1EFF0', C_LABEL = '#EEF2F1', C_FILL = '#FFF7D1', C_LINE = '#D5DEDC', C_MUTED = '#5A6B6F';
const DOC_FONT = 'Nanum Gothic';

/* ───── 공유 폴더 ───── */
/** 폴더가 없으면 만들고, 이미 가입한 교사(이메일이 있는 계정)에게 편집 권한을 줍니다. withLock_ 안에서 부르지 마세요. */
function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const find = () => {
    const id = props.getProperty('FOLDER_ID'); if (!id) return null;
    try { const f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
  };
  const have = find(); if (have) return have;
  return withLock_(() => {
    const again = find(); if (again) return again;
    const f = DriveApp.createFolder(FOLDER_NAME);
    props.setProperties({ FOLDER_ID: f.getId(), FOLDER_URL: f.getUrl() });
    sheet_(SHEETS.acc).getDataRange().getValues().slice(1).forEach(r => {
      const em = String(r[9] || '').trim();
      if (String(r[1]) === 'teacher' && validEmail_(em)) { try { f.addEditor(em); } catch (e) {} }
    });
    return f;
  });
}
function apiDriveInfo_() {
  const f = rootFolder_();
  let owner = ''; try { owner = f.getOwner().getEmail(); } catch (e) {}
  const teachers = sheet_(SHEETS.acc).getDataRange().getValues().slice(1).filter(r => r[0] && String(r[1]) === 'teacher')
    .map(r => ({ id: String(r[0]), name: String(r[3]), email: String(r[9] || '') }));
  return { url: f.getUrl(), owner: owner, editors: f.getEditors().map(u => u.getEmail()), teachers: teachers };
}
/** 교사가 다른 교사(또는 내 다른 구글 계정)를 공유 폴더에 초대합니다. self:true 이면 내 계정의 이메일로도 기록합니다. */
function apiShareFolder_(user, p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!validEmail_(email)) fail_('BAD_EMAIL');
  try { rootFolder_().addEditor(email); } catch (e) { fail_('SHARE'); }
  if (p.self) withLock_(() => { const sh = sheet_(SHEETS.acc), row = findRow_(sh, user.id); if (row > 0) sh.getRange(row, 10).setValue(email); });
  return apiDriveInfo_();
}

/* ───── 문서 기록(문서 시트) ───── */
function docFromRow_(r) { return { docId: String(r[3] || ''), url: String(r[4] || ''), at: r[5] ? new Date(r[5]).getTime() : 0, hash: String(r[6] || '') }; }
function docRecord_(id) {
  const sh = sheet_(SHEETS.doc), row = findRow_(sh, id); if (row < 0) return null;
  const d = docFromRow_(sh.getRange(row, 1, 1, DOC_HEAD.length).getValues()[0]); d.row = row; return d;
}
function docMap_() {
  const out = {};
  sheet_(SHEETS.doc).getDataRange().getValues().slice(1).forEach(r => { if (r[0] && r[3]) { const d = docFromRow_(r); out[String(r[0])] = { url: d.url, at: d.at }; } });
  return out;
}

/* ───── 요청 ───── */
/** 학생은 자기 문서만, 교사는 p.id 학생의 문서를 다룹니다. */
function docTarget_(user, p) {
  const id = p.id && String(p.id) !== user.id ? String(p.id) : user.id;
  if (id !== user.id && user.role !== 'teacher') fail_('FORBIDDEN');
  const acc = sheet_(SHEETS.acc), row = findRow_(acc, id);
  if (row < 0) fail_('NOT_FOUND');
  if (String(acc.getRange(row, 2).getValue()) === 'teacher') fail_('FORBIDDEN');  // 문서는 학생 것만 만듭니다
  return id;
}
function checkSpec_(p) {
  const spec = p.spec, images = Array.isArray(p.images) ? p.images : [];
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.stages)) fail_('BAD_DOC');
  if (JSON.stringify(spec).length > 600000 || images.length > 200 || images.some(s => typeof s !== 'string' || s.length > 2000000) || images.reduce((n, s) => n + s.length, 0) > 25000000) fail_('BAD_DOC');
  return { spec: spec, images: images };
}
function apiSyncDoc_(user, p) {
  const id = docTarget_(user, p), c = checkSpec_(p), r = buildDoc_(id, c.spec, c.images);
  return { docAt: r.at, url: r.url, skipped: r.skipped };
}
function apiPdf_(user, p) {
  const id = docTarget_(user, p), c = checkSpec_(p), r = buildDoc_(id, c.spec, c.images);
  const blob = DriveApp.getFileById(r.docId).getAs(MimeType.PDF);
  return { b64: Utilities.base64Encode(blob.getBytes()), docAt: r.at };
}
function md5_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s), Utilities.Charset.UTF_8)); }

/** 내용이 바뀐 경우에만 문서를 새로 그립니다. 같은 학생 문서를 동시에 그리지 않도록 화면에서 한 번에 하나씩 보냅니다. */
function buildDoc_(id, spec, images) {
  const info = spec.info || {};
  const name = (String(info.sid || '') + ' ' + String(info.name || id) + ' 모델링 탐구 보고서').trim().slice(0, 120);
  const hash = md5_(JSON.stringify(spec) + '|' + images.map(md5_).join(','));
  const folder = studentFolder_(id);   // [학번_이름] 폴더
  const rec = withLock_(() => {
    const sh = sheet_(SHEETS.doc); let row = findRow_(sh, id);
    if (row > 0) {
      const d = docFromRow_(sh.getRange(row, 1, 1, DOC_HEAD.length).getValues()[0]);
      let alive = false; if (d.docId) { try { alive = !DriveApp.getFileById(d.docId).isTrashed(); } catch (e) {} }
      if (alive) return d;
    }
    const doc = DocumentApp.create(name);
    DriveApp.getFileById(doc.getId()).moveTo(folder);
    const vals = [id, String(info.sid || ''), String(info.name || ''), doc.getId(), doc.getUrl(), '', ''];
    if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    return { docId: doc.getId(), url: doc.getUrl(), at: 0, hash: '' };
  });
  try { const f = DriveApp.getFileById(rec.docId); if (!inFolder_(f, folder)) f.moveTo(folder); } catch (e) {}  // 예전 문서도 학생 폴더로
  if (rec.hash === hash) return { docId: rec.docId, url: rec.url, at: rec.at, skipped: true };
  const doc = DocumentApp.openById(rec.docId);
  if (doc.getName() !== name) doc.setName(name);
  renderSpec_(doc, spec, images, id);
  doc.saveAndClose();
  const at = Date.now();
  withLock_(() => {
    const sh = sheet_(SHEETS.doc), row = findRow_(sh, id);
    if (row > 0) { sh.getRange(row, 2, 1, 2).setValues([[String(info.sid || ''), String(info.name || '')]]); sh.getRange(row, 6, 1, 2).setValues([[new Date(at), hash]]); }
  });
  return { docId: rec.docId, url: rec.url, at: at, skipped: false };
}

/* ───── 활동지 서식으로 그리기 ───── */
function renderSpec_(doc, spec, images, ownerId) {
  const A = DocumentApp.Attribute, body = doc.getBody(), math = spec.math || {};
  body.clear();
  body.setPageWidth(595).setPageHeight(842).setMarginTop(40).setMarginBottom(40).setMarginLeft(40).setMarginRight(40);
  const txt = (o) => {
    const a = {}; a[A.FONT_FAMILY] = DOC_FONT; a[A.FONT_SIZE] = o.size || 10; a[A.BOLD] = !!o.bold; a[A.FOREGROUND_COLOR] = o.color || C_INK; return a;
  };
  const para = (text, o) => {
    o = o || {};
    const p = body.appendParagraph(String(text == null ? '' : text) || ' ');
    p.setHeading(DocumentApp.ParagraphHeading.NORMAL).setSpacingBefore(o.before || 0).setSpacingAfter(o.after == null ? 2 : o.after).setLineSpacing(1.15);
    p.setAttributes(txt(o));
    if (hasMath_(text)) fillRich_(p, String(text).replace(/\n/g, ' '), txt(o), math, images, o.size);  // 수식은 그림으로
    return p;
  };
  const cellStyle = (cell, o) => {
    const a = txt(o); a[A.PADDING_TOP] = 3; a[A.PADDING_BOTTOM] = 3; a[A.PADDING_LEFT] = 5; a[A.PADDING_RIGHT] = 5;
    if (o.bg) a[A.BACKGROUND_COLOR] = o.bg;
    cell.setAttributes(a);
  };
  const widths = (n, w0) => { const out = [w0]; for (let i = 1; i < n; i++) out.push((PAGE_W - w0) / (n - 1)); return out; };
  /** grid: 문자열 2차원 배열. look(r,c) → {bg,bold,size,color}. */
  const grid = (rows, w, look, minH) => {
    const t = body.appendTable(rows.map(r => r.map(v => v == null ? '' : String(v))));
    t.setBorderColor(C_LINE).setBorderWidth(0.75);
    w.forEach((x, i) => t.setColumnWidth(i, x));
    rows.forEach((r, ri) => {
      const tr = t.getRow(ri); if (minH) tr.setMinimumHeight(minH);
      r.forEach((v, ci) => {
        const cell = tr.getCell(ci), lk = look(ri, ci); cellStyle(cell, lk);
        if (hasMath_(v)) fillRichCell_(cell, v, txt(lk), math, images, lk.size);  // 수식은 그림으로
      });
    });
    para(' ', { size: 3, after: 0 });
    return t;
  };
  const bannerCell = (lines, bg, widthTotal) => {
    const t = body.appendTable([[String(lines[0].t)]]);
    t.setBorderColor(C_LINE).setBorderWidth(0.75).setColumnWidth(0, widthTotal);
    const cell = t.getRow(0).getCell(0);
    cell.setBackgroundColor(bg).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(10).setPaddingRight(10);
    lines.forEach((l, i) => {
      const p = i === 0 ? cell.getChild(0).asParagraph() : cell.appendParagraph(String(l.t));
      p.setAttributes(txt(l)); p.setSpacingAfter(2);
    });
    para(' ', { size: 4, after: 0 });
  };

  // 표지
  const head = (spec.header || []).slice(0, 3);
  if (head.length) bannerCell([{ t: head[0], size: 9, color: '#FFFFFF' }, { t: head[1] || '', size: 18, bold: true, color: '#FFFFFF' }, { t: head[2] || '', size: 10, color: '#FFFFFF' }].filter(l => l.t !== ''), C_ACCENT, PAGE_W);
  const i = spec.info || {};
  grid([['학번', i.sid || '', '이름', i.name || '', '탐구 제목', i.title || '']], [45, 70, 45, 95, 60, PAGE_W - 315],
    (r, c) => c % 2 === 0 ? { bg: C_LABEL, bold: true, size: 9.5 } : { bg: C_FILL, size: 10 }, 24);
  if (spec.intro) para(spec.intro, { size: 10, after: 4 });
  if (spec.standards) para(spec.standards, { size: 9, color: C_MUTED, after: 6 });

  (spec.stages || []).forEach((st, si) => {
    if (si > 0) body.appendPageBreak();
    bannerCell([{ t: st.name, size: 14, bold: true }, { t: st.meta || '', size: 9, color: C_MUTED }, { t: st.goal ? '목표  ' + st.goal : '', size: 10 }].filter(l => l.t !== ''), C_SOFT, PAGE_W);
    (st.blocks || []).forEach(b => {
      if (b.title) para((b.no ? b.no + '  ' : '') + (b.star ? '★ ' : '') + b.title, { size: 11, bold: true, color: C_ACCENT, before: 8, after: 2 });
      if (b.hint) para(b.hint, { size: 8.5, color: C_MUTED, after: 3 });
      (b.parts || []).forEach(pt => {
        if (pt.t === 'fields') {
          const rows = pt.rows.map(r => [r[0], r[1]]);
          grid(rows, [150, PAGE_W - 150], (r, c) => c === 0 ? { bg: C_LABEL, bold: true, size: 9.5 } : { bg: pt.auto ? '#FFFFFF' : C_FILL, size: 10 }, pt.auto ? 0 : 22);
        } else if (pt.t === 'table') {
          const rows = [pt.cols].concat(pt.rows), n = pt.cols.length, w0 = n <= 3 ? 150 : n <= 5 ? 110 : 90;
          const fill = new Set(pt.fill || []);
          grid(rows, widths(n, w0), (r, c) => r === 0 ? { bg: C_LABEL, bold: true, size: 9 } : c === 0 ? { bg: C_LABEL, bold: true, size: 9 } : { bg: fill.has(c) ? C_FILL : '#FFFFFF', size: n > 5 ? 8.5 : 10 }, pt.fill && pt.fill.length ? 22 : 0);
        } else if (pt.t === 'photo') {  // 학생이 올린 풀이 사진 (탐구자료 폴더, 주인 확인)
          try {
            const blob = ownFile_(pt.id, ownerId).getBlob(), p = body.appendParagraph(' ');
            p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(2);
            const img = p.appendInlineImage(blob), k = Math.min(1, 420 / img.getWidth(), 360 / img.getHeight());
            img.setWidth(Math.round(img.getWidth() * k)).setHeight(Math.round(img.getHeight() * k));
            if (pt.caption) { const c = para(pt.caption, { size: 8.5, color: C_MUTED, after: 4 }); c.setAlignment(DocumentApp.HorizontalAlignment.CENTER); }
          } catch (e) { para('(풀이 사진을 불러오지 못했습니다)', { size: 9, color: C_MUTED, after: 4 }); }
        } else if (pt.t === 'image') {
          const b64 = images[pt.i];
          if (b64) {
            const p = body.appendParagraph(' '); p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(2);
            const img = p.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', 'graph.png'));
            img.setWidth(440).setHeight(220);
            if (pt.caption) { const c = para(pt.caption, { size: 8.5, color: C_MUTED, after: 4 }); c.setAlignment(DocumentApp.HorizontalAlignment.CENTER); }
          } else para('(그래프를 그릴 자료가 아직 없습니다)', { size: 9, color: C_MUTED, after: 4 });
        }
      });
      if (b.check) {
        para(b.check, { size: 11, bold: true, color: C_ACCENT, before: 8, after: 2 });
        (b.items || []).forEach(it => para((it[1] ? '■  ' : '□  ') + it[0], { size: 10, after: 1 }));
      }
    });
  });
}
