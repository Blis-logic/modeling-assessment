/**
 * 수식: 손글씨 인식(Claude API)과 구글 문서에 수식 그림 넣기.
 * 학생 칸에는 수식이 $LaTeX$ 로 저장됩니다. 화면이 수식마다 그림(PNG)을 만들어 spec.math 로 보내면,
 * 문서에는 그 그림을 글자 사이에 끼워 넣고, 그림의 대체 텍스트에 LaTeX 원문을 남깁니다.
 */
const AI_KEY_PROP = 'ANTHROPIC_API_KEY';
const AI_MODEL = 'claude-opus-5-5';
const HW_LIMIT = 20;                    // 학생 한 명이 10분에 쓸 수 있는 손글씨 인식 횟수
const MATH_RE = /\$([^$\n]+?)\$/g;

/* ───── 교사: API 키 저장·삭제 (스크립트 속성에만 보관, 화면에 돌려주지 않음) ───── */
function apiSetAiKey_(user, p) {
  const key = String(p.key || '').trim(), props = PropertiesService.getScriptProperties();
  if (!key) props.deleteProperty(AI_KEY_PROP);
  else {
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) fail_('BAD_KEY');
    props.setProperty(AI_KEY_PROP, key);
  }
  return { config: publicConfig_() };
}

/* ───── 손글씨 그림(PNG base64) → LaTeX ───── */
function apiRecognize_(user, p) {
  const key = PropertiesService.getScriptProperties().getProperty(AI_KEY_PROP);
  if (!key) fail_('NO_AI');
  const img = String(p.image || '');
  if (!img || img.length > 3000000 || !/^[A-Za-z0-9+/=]+$/.test(img)) fail_('BAD_IMAGE');
  const cache = CacheService.getScriptCache(), ck = 'hw_' + user.id, used = Number(cache.get(ck) || 0);
  if (used >= HW_LIMIT) fail_('AI_BUSY');
  cache.put(ck, String(used + 1), 600);

  const body = {
    model: AI_MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    fallbacks: 'default',
    system: 'You transcribe handwritten mathematics into LaTeX for a Korean high-school calculus and trigonometry class. ' +
      'Reply with the LaTeX only: no $ signs, no \\[ \\], no code fences, no explanation. ' +
      'Use standard commands (\\frac, \\sqrt, \\sin, \\cos, \\tan, \\sec, \\csc, \\cot, \\arctan, \\ln, \\int_{a}^{b}, \\lim_{x\\to a}, f\'(x)). ' +
      'If there are several lines, join them with \\\\ . If nothing readable is written, reply with an empty string.',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
      { type: 'text', text: 'Transcribe this handwritten math into LaTeX.' }
    ] }]
  };
  let res;
  try {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' }
    });
  } catch (e) { fail_('AI_FAIL'); }
  if (res.getResponseCode() !== 200) { Logger.log('손글씨 인식 실패 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300)); fail_('AI_FAIL'); }
  const j = JSON.parse(res.getContentText());
  if (j.stop_reason === 'refusal') fail_('AI_FAIL');
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return { latex: cleanLatex_(text) };
}
function cleanLatex_(s) {
  s = String(s || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  s = s.replace(/^\$\$?|\$\$?$/g, '').replace(/^\\\[|\\\]$/g, '').replace(/^\\\(|\\\)$/g, '').trim();
  return s.replace(/\$/g, '').slice(0, 1000);
}

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
