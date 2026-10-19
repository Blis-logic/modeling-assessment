/**
 * 수식: 구글 문서에 수식 그림 넣기. (손글씨 기호 인식은 화면 쪽 mathtool.js가 기기 안에서 합니다)
 * 학생 칸에는 수식이 $LaTeX$ 로 저장됩니다. 화면이 수식마다 그림(PNG)을 만들어 spec.math 로 보내면,
 * 문서에는 그 그림을 글자 사이에 끼워 넣고, 그림의 대체 텍스트에 LaTeX 원문을 남깁니다.
 */
const MATH_RE = /\$([^$\n]+?)\$/g;

/* ───── 문서: 글자 사이에 수식 그림 끼워 넣기 ───── */
function hasMath_(s) { MATH_RE.lastIndex = 0; return MATH_RE.test(String(s || '')); }

/** par(문단)의 내용을 text로 바꿉니다. $수식$ 은 그림으로, 나머지는 attrs 서식의 글자로 넣습니다. */
function fillRich_(par, text, attrs, math, images, size) {
  par.setText('');
  const s = String(text == null ? '' : text), k = (size || 10) / 10;
  const addText = t => { if (t) par.appendText(t).setAttributes(attrs); };
  let last = 0, m;
  MATH_RE.lastIndex = 0;
  while ((m = MATH_RE.exec(s))) {
    addText(s.slice(last, m.index));
    const tex = m[1].trim(), f = math && math[tex], b64 = f && images[f.i];
    if (b64) {
      try {
        const img = par.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', 'formula.png'));
        img.setWidth(Math.max(1, Math.round(f.w * k))).setHeight(Math.max(1, Math.round(f.h * k)));
        img.setAltTitle('LaTeX').setAltDescription(tex);
      } catch (e) { addText(m[0]); }
    } else addText(m[0]);   // 그림이 없으면 LaTeX 글자 그대로 남깁니다
    last = MATH_RE.lastIndex;
  }
  addText(s.slice(last));
  if (!par.getNumChildren()) par.appendText(' ').setAttributes(attrs);
}

/** 표 칸: 줄마다 문단을 만들고 수식을 그림으로 넣습니다. */
function fillRichCell_(cell, text, attrs, math, images, size) {
  const lines = String(text == null ? '' : text).split('\n');
  const first = cell.getChild(0).asParagraph();
  while (cell.getNumChildren() > 1) cell.removeChild(cell.getChild(1));
  lines.forEach((line, i) => fillRich_(i === 0 ? first : cell.appendParagraph(''), line, attrs, math, images, size));
}
