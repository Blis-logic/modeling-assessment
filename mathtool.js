/* 수식 입력기: 수식 키보드(MathLive) · 손글씨 인식 · 수식 미리보기 · 문서용 수식 그림(MathJax SVG)
 * 활동지 칸에는 수식이 $LaTeX$ 형태로 저장됩니다. 화면은 이 표기를 찾아 수식으로 그려 보여 줍니다.
 * window.MathTool.open(field, {recognize}) / render(text) / renderInto(el, text) / toImages(latexList)
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
      const s = document.createElement("script"); s.src = url; s.async = true;
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
.mt-btn{flex:none;align-self:stretch;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:0;border-left:1px solid var(--line);background:var(--paper);color:var(--accent);font:600 13px/1 var(--f-body);padding:0 10px;cursor:pointer;min-width:44px}
.mt-btn:hover{background:var(--accent-soft)}
.mt-wrap{display:flex;align-items:stretch;min-width:0}
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
.mt-pad{position:relative;border:2px dashed var(--line);border-radius:10px;background:#fff;height:min(42dvh,320px);touch-action:none;overflow:hidden}
.mt-pad canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
.mt-pad .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa;font-size:14px;pointer-events:none;text-align:center;padding:16px}
.mt-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mt-tools .btn[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mt-msg{font-size:13px;color:var(--muted);min-height:1.2em}
.mt-msg.err{color:var(--bad)}
.mt-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line);background:var(--bg)}
@media (max-width:480px){.mt-keys{grid-template-columns:repeat(4,minmax(0,1fr))}.mt-keys .w3{grid-column:span 4}.mt-field{font-size:20px}}
`;
  function injectCss() { if (document.getElementById("mt-css")) return; const s = document.createElement("style"); s.id = "mt-css"; s.textContent = CSS; document.head.appendChild(s); }
  const ICON = `<b aria-hidden="true" style="font:700 16px/1 KaTeX_Main,Times New Roman,serif">∑</b>`;
  const buttonHTML = key => `<button type="button" class="mt-btn" data-mt-open="${esc(key)}" title="수식 입력기 (키보드·손글씨)" aria-label="수식 입력기 열기">${ICON}<span>수식</span></button>`;

  /* ───── 수식 입력 창 ───── */
  let dlg = null;
  function close() { if (dlg) { dlg.cleanup(); dlg.el.remove(); dlg = null; } }

  async function open(field, opts) {
    opts = opts || {}; injectCss(); close();
    const text = field.value || "", pos = field.selectionStart ?? text.length;
    const hit = tokens(text).find(t => pos >= t.start && pos <= t.end) || (opts.index != null ? tokens(text)[opts.index] : null);
    const el = document.createElement("div"); el.className = "mt-dlg";
    el.innerHTML = `<div class="mt-box" role="dialog" aria-modal="true" aria-label="수식 입력기">
      <div class="mt-head"><b>수식 입력기</b><div class="mt-modes"><button type="button" data-mode="kb" aria-pressed="true">⌨ 키보드</button><button type="button" data-mode="hw" aria-pressed="false">✍ 손글씨</button></div><button type="button" class="mt-x" data-close aria-label="닫기">×</button></div>
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
          <div class="mt-pad"><canvas></canvas><div class="ph" data-ph>여기에 마우스·펜·손가락으로 수식을 쓰세요<br>다 쓰면 [수식으로 바꾸기]를 누릅니다</div></div>
          <div class="mt-tools" style="margin-top:8px"><button type="button" class="btn" data-tool="pen" aria-pressed="true">✏ 펜</button><button type="button" class="btn" data-tool="erase" aria-pressed="false">⌫ 지우개</button><button type="button" class="btn" data-hwundo>되돌리기</button><button type="button" class="btn" data-hwclear>모두 지우기</button><span style="flex:1"></span><button type="button" class="btn pri" data-hwgo>수식으로 바꾸기 →</button></div>
          <div class="mt-msg" data-hwmsg>${opts.recognize ? "인식한 수식은 위 칸에 들어갑니다. 틀린 곳은 키보드로 고친 뒤 넣으세요." : "선생님이 손글씨 인식을 아직 켜지 않았습니다. 키보드를 써 주세요."}</div>
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
      if (b.dataset.k != null) { mf.executeCommand(["insert", KEYS[cat][+b.dataset.k][1], { focus: true, selectionMode: "placeholder", format: "latex", mode: "math" }]); mf.focus(); return; }
      if (b.dataset.cmd) { if (b.dataset.cmd === "clear") { mf.value = ""; sync(); } else mf.executeCommand(b.dataset.cmd); mf.focus(); return; }
      if (b.hasAttribute("data-ok")) { insert(); return; }
      if (b.dataset.tool) { pad.mode = b.dataset.tool; el.querySelectorAll("[data-tool]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); return; }
      if (b.hasAttribute("data-hwundo")) return pad.undo();
      if (b.hasAttribute("data-hwclear")) return pad.clear();
      if (b.hasAttribute("data-hwgo")) return recognize(b);
    });

    function sync() { if (mf && document.activeElement !== src) src.value = mf.getValue("latex"); }
    src.addEventListener("input", () => { if (mf) mf.setValue(src.value, { silenceNotifications: true }); });

    function insert() {
      const tex = (mf ? mf.getValue("latex") : src.value).trim();
      let v = field.value, a, b2;
      if (hit) { a = hit.start; b2 = hit.end; } else { a = field.selectionStart ?? v.length; b2 = field.selectionEnd ?? a; }
      const piece = tex ? `$${tex}$` : "";
      field.value = v.slice(0, a) + piece + v.slice(b2);
      close();
      field.focus(); try { field.selectionStart = field.selectionEnd = a + piece.length; } catch (e) {}
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    async function recognize(btn) {
      const msg = $("[data-hwmsg]");
      if (!opts.recognize) return;
      const png = pad.png(); if (!png) { msg.textContent = "먼저 수식을 써 주세요."; msg.className = "mt-msg err"; return; }
      btn.disabled = true; msg.className = "mt-msg"; msg.textContent = "손글씨를 읽는 중… (몇 초 걸립니다)";
      try {
        const tex = await opts.recognize(png);
        if (!tex) throw new Error("수식을 읽지 못했습니다. 조금 더 크고 또박또박 써 주세요.");
        if (mf) { mf.setValue(tex); sync(); }
        msg.textContent = "읽은 수식을 위 칸에 넣었습니다. 맞는지 확인하고, 틀린 곳은 키보드로 고친 뒤 [칸에 넣기]를 누르세요.";
      } catch (e) { msg.className = "mt-msg err"; msg.textContent = (e && (e.userMessage || e.message)) || "읽지 못했습니다."; }
      btn.disabled = false;
    }

    const pad = makePad($(".mt-pad"), $("[data-ph]"));
    if (opts.mode === "hw") $('[data-mode="hw"]').click();

    try {
      await loadMathLive();
      if (!el.isConnected) return;
      mf = document.createElement("math-field");
      mf.className = "mt-field";
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.setAttribute("aria-label", "수식");
      $("[data-mfbox]").appendChild(mf);
      try { mf.menuItems = []; } catch (e) {}
      mf.smartFence = true; mf.smartMode = false;
      mf.setValue(hit ? hit.tex : "");
      mf.addEventListener("input", sync);
      $("[data-load]").remove(); sync();
      setTimeout(() => mf.focus(), 50);
    } catch (e) {
      $("[data-load]").textContent = e.message; $("[data-load]").className = "mt-msg err";
      src.value = hit ? hit.tex : ""; src.focus();
    }
  }

  /* ───── 손글씨 판 ───── */
  function makePad(box, ph) {
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
    function eraseAt(p) { const before = strokes.length; strokes = strokes.filter(s => !s.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 12)); if (strokes.length !== before) draw(); }
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
    function up() { cur = null; }
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    const ro = new ResizeObserver(fit); ro.observe(box);
    api.fit = fit;
    api.undo = () => { strokes.pop(); draw(); };
    api.clear = () => { strokes = []; draw(); };
    api.stop = () => ro.disconnect();
    /** 쓴 부분만 잘라 흰 바탕 PNG(base64)로 만듭니다. */
    api.png = () => {
      const pts = strokes.flat(); if (!pts.length) return "";
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 16;
      const x1 = Math.min(...xs) - pad, y1 = Math.min(...ys) - pad, w = Math.max(...xs) - x1 + pad, h = Math.max(...ys) - y1 + pad;
      const k = Math.min(3, 1200 / Math.max(w, h)), o = document.createElement("canvas");
      o.width = Math.max(32, Math.round(w * k)); o.height = Math.max(32, Math.round(h * k));
      const c = o.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, o.width, o.height);
      c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#000"; c.lineWidth = 3 * k;
      strokes.forEach(s => { c.beginPath(); s.forEach(([x, y], i) => { const X = (x - x1) * k, Y = (y - y1) * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); if (s.length === 1) c.lineTo((s[0][0] - x1) * k + .1, (s[0][1] - y1) * k); c.stroke(); });
      return o.toDataURL("image/png").split(",")[1];
    };
    requestAnimationFrame(fit);
    return api;
  }

  injectCss();
  window.MathTool = { open, close, render, renderInto, toImages, tokens, hasMath, buttonHTML, injectCss, preload: () => loadMathLive().catch(() => {}) };
})();
