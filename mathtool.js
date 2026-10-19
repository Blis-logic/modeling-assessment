/* 수식 입력기: 수식 키보드(MathLive) · 손글씨 인식 · 수식 미리보기 · 문서용 수식 그림(MathJax SVG)
 * 활동지 칸에는 수식이 $LaTeX$ 형태로 저장됩니다. 화면은 이 표기를 찾아 수식으로 그려 보여 줍니다.
 * 손글씨 판은 "기호 그리기"입니다. 그린 모양을 여러 글꼴로 그린 기호 견본과 비교해 비슷한 기호를 찾습니다(인터넷·AI 없이 이 기기 안에서).
 * window.MathTool.open(field, {index, mode}) / render(text) / renderInto(el, text) / toImages(latexList)
 */
(function () {
  "use strict";
  const ML_VER = "0.110.0", MJ_VER = "3.2.2";
  const ML_BASE = `https://cdn.jsdelivr.net/npm/mathlive@${ML_VER}/`;
  const MJ_URL = `https://cdn.jsdelivr.net/npm/mathjax@${MJ_VER}/es5/tex-svg.js`;
  const TOKEN = /\$([^$\n]+?)\$/g;

  /* ───── 라이브러리 불러오기 (필요할 때 한 번만) ───── */
  const loaded = {};
  function loadScript(url) {
    if (!loaded[url]) loaded[url] = new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = () => { delete loaded[url]; no(new Error("수식 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.")); };
      document.head.appendChild(s);
    });
    return loaded[url];
  }
  function loadCss(url) { if (document.querySelector(`link[href="${url}"]`)) return; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = url; document.head.appendChild(l); }
  function loadMathLive() {
    loadCss(ML_BASE + "mathlive-static.css"); loadCss(ML_BASE + "mathlive-fonts.css");
    return loadScript(ML_BASE + "mathlive.min.js").then(() => window.MathLive);
  }
  function loadMathJax() {
    if (!window.MathJax || !window.MathJax.tex2svgPromise) {
      if (!window.MathJax) window.MathJax = { startup: { typeset: false }, svg: { fontCache: "none" }, tex: { packages: { "[+]": ["ams"] } } };
    }
    return loadScript(MJ_URL).then(() => window.MathJax.startup.promise).then(() => window.MathJax);
  }

  /* ───── 글 속 $수식$ 찾기 ───── */
  function tokens(text) { const out = []; String(text || "").replace(TOKEN, (m, tex, at) => { out.push({ tex: tex.trim(), start: at, end: at + m.length }); return m; }); return out; }
  function hasMath(text) { TOKEN.lastIndex = 0; return TOKEN.test(String(text || "")); }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** 글을 HTML로 바꿉니다. 수식은 MathLive가 이미 불러와져 있을 때만 그림으로, 아니면 글자로 둡니다. */
  function render(text) {
    const ML = window.MathLive; let out = "", last = 0; const s = String(text || "");
    tokens(s).forEach((t, i) => {
      out += esc(s.slice(last, t.start));
      let m = ""; try { m = ML ? ML.convertLatexToMarkup(t.tex) : ""; } catch (e) { m = ""; }
      out += `<span class="mt-f" data-mt="${i}" title="${esc(t.tex)}">${m || esc(t.tex)}</span>`;
      last = t.end;
    });
    return out + esc(s.slice(last));
  }
  function renderInto(el, text) {
    if (!el) return;
    if (!hasMath(text)) { el.textContent = text || ""; return; }
    el.innerHTML = render(text);
    if (!window.MathLive) loadMathLive().then(() => { if (el.isConnected) el.innerHTML = render(text); }).catch(() => {});
  }

  /* ───── 문서용 수식 그림: LaTeX → PNG(base64). 크기는 10pt 글자 기준 픽셀(96dpi) ───── */
  const EX_PX = 6.67, SCALE = 4;
  async function toImages(list, color) {
    const uniq = [...new Set(list.filter(Boolean))]; const out = {};
    if (!uniq.length) return out;
    const MJ = await loadMathJax();
    for (const tex of uniq) {
      try {
        const node = await MJ.tex2svgPromise(tex, { display: false });
        const svg = node.querySelector("svg"); if (!svg || node.querySelector("[data-mjx-error]")) continue;
        const wEx = parseFloat(svg.getAttribute("width")), hEx = parseFloat(svg.getAttribute("height"));
        if (!(wEx > 0 && hEx > 0)) continue;
        svg.setAttribute("color", color || "#18272B"); svg.style.color = color || "#18272B";
        const W = Math.ceil(wEx * EX_PX * SCALE), H = Math.ceil(hEx * EX_PX * SCALE);
        svg.setAttribute("width", W); svg.setAttribute("height", H);
        const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
        const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, W, H);
        out[tex] = { b64: cv.toDataURL("image/png").split(",")[1], w: +(wEx * EX_PX).toFixed(1), h: +(hEx * EX_PX).toFixed(1) };
      } catch (e) { /* 그리지 못한 수식은 문서에 글자로 남습니다 */ }
    }
    return out;
  }

  /* ───── 수식 키보드 배치 (mathkeyboards.com 처럼 갈래별 탭) ───── */
  // [보이는 글자, 넣을 LaTeX, 넓이(선택)]  #0·#? = 빈칸, #@ = 앞의 식을 감싸기
  const KEYS = {
    "기본": [
      ["a/b", "\\frac{#@}{#?}"], ["x²", "#@^2"], ["xⁿ", "#@^{#?}"], ["xₙ", "#@_{#?}"], ["√", "\\sqrt{#0}"], ["ⁿ√", "\\sqrt[#?]{#0}"],
      ["( )", "\\left(#0\\right)"], ["|x|", "\\left|#0\\right|"], ["[ ]", "\\left[#0\\right]"], ["π", "\\pi"], ["∞", "\\infty"], ["°", "^{\\circ}"],
      ["+", "+"], ["−", "-"], ["×", "\\times"], ["÷", "\\div"], ["·", "\\cdot"], ["±", "\\pm"],
      ["=", "="], ["≠", "\\ne"], ["≈", "\\approx"], ["<", "<"], [">", ">"], ["≤", "\\le"], ["≥", "\\ge"], ["%", "\\%"]
    ],
    "삼각함수": [
      ["sin", "\\sin"], ["cos", "\\cos"], ["tan", "\\tan"], ["sec", "\\sec"], ["csc", "\\csc"], ["cot", "\\cot"],
      ["sin²", "\\sin^2"], ["cos²", "\\cos^2"], ["sec²", "\\sec^2"], ["arctan", "\\arctan"], ["sin⁻¹", "\\sin^{-1}"], ["tan⁻¹", "\\tan^{-1}"],
      ["θ", "\\theta"], ["φ", "\\varphi"], ["α", "\\alpha"], ["β", "\\beta"], ["ω", "\\omega"], ["π", "\\pi"],
      ["sin(u+φ)", "\\sin\\left(#0+\\varphi\\right)", 2], ["2 sin u cos u", "2\\sin u\\cos u", 2], ["R=√(a²+e²)", "R=\\sqrt{a^2+e^2}", 2]
    ],
    "미적분": [
      ["f(x)", "f(x)"], ["f′(x)", "f'(x)"], ["f″(x)", "f''(x)"], ["dy/dx", "\\frac{dy}{dx}"], ["d/dx", "\\frac{d}{dx}"], ["′", "'"],
      ["lim", "\\lim_{#?\\to#?}"], ["→", "\\to"], ["∫", "\\int #0\\,dx"], ["∫ₐᵇ", "\\int_{#?}^{#?}#0\\,dx"], ["[F]ₐᵇ", "\\left[#0\\right]_{#?}^{#?}"], ["dx", "\\,dx"],
      ["ln", "\\ln"], ["log", "\\log"], ["eˣ", "e^{#0}"], ["Σ", "\\sum_{#?}^{#?}"], ["Δ", "\\Delta"], ["|  |", "\\left|#0\\right|"],
      ["평균값", "\\frac{1}{q-p}\\int_{p}^{q}f(x)\\,dx", 3], ["u=b(x−c)", "u=b(x-c)", 2], ["du/dx=b", "\\frac{du}{dx}=b", 1]
    ],
    "모델 식": [
      ["a sin(b(x−c))+d", "a\\sin\\left(b(x-c)\\right)+d", 3], ["a cos(b(x−c))+d", "a\\cos\\left(b(x-c)\\right)+d", 3],
      ["a tan(b(x−c))+d", "a\\tan\\left(b(x-c)\\right)+d", 3], ["a sec(b(x−c))+d", "a\\sec\\left(b(x-c)\\right)+d", 3],
      ["a csc(b(x−c))+d", "a\\csc\\left(b(x-c)\\right)+d", 3], ["a arctan(b(x−c))+d", "a\\arctan\\left(b(x-c)\\right)+d", 3],
      ["a sin u + e cos u", "a\\sin u+e\\cos u", 3], ["a sin u + e sin 2u", "a\\sin u+e\\sin 2u", 3],
      ["a sin²u + d", "a\\sin^2 u+d", 3], ["오차율", "\\frac{\\left|y-f(x)\\right|}{\\left|y\\right|}\\times100", 3]
    ],
    "문자·기호": [
      ["x", "x"], ["y", "y"], ["a", "a"], ["b", "b"], ["c", "c"], ["d", "d"], ["e", "e"], ["g", "g"], ["p", "p"], ["q", "q"], ["t", "t"], ["u", "u"],
      ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["λ", "\\lambda"], ["μ", "\\mu"], ["σ", "\\sigma"], ["Ω", "\\Omega"],
      ["∴", "\\therefore"], ["∵", "\\because"], ["⇒", "\\Rightarrow"], ["⇔", "\\Leftrightarrow"], ["∈", "\\in"], ["글자", "\\text{#0}"]
    ],
    "숫자": [
      ["7", "7"], ["8", "8"], ["9", "9"], ["÷", "\\div"], ["(", "("], [")", ")"],
      ["4", "4"], ["5", "5"], ["6", "6"], ["×", "\\times"], ["x", "x"], ["y", "y"],
      ["1", "1"], ["2", "2"], ["3", "3"], ["−", "-"], ["a/b", "\\frac{#@}{#?}"], ["x²", "#@^2"],
      ["0", "0"], [".", "."], [",", ","], ["+", "+"], ["=", "="], ["π", "\\pi"]
    ]
  };
  const NAV = [["←", "moveToPreviousChar"], ["→", "moveToNextChar"], ["⌫", "deleteBackward"], ["되돌리기", "undo"], ["모두 지우기", "clear"]];

  /* ───── 화면 스타일 ───── */
  const CSS = `
.mt-btn{flex:none;align-self:stretch;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:0;border-right:1px solid var(--line);background:var(--paper);color:var(--accent);font:600 13px/1 var(--f-body);padding:0 10px;cursor:pointer;min-width:44px}
.mt-btn:hover{background:var(--accent-soft)}
.mt-wrap{display:flex;align-items:stretch;min-width:0;container-type:inline-size}
.mt-ico,.mt-btn svg{width:20px;height:20px;flex:none}
/* 칸이 좁으면(표 안, 휴대폰) 글자를 숨기고 아이콘만 */
@container (max-width:330px){.mt-btn span{display:none}.mt-btn{min-width:40px;padding:0 8px}}
@media (pointer:coarse){.mt-btn{min-width:46px}}
.mt-wrap>.fld,.mt-wrap>input,.mt-wrap>textarea{flex:1 1 auto;min-width:0}
.mt-prev{padding:6px 10px;border-top:1px dashed var(--fill-line);background:var(--paper);font-size:15px;line-height:1.9;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.mt-prev:empty{display:none}
.mt-prev .mt-f{cursor:pointer;border-radius:4px;padding:0 2px}
.mt-prev .mt-f:hover{background:var(--accent-soft)}
.ro .mt-f{padding:0 1px}
.mt-dlg{position:fixed;inset:0;z-index:50;background:rgba(10,20,22,.45);display:flex;align-items:flex-end;justify-content:center}
@media (min-width:720px){.mt-dlg{align-items:center}}
.mt-box{background:var(--paper);color:var(--ink);width:min(760px,100%);max-height:96dvh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}
@media (min-width:720px){.mt-box{border-radius:16px}}
.mt-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.mt-head b{font-size:16px;margin-right:auto}
.mt-modes{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:2px}
.mt-modes button{border:0;background:transparent;border-radius:999px;padding:5px 14px;font-size:13px;color:var(--muted);cursor:pointer}
.mt-modes button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.mt-x{border:0;background:none;font-size:22px;line-height:1;color:var(--muted);cursor:pointer;padding:4px 6px}
.mt-body{padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overflow-x:hidden}
.mt-box *,.mt-box *::before,.mt-box *::after{box-sizing:border-box}
.mt-field{display:block;box-sizing:border-box;width:100%;font-size:24px;padding:10px 12px;border:2px solid var(--accent);border-radius:10px;background:var(--fill);min-height:60px;--caret-color:var(--accent);--selection-background-color:var(--accent-soft);--placeholder-color:var(--muted)}
.mt-field::part(menu-toggle),.mt-field::part(virtual-keyboard-toggle){display:none}
.mt-src{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted)}
.mt-src input{flex:1;min-width:0;font-family:var(--f-mono);font-size:12px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;background:var(--bg);color:var(--ink)}
.mt-cats{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px}
.mt-cats button{flex:none;border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:4px 12px;font-size:13px;cursor:pointer;color:var(--ink)}
.mt-cats button[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mt-keys{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.mt-keys button,.mt-nav button{border:1px solid var(--line);background:var(--bg);border-radius:8px;min-height:44px;padding:4px;font-size:15px;cursor:pointer;color:var(--ink);font-family:"KaTeX_Main","Times New Roman",serif;touch-action:manipulation}
.mt-keys button:hover,.mt-nav button:hover{border-color:var(--accent);background:var(--accent-soft)}
.mt-keys button:active,.mt-nav button:active{transform:translateY(1px)}
.mt-keys .w2{grid-column:span 2}.mt-keys .w3{grid-column:span 3;font-size:14px}
.mt-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.mt-nav button{font-family:var(--f-body);font-size:13px;background:var(--paper)}
.mt-pad{position:relative;border:2px dashed var(--line);border-radius:10px;background:#fff;height:min(34dvh,260px);touch-action:none;overflow:hidden}
.mt-pad canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
.mt-pad .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa;font-size:14px;pointer-events:none;text-align:center;padding:16px}
.mt-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mt-cands{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin-top:8px;min-height:58px}
.mt-cands button{border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;color:var(--ink);min-width:0}
.mt-cands button:first-child{border-color:var(--accent);background:var(--accent-soft)}
.mt-cands button:hover{border-color:var(--accent)}
.mt-cands b{font:400 24px/1.2 "KaTeX_Main","Times New Roman",serif}
.mt-cands small{font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
@media (max-width:480px){.mt-cands{grid-template-columns:repeat(4,minmax(0,1fr))}}
.mt-tools .btn[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mt-msg{font-size:13px;color:var(--muted);min-height:1.2em}
.mt-msg.err{color:var(--bad)}
.mt-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line);background:var(--bg)}
@media (max-width:480px){.mt-keys{grid-template-columns:repeat(4,minmax(0,1fr))}.mt-keys .w3{grid-column:span 4}.mt-field{font-size:20px}}
`;
  function injectCss() { if (document.getElementById("mt-css")) return; const s = document.createElement("style"); s.id = "mt-css"; s.textContent = CSS; document.head.appendChild(s); }
  // 근호 안에 x: "수식을 쓴다"는 뜻이 바로 보이는 아이콘
  // 계산기 아이콘: "수식을 입력하는 곳"이라는 뜻
  const ICON = `<svg class="mt-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/></svg>`;
  const buttonHTML = key => `<button type="button" class="mt-btn" data-mt-open="${esc(key)}" title="수식 입력기 (키보드·손글씨)" aria-label="수식 입력기 열기">${ICON}<span>수식</span></button>`;

  /* ───── 수식 입력 창 ───── */
  let dlg = null;
  let sharedMF = null;
  function close() { if (!dlg) return; const d = dlg; dlg = null; d.cleanup();
    if (sharedMF && d.el.contains(sharedMF)) { try { sharedMF.blur(); } catch (e) {} let h = document.getElementById("mt-park"); if (!h) { h = document.createElement("div"); h.id = "mt-park"; h.hidden = true; document.body.appendChild(h); } h.appendChild(sharedMF); }
    d.el.remove(); }

  async function open(field, opts) {
    opts = opts || {}; injectCss(); close();
    const text = field.value || "", pos = field.selectionStart ?? text.length;
    // whole: 칸 전체가 수식 하나(수식 전용 칸) → 칸 전체를 고칩니다
    const hit = opts.whole ? { start: 0, end: text.length, tex: (tokens(text)[0] || {}).tex ?? text.replace(/^\$|\$$/g, "").trim() }
      : tokens(text).find(t => pos >= t.start && pos <= t.end) || (opts.index != null ? tokens(text)[opts.index] : null);
    const el = document.createElement("div"); el.className = "mt-dlg";
    el.innerHTML = `<div class="mt-box" role="dialog" aria-modal="true" aria-label="수식 입력기">
      <div class="mt-head"><b>수식 입력기</b><div class="mt-modes"><button type="button" data-mode="kb" aria-pressed="true">⌨ 키보드</button><button type="button" data-mode="hw" aria-pressed="false">✍ 기호 그리기</button></div><button type="button" class="mt-x" data-close aria-label="닫기">×</button></div>
      <div class="mt-body">
        <div class="mt-msg" data-load>수식 도구를 불러오는 중…</div>
        <div data-mfbox></div>
        <label class="mt-src">LaTeX<input data-src spellcheck="false" autocomplete="off" aria-label="LaTeX 코드"></label>
        <div data-kb>
          <div class="mt-cats">${Object.keys(KEYS).map((k, i) => `<button type="button" data-cat="${k}" aria-pressed="${i === 0}">${k}</button>`).join("")}</div>
          <div class="mt-keys" data-keys style="margin-top:8px"></div>
          <div class="mt-nav" style="margin-top:6px">${NAV.map(([l, c]) => `<button type="button" data-cmd="${c}">${l}</button>`).join("")}</div>
        </div>
        <div data-hw hidden>
          <div class="mt-pad"><canvas></canvas><div class="ph" data-ph><span>찾고 싶은 기호 <b>하나</b>를 크게 그리세요<br>예: ∫ θ √ ≤ ∞ φ</span></div></div>
          <div class="mt-cands" data-cands aria-live="polite"></div>
          <div class="mt-tools" style="margin-top:8px"><button type="button" class="btn" data-tool="pen" aria-pressed="true">✏ 펜</button><button type="button" class="btn" data-tool="erase" aria-pressed="false">⌫ 지우개</button><button type="button" class="btn" data-hwundo>되돌리기</button><button type="button" class="btn" data-hwclear>모두 지우기</button></div>
          <div class="mt-msg">비슷한 기호가 위에 나타납니다. 누르면 수식 칸에 들어가고 판은 비워집니다. 식 전체는 키보드로 쓰고, 찾기 어려운 기호만 여기서 그리세요. (인터넷·AI 없이 이 기기 안에서 동작)</div>
        </div>
      </div>
      <div class="mt-foot"><button type="button" class="btn" data-close>취소</button><button type="button" class="btn pri" data-ok>${hit ? "수식 고치기" : "칸에 넣기"}</button></div></div>`;
    document.body.appendChild(el);
    const $ = s => el.querySelector(s);
    let mf = null, src = $("[data-src]"), cat = Object.keys(KEYS)[0];
    const drawKeys = () => { $("[data-keys]").innerHTML = KEYS[cat].map(([l, t, w], i) => `<button type="button" data-k="${i}"${w > 1 ? ` class="w${w}"` : ""} title="${esc(t)}">${esc(l)}</button>`).join(""); };
    drawKeys();
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    dlg = { el, cleanup: () => { document.removeEventListener("keydown", onKey); pad && pad.stop(); } };

    // 키를 눌러도 수식 칸의 커서가 사라지지 않게 합니다
    el.addEventListener("pointerdown", e => { if (e.target.closest(".mt-keys button,.mt-nav button")) e.preventDefault(); });
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) { if (e.target === el) close(); return; }
      if (b.hasAttribute("data-close")) return close();
      if (b.dataset.mode) { el.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("[data-kb]").hidden = b.dataset.mode !== "kb"; $("[data-hw]").hidden = b.dataset.mode !== "hw"; if (b.dataset.mode === "hw") pad.fit(); return; }
      if (b.dataset.cat) { cat = b.dataset.cat; el.querySelectorAll("[data-cat]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawKeys(); return; }
      if (!mf) return;
      if (b.dataset.k != null) { mf.executeCommand(["insert", KEYS[cat][+b.dataset.k][1], { focus: true, selectionMode: "placeholder", format: "latex", mode: "math" }]); focusMF(); return; }
      if (b.dataset.cmd) { if (b.dataset.cmd === "clear") { mf.value = ""; sync(); } else mf.executeCommand(b.dataset.cmd); focusMF(); return; }
      if (b.hasAttribute("data-ok")) { insert(); return; }
      if (b.dataset.tool) { pad.mode = b.dataset.tool; el.querySelectorAll("[data-tool]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); return; }
      if (b.hasAttribute("data-hwundo")) return pad.undo();
      if (b.hasAttribute("data-hwclear")) return pad.clear();
      if (b.dataset.cand != null) { const c = cands[+b.dataset.cand]; if (!c) return; mf.executeCommand(["insert", c[1], { focus: true, selectionMode: "placeholder", format: "latex", mode: "math" }]); pad.clear(); sync(); return; }
    });

    function focusMF() { try { mf.focus(); } catch (e) { /* MathLive 내부 포커스 오류: 입력에는 영향 없음 */ } }
    function sync() { if (mf && document.activeElement !== src) src.value = mf.getValue("latex"); }
    src.addEventListener("input", () => { if (mf) mf.setValue(src.value, { silenceNotifications: true }); });

    function insert() {
      // 비어 있는 빈칸(placeholder)은 빼고 저장합니다
      const tex = (mf ? mf.getValue("latex-without-placeholders") : src.value).replace(/\\placeholder\{\}/g, "").trim();
      let v = field.value, a, b2;
      if (hit) { a = hit.start; b2 = hit.end; } else { a = field.selectionStart ?? v.length; b2 = field.selectionEnd ?? a; }
      const piece = tex ? `$${tex}$` : "";
      field.value = v.slice(0, a) + piece + v.slice(b2);
      close();
      field.focus(); try { field.selectionStart = field.selectionEnd = a + piece.length; } catch (e) {}
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    let cands = [], hwT = null;
    function showCands() {
      $("[data-cands]").innerHTML = cands.map((c, i) => `<button type="button" data-cand="${i}" title="${esc(c[2])} · ${esc(c[1])}"><b>${esc(c[0])}</b><small>${esc(c[2])}</small></button>`).join("");
    }
    function onDraw(strokes) {
      clearTimeout(hwT);
      if (!strokes.length) { cands = []; showCands(); return; }
      hwT = setTimeout(() => symbolMatch(strokes).then(r => { cands = r; showCands(); }), 120);
    }

    const pad = makePad($(".mt-pad"), $("[data-ph]"), onDraw);
    if (opts.mode === "hw") $('[data-mode="hw"]').click();

    try {
      await loadMathLive();
      if (!el.isConnected) return;
      // 수식 칸은 한 번만 만들어 계속 다시 씁니다 (지웠다 새로 만들면 MathLive 내부 오류가 납니다)
      if (!sharedMF) {
        sharedMF = document.createElement("math-field");
        sharedMF.className = "mt-field";
        sharedMF.mathVirtualKeyboardPolicy = "manual";
        sharedMF.setAttribute("aria-label", "수식");
      }
      mf = sharedMF;
      $("[data-mfbox]").appendChild(mf);
      try { mf.menuItems = []; } catch (e) {}
      mf.smartFence = true; mf.smartMode = false;
      mf.setValue(hit ? hit.tex : "");
      if (mf._mtSync) mf.removeEventListener("input", mf._mtSync);
      mf._mtSync = sync; mf.addEventListener("input", sync);
      $("[data-load]").remove(); sync();
      setTimeout(() => focusMF(), 50);
    } catch (e) {
      $("[data-load]").textContent = e.message; $("[data-load]").className = "mt-msg err";
      src.value = hit ? hit.tex : ""; src.focus();
    }
  }

  /* ───── 기호 그리기 인식 (기기 안에서) ─────
   * 그린 모양과 기호 견본을 같은 크기(40×40)로 맞춘 뒤, 서로의 선까지 거리(챔퍼 거리)와 가로세로 비율을 비교합니다.
   * 견본은 기호마다 여러 글꼴로 그려 만들므로 학습 자료나 서버가 필요 없습니다. */
  // [보이는 글자, 넣을 LaTeX, 이름]
  const HW_SYMS = [
    ["∫", "\\int", "적분"], ["∑", "\\sum", "합"], ["√", "\\sqrt{#0}", "근호"], ["π", "\\pi", "파이"], ["θ", "\\theta", "세타"], ["φ", "\\varphi", "파이(φ)"],
    ["α", "\\alpha", "알파"], ["β", "\\beta", "베타"], ["γ", "\\gamma", "감마"], ["δ", "\\delta", "델타"], ["Δ", "\\Delta", "델타(대)"], ["ε", "\\varepsilon", "엡실론"],
    ["λ", "\\lambda", "람다"], ["μ", "\\mu", "뮤"], ["σ", "\\sigma", "시그마"], ["ω", "\\omega", "오메가"], ["Ω", "\\Omega", "오메가(대)"], ["∞", "\\infty", "무한대"],
    ["∂", "\\partial", "편미분"], ["∇", "\\nabla", "나블라"], ["≤", "\\le", "작거나 같다"], ["≥", "\\ge", "크거나 같다"], ["≠", "\\ne", "같지 않다"], ["≈", "\\approx", "근삿값"],
    ["±", "\\pm", "플러스마이너스"], ["×", "\\times", "곱하기"], ["÷", "\\div", "나누기"], ["→", "\\to", "화살표"], ["⇒", "\\Rightarrow", "이면"], ["⇔", "\\Leftrightarrow", "동치"],
    ["∈", "\\in", "원소"], ["∴", "\\therefore", "그러므로"], ["∵", "\\because", "왜냐하면"], ["∠", "\\angle", "각"], ["⊥", "\\perp", "수직"], ["°", "^{\\circ}", "도"],
    ["′", "'", "프라임"], ["∪", "\\cup", "합집합"], ["∩", "\\cap", "교집합"], ["⊂", "\\subset", "부분집합"], ["∅", "\\emptyset", "공집합"], ["∝", "\\propto", "비례"],
    ["ℓ", "\\ell", "엘"], ["+", "+", "더하기"], ["−", "-", "빼기"], ["=", "=", "같다"], ["<", "<", "작다"], [">", ">", "크다"], ["(", "(", "괄호"], [")", ")", "괄호"],
    ["|", "|", "절댓값"], ["/", "/", "나누기(/)"],
    ..."0123456789".split("").map(d => [d, d, "숫자 " + d]),
    ..."xyabcdefgntukpqr".split("").map(c => [c, c, "문자 " + c])
  ];
  const HW_FONTS = ['100px "KaTeX_Main", serif', 'italic 100px "KaTeX_Math", serif', '100px "Times New Roman", serif', 'italic 100px "Times New Roman", serif', '100px Arial, sans-serif', '100px "Cambria Math", serif'];
  const G = 40, M = 4;
  let hwTpl = null;
  function distT(mask) {
    const d = new Float32Array(G * G), INF = 1e6;
    for (let i = 0; i < G * G; i++) d[i] = mask[i] ? 0 : INF;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const i = y * G + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) { v = Math.min(v, d[i - G] + 1); if (x > 0) v = Math.min(v, d[i - G - 1] + 1.41); if (x < G - 1) v = Math.min(v, d[i - G + 1] + 1.41); }
      d[i] = v; }
    for (let y = G - 1; y >= 0; y--) for (let x = G - 1; x >= 0; x--) { const i = y * G + x; let v = d[i];
      if (x < G - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < G - 1) { v = Math.min(v, d[i + G] + 1); if (x < G - 1) v = Math.min(v, d[i + G + 1] + 1.41); if (x > 0) v = Math.min(v, d[i + G - 1] + 1.41); }
      d[i] = v; }
    return d;
  }
  /** 캔버스(src)의 bbox 영역을 40×40 안에 비율을 지켜 가운데로 옮겨 0/1 격자로 만듭니다. */
  function toGrid(src, bx, by, bw, bh) {
    const c = document.createElement("canvas"); c.width = c.height = G; const x = c.getContext("2d", { willReadFrequently: true });
    const k = (G - 2 * M) / Math.max(bw, bh, 1), w = Math.max(bw * k, 1), h = Math.max(bh * k, 1);
    x.drawImage(src, bx, by, Math.max(bw, 1), Math.max(bh, 1), (G - w) / 2, (G - h) / 2, w, h);
    const px = x.getImageData(0, 0, G, G).data, mask = new Uint8Array(G * G); let n = 0;
    for (let i = 0; i < G * G; i++) if (px[i * 4 + 3] > 90) { mask[i] = 1; n++; }
    return n ? { mask, dt: distT(mask), n, ar: bw / Math.max(bh, 1) } : null;
  }
  async function buildTemplates() {
    if (hwTpl) return hwTpl;
    try { await loadMathLive(); await Promise.all([document.fonts.load('100px "KaTeX_Main"', "∫θπ"), document.fonts.load('italic 100px "KaTeX_Math"', "xθ")]); } catch (e) {}
    const S = 200, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d", { willReadFrequently: true });
    hwTpl = HW_SYMS.map(sym => {
      const forms = [];
      HW_FONTS.forEach(font => {
        x.clearRect(0, 0, S, S); x.font = font; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#000"; x.fillText(sym[0], S / 2, S / 2);
        const px = x.getImageData(0, 0, S, S).data; let x1 = S, y1 = S, x2 = -1, y2 = -1;
        for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) if (px[(yy * S + xx) * 4 + 3] > 128) { if (xx < x1) x1 = xx; if (xx > x2) x2 = xx; if (yy < y1) y1 = yy; if (yy > y2) y2 = yy; }
        if (x2 < 0) return;
        const g = toGrid(c, x1, y1, x2 - x1 + 1, y2 - y1 + 1); if (g) forms.push(g);
      });
      (HW_HAND[sym[0]] || []).forEach(shape => { const g = strokesGrid(shape); if (g) forms.push(g); });  // 손으로 쓴 모양 견본
      return { sym, forms };
    }).filter(t => t.forms.length);
    return hwTpl;
  }
  /* 글꼴과 손글씨 모양이 크게 다른 기호의 손글씨 견본 (단위 상자 안 좌표, y는 아래로) */
  const pl = (...p) => p, arc = (cx, cy, rx, ry, a0, a1, n = 32) => [...Array(n + 1)].map((_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  const fnPath = (f, n = 40) => [...Array(n + 1)].map((_, i) => f(i / n));
  const HW_HAND = {
    "√": [[pl([0, .6], [.12, .52], [.3, 1], [.5, 0], [1.3, 0])], [pl([0, .65], [.15, .6], [.32, 1], [.55, 0], [.9, 0])]],
    "φ": [[arc(.5, .55, .3, .3, 0, 2 * Math.PI), pl([.5, 0], [.5, 1.15])], [arc(.5, .55, .3, .26, 0, 2 * Math.PI), pl([.56, 0], [.44, 1.15])]],
    "α": [[fnPath(t => { const a = .6 + 2 * Math.PI * .9 * t; return [.45 + .25 * Math.cos(a) + (t > .8 ? (t - .8) * 1.2 : 0), .5 + .22 * Math.sin(a)]; })],
          [fnPath(t => { const a = Math.PI * (.25 + 1.9 * t); return [.4 + .28 * Math.cos(a) + t * .35, .5 - .22 * Math.sin(a)]; })]],
    "∂": [[fnPath(t => { if (t < .5) { const a = Math.PI * (1.1 + 1.8 * t); return [.5 + .25 * Math.cos(a), .62 + .25 * Math.sin(a)]; } const u = (t - .5) * 2; return [.75 - .1 * u - .3 * u * u, .62 - .6 * u + .1 * u * u]; })]],
    "∫": [[fnPath(t => [.5 + .14 * Math.cos(Math.PI * t) + (t < .15 ? (.15 - t) * .6 : 0) - (t > .85 ? (t - .85) * .6 : 0), 1.2 * t])],
          [fnPath(t => [.5 + .12 * Math.sin(Math.PI * (t - .5)) * -1 + (t < .1 ? (.1 - t) * 1.5 : 0) - (t > .9 ? (t - .9) * 1.5 : 0), 1.3 * t])]],
    "∑": [[pl([.85, 0], [.1, 0], [.5, .5], [.1, 1], [.85, 1])]],
    "∞": [[fnPath(t => { const a = 2 * Math.PI * t, d = 1 + Math.sin(a) ** 2; return [.6 + .5 * Math.cos(a) / d, .3 + .5 * Math.sin(a) * Math.cos(a) / d]; }, 60)]],
    "θ": [[arc(.5, .6, .22, .4, 0, 2 * Math.PI), pl([.3, .6], [.7, .6])]],
    "π": [[pl([.1, .3], [.95, .28]), pl([.38, .3], [.34, .95]), pl([.7, .3], [.76, .95])]],
    "∈": [[arc(.55, .5, .45, .4, Math.PI * .5, Math.PI * 1.5), pl([.1, .5], [.8, .5])]],
    "±": [[pl([.1, .4], [.9, .4]), pl([.5, 0], [.5, .8]), pl([.1, 1], [.9, 1])]],
    "≥": [[pl([.2, 0], [.8, .3], [.2, .6]), pl([.2, .85], [.8, .85])]],
    "=": [[pl([0, .35], [1, .35]), pl([0, .65], [1, .65])]],
    "λ": [[pl([.1, 0], [.9, 1]), pl([.5, .45], [.1, 1])]],
    "μ": [[pl([.2, 0], [.2, 1.3]), fnPath(t => [.2 + .5 * t, .4 + .4 * Math.sin(Math.PI * t * .9)]), pl([.7, 0], [.75, .9])]],
    "σ": [[arc(.4, .6, .3, .3, 0, 2 * Math.PI), pl([.4, .3], [1, .3])]],
    "ω": [[fnPath(t => [t, .3 + .5 * Math.abs(Math.sin(2 * Math.PI * t))])]]
  };
  /** 획 목록(어떤 좌표든) → 40×40 격자. 선 굵기는 크기에 비례합니다. */
  function strokesGrid(strokes) {
    const pts = strokes.flat(); if (!pts.length) return null;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x1 = Math.min(...xs), y1 = Math.min(...ys), bw = Math.max(...xs) - x1, bh = Math.max(...ys) - y1;
    const k = 100 / Math.max(bw, bh, 1e-6);   // 손글씨든 단위 상자 견본이든 100px 크기로 맞춰 그립니다
    const big = Math.max(bw, bh) * k, lw = big * 0.085 + 2, pad = lw;
    const c = document.createElement("canvas"); c.width = Math.ceil(bw * k + 2 * pad); c.height = Math.ceil(bh * k + 2 * pad);
    const x = c.getContext("2d"); x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = lw; x.strokeStyle = "#000";
    strokes.forEach(s => { x.beginPath(); s.forEach(([px, py], i) => { const X = (px - x1) * k + pad, Y = (py - y1) * k + pad; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); if (s.length === 1) x.lineTo((s[0][0] - x1) * k + pad + .1, (s[0][1] - y1) * k + pad); x.stroke(); });
    return toGrid(c, 0, 0, c.width, c.height);
  }
  /** 획 목록 → 비슷한 기호 8개 [글자, LaTeX, 이름] */
  async function symbolMatch(strokes) {
    const tpl = await buildTemplates();
    const u = strokesGrid(strokes); if (!u) return [];
    const lar = Math.log(Math.min(6, Math.max(1 / 6, u.ar)));
    return tpl.map(t => {
      let best = Infinity;
      t.forms.forEach(f => {
        let a = 0, b = 0;
        for (let i = 0; i < G * G; i++) { if (u.mask[i]) a += f.dt[i]; if (f.mask[i]) b += u.dt[i]; }
        const sc = a / u.n + b / f.n + 2.2 * Math.abs(lar - Math.log(Math.min(6, Math.max(1 / 6, f.ar))));
        if (sc < best) best = sc;
      });
      return [best, t.sym];
    }).sort((p, q) => p[0] - q[0]).slice(0, 8).map(r => r[1]);
  }

  /* ───── 손글씨 판 ───── */
  function makePad(box, ph, onChange) {
    const cv = box.querySelector("canvas"), cx = cv.getContext("2d");
    let strokes = [], cur = null, penSeen = false, dpr = 1;
    const api = { mode: "pen" };
    function fit() {
      const r = box.getBoundingClientRect(); if (!r.width) return;
      dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); draw();
    }
    function draw() {
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
      cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#111"; cx.lineWidth = 3;
      strokes.forEach(s => { cx.beginPath(); s.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); if (s.length === 1) cx.lineTo(s[0][0] + .1, s[0][1]); cx.stroke(); });
      ph.style.display = strokes.length ? "none" : "";
    }
    const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const changed = () => onChange && onChange(strokes);
    function eraseAt(p) { const before = strokes.length; strokes = strokes.filter(s => !s.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 12)); if (strokes.length !== before) { draw(); changed(); } }
    function down(e) {
      if (e.pointerType === "pen") penSeen = true;
      if (penSeen && e.pointerType === "touch") return;     // 펜을 쓰면 손바닥 터치는 무시합니다
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      if (api.mode === "erase") { cur = "erase"; eraseAt(at(e)); return; }
      cur = [at(e)]; strokes.push(cur); draw();
    }
    function move(e) {
      if (!cur) return; e.preventDefault();
      if (cur === "erase") return eraseAt(at(e));
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(ev => cur.push(at(ev))); draw();
    }
    function up() { const was = cur; cur = null; if (was && was !== "erase") changed(); }
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    const ro = new ResizeObserver(fit); ro.observe(box);
    api.fit = fit;
    api.undo = () => { strokes.pop(); draw(); changed(); };
    api.clear = () => { strokes = []; draw(); changed(); };
    api.stop = () => ro.disconnect();
    requestAnimationFrame(fit);
    return api;
  }

  injectCss();
  window.MathTool = { iconSVG: ICON, symbolMatch, open, close, render, renderInto, toImages, tokens, hasMath, buttonHTML, injectCss, preload: () => loadMathLive().catch(() => {}) };
})();
