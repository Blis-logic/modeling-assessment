/* 실생활 도형 디자인 보고서 (C04) — 사진 위 좌표평면에서 이차곡선·벡터로 모델링
 * index.html 의 공통 기능(로그인·자동 저장·수식 입력기·사진·구글 문서·PDF·교사 현황)을 그대로 쓰고,
 * 이 파일은 활동지 내용, 좌표평면 모델링 도구, 학생 화면, 교사 읽기 화면, 보고서 명세를 정합니다. (index.html 이 TASK==="shape" 일 때 부릅니다)
 *
 * 기록(doc) 구조 — 모델링 기록과 섞이지 않게 kind:"shape" 를 꼭 넣습니다(서버가 다른 과제 시트에 쓰는 것을 거절):
 *   {v:2, kind:"shape", info:{sid,name,title}, ans:{sh_*},
 *    canvas:{img:{id,size,at,w,h}, R, op, rot, tx, ty, w, tol},   ← 물체 사진과 좌표평면에 맞춘 변환(투명도·회전·평행이동·크기), 정확도 허용 거리
 *    pts:[{n,x,y}],                                                ← 사진에서 고른 꼭짓점(정확도 기준점)
 *    conics:[{type,a,b,c,d,xmin,xmax,ymin,ymax,role}],      ← 계수로 그리는 이차곡선(범위 제한)
 *    vecs:[{x0,y0,v1,v2,meaning}],                          ← 시점과 성분으로 그리는 벡터(직선)
 *    maps:[{part,math,desc}], checks, tools, photos, act, status, submittedAt, updatedAt}
 * 입력 칸 값은 글자로 저장되고, 계산할 때 숫자로 읽습니다. 칸 이름은 모두 sh_ 로 시작해 모델링 칸(s1_~s5_)과 겹치지 않습니다.
 */
(function () {
  "use strict";
  const ALGEO_HOME = "https://www.algeomath.kr/";
  // 이차곡선 종류: 타원 ((x-c)/a)^2+((y-d)/b)^2=1 을 기준으로
  const CONIC_TYPES = ["타원", "원", "쌍곡선 (좌우)", "쌍곡선 (상하)", "포물선 (위아래)", "포물선 (좌우)"];
  const normType = t => CONIC_TYPES.includes(t) ? t : t === "포물선" ? "포물선 (위아래)" : t === "쌍곡선" ? "쌍곡선 (좌우)" : t === "원" ? "원" : "타원";
  const COLORS = ["#E11D48", "#2563EB", "#D97706", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#EA580C"];
  const VCOLORS = ["#0F766E", "#1E293B", "#9333EA", "#B45309"];
  const RANGES = [5, 10, 20, 50];
  const GOAL = { maps: 2, conics: 2, vecs: 2, pts: 3 };   // 작성률 계산에 쓰는 최소 개수
  const MAX = { maps: 20, conics: 20, vecs: 20, pts: 40 };
  const SHORT = ["구상", "이차곡선", "벡터", "해석", "정리"];
  const STAGES = [
    { name: "탐구 대상 구상", time: "1차시 · 1시간", goal: "모델링할 실생활 물체 사진을 좌표평면에 맞추고, 모델의 기준이 될 꼭짓점을 고릅니다." },
    { name: "이차곡선 모델링", time: "2차시 · 2시간", goal: "계수와 범위를 바꿔 가며 원·타원·포물선·쌍곡선을 사진의 윤곽에 맞춥니다." },
    { name: "벡터 모델링", time: "3차시 · 1~2시간", goal: "직선 부분을 시점과 성분으로 정한 벡터로 나타냅니다." },
    { name: "정확도·수학적 해석", time: "4차시 · 1~2시간", goal: "고른 꼭짓점으로 모델의 정확도를 확인하고, 곡선의 연결·대칭과 벡터의 역할, 한계를 수학적 근거로 설명합니다." },
    { name: "최종 성과 정리", time: "5단계", goal: "탐구 과정을 돌아보고, 작품과 모델링 결과에 대한 나의 의견과 도구 활용을 정리한 뒤 보고서를 점검해 제출합니다." }
  ];
  // 단계 머리 색·아이콘: 나의 수행, 1~5단계 (도형 과제는 초록색 계열)
  const LOOK = [
    ["#047857", "#10B981", '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 13l2 2 4-4"/>'],
    ["#059669", "#14B8A6", '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'],
    ["#15803D", "#65A30D", '<ellipse cx="12" cy="12" rx="9" ry="5.5"/><path d="M4 20c3-9 13-9 16 0"/>'],
    ["#0F766E", "#0891B2", '<path d="M4 20 19 5"/><path d="M12 5h7v7"/><circle cx="4" cy="20" r="1.4"/>'],
    ["#16A34A", "#22C55E", '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'],
    ["#059669", "#0EA5E9", '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>']
  ];
  /* 도형 과제 화면의 테마: <html data-task="shape"> 일 때 강조색을 초록으로 (모델링은 그대로 남색) */
  (function () {
    const st = document.createElement("style");
    st.textContent = `html:root[data-task="shape"]{--accent:#059669;--accent-soft:#E3F5EC}
@media (prefers-color-scheme: dark){html:root[data-task="shape"]:not([data-theme="light"]){--accent:#34D399;--accent-soft:#123326}}
html:root[data-task="shape"][data-theme="dark"]{--accent:#34D399;--accent-soft:#123326}
html[data-task="shape"] .brand .logo{box-shadow:0 6px 16px -4px rgba(3,146,90,.5)}
html[data-task="shape"] .brand b{background:linear-gradient(90deg,#047857,#059669 55%,#0D9488);-webkit-background-clip:text;background-clip:text;color:transparent}`;
    document.head.appendChild(st);
  })();
  const ANALYSIS = [
    ["sh_a1", "[1] 이차곡선의 연결과 대칭성에 대한 수학적 근거"],
    ["sh_a2", "[2] 벡터의 시점·종점과 성분을 활용한 구조적 해석"],
    ["sh_a3", "[3] 모델링 결과의 타당성 및 한계 (거리·각도 정확도를 근거로)"]
  ];
  /* 5단계 최종 성과 정리: 과정 돌아보기 · 작품과 결과에 대한 의견 (칸 이름 sh_r*) */
  const REFLECT = [["sh_r1", "수행 과정에서 어려웠던 점과 해결 과정"], ["sh_r2", "작품과 모델링 결과에 대한 나의 의견"]];
  const TOOL_GUIDE = [
    "<b>이 웹앱의 좌표평면</b>: 사진을 좌표평면에 맞추고, 계수·범위·성분을 넣어 곡선과 벡터를 그리며, 위치·방향 정확도를 계산합니다.",
    "<b>공학용 계산기</b>: 끝점을 식에 대입하거나 벡터의 크기·내적·사이각을 직접 계산해 앱이 보여 준 값을 확인합니다.",
    "<b>그래프 도구</b> (알지오매스·데스모스·지오지브라, 선택): 곡선을 따로 그려 비교합니다. 만든 화면은 아래에 캡처해 올릴 수 있습니다.",
    "<b>스프레드시트</b> (선택): 꼭짓점 좌표와 정확도 값을 표로 정리합니다.",
    "<b>AI</b> (챗GPT·제미나이·클로드 등): <b>사용 금지</b>입니다. 쓰면 감점하고, 제출 후 인터뷰로 확인합니다."
  ];
  /* AI 활용 금지 (이 과제만): 모든 곡선의 선택과 계수는 학생이 스스로 결정 · 적발 시 감점 · 제출한 결과물로 인터뷰 */
  const AI_BAN = `<b>🚫 AI 활용 절대 금지</b><ul><li>챗GPT·제미나이·클로드 등 <b>AI를 쓰면 안 됩니다.</b> 적발되면 <b>감점</b>합니다.</li><li><b>모든 곡선의 종류와 계수, 벡터, 꼭짓점은 내가 직접 결정</b>합니다.</li><li>제출한 결과물로 <b>선생님과 인터뷰</b>를 합니다. 곡선을 왜 그렇게 정했는지, 식이 무엇을 뜻하는지 내 말로 설명할 수 있어야 합니다.</li></ul>`;
  const banStrip = () => `<div class="sh-ban" role="note">🚫 <b>AI 활용 금지</b> · 적발 시 감점 · 모든 곡선은 스스로 결정 · 제출 후 결과물 인터뷰</div>`;
  const TOOLS_SH = () => TOOLS.filter(([k]) => k !== "ai");   // 도형 과제의 '사용한 도구'에는 AI 항목이 없습니다
  const CHECKS = [
    ["sh_k0", "AI를 쓰지 않았고, 모든 곡선의 종류·계수와 벡터, 꼭짓점을 스스로 정했다"],
    ["sh_k1", "사진을 좌표평면에 맞추고 모델의 기준이 될 꼭짓점을 골랐다"],
    ["sh_k2", "곡선과 벡터가 물체의 어느 부위를 맡는지 모두 적었다"],
    ["sh_k3", "곡선의 연결·대칭과 벡터의 역할을 수학적 근거로 설명했다"],
    ["sh_k4", "위치(벡터의 거리)와 방향(내적으로 구한 각도) 정확도를 확인하고 한계와 개선점을 썼다"]
  ];
  const HELP = {
    sh_obj: "디자인할 실생활 물체의 이름입니다. 예: 컴퓨터 마우스, 자동차 옆모습, 다리(교량), 로고",
    sh_reason: "이 물체를 고른 이유와, 물체에서 찾은 수학적 요소(곡선의 모양, 대칭, 방향)를 씁니다.",
    sh_map_part: "물체를 나눈 부위입니다. 예: 상단 헤드, 스크롤 휠, 클릭 버튼",
    sh_map_math: "그 부위를 나타낼 2D 수학 요소입니다. 예: 제한된 타원, 포물선, 벡터",
    sh_map_desc: "예상하는 모양과 범위를 어떻게 제한할지 씁니다. 수식은 [수식] 단추로 넣습니다. 예: $x^2+y^2=4\\ (-2\\le x\\le 2)$",
    sh_img: "모델링할 물체 사진입니다. 컬러로 250KB 이하로 줄여 내 폴더에 저장되고, 좌표평면에 반투명하게 깔립니다.",
    sh_pts: "사진에서 모델이 꼭 지나야 할 점(꼭짓점, 끝점, 가장 높은 점 등)입니다. 이 점들로 모델의 정확도를 잽니다.",
    sh_c_par: "계수 a, b는 가로·세로 반지름(크기), c, d는 중심(또는 꼭짓점)의 좌표입니다. 값을 바꾸면 그래프가 바로 움직입니다.",
    sh_c_dom: "곡선의 일부만 쓰려면 x·y 범위를 넣습니다. 빈칸은 제한 없음입니다.",
    sh_c_role: "이 곡선이 물체의 어느 부위를 맡는지 씁니다. 예: 마우스 상단 곡면",
    sh_v_par: "시점 $(x_0,y_0)$과 성분 $(v_1,v_2)$를 넣으면 화살표가 그려집니다. 종점은 $(x_0+v_1,\\ y_0+v_2)$입니다.",
    sh_v_meaning: "이 벡터가 물체에서 하는 구조적·디자인적 역할(선)입니다. 예: 마우스 좌우 대칭 기준선",
    sh_tol: "꼭짓점 P와 모델 위의 가장 가까운 점 Q 사이의 벡터 $\\overrightarrow{QP}$의 크기가 이 값(좌표 단위) 이하이면 '일치'로 셉니다.",
    sh_tolA: "사진 기준선 $\\vec u$와 모델 벡터 $\\vec v$의 사이각 $\\theta$가 이 각도(°) 이하이면 '일치'로 셉니다.",
    sh_v_ref: "사진에서 이 벡터가 나타내는 실제 선의 시작점 A와 끝점 B를 1단계 꼭짓점에서 고릅니다. $\\vec u=\\overrightarrow{AB}$와 모델 $\\vec v$의 내적으로 사이각을 구합니다.",
    sh_a1: "곡선이 이어지는 점의 좌표가 같은지(연속), 어떤 축·점에 대해 대칭인지 식과 좌표로 보입니다.",
    sh_a2: "벡터의 시점·종점, 성분, 크기 $|\\vec v|=\\sqrt{v_1^2+v_2^2}$ 등을 써서 벡터가 구조에서 하는 역할을 설명합니다.",
    sh_a3: "위치 정확도(벡터의 거리)와 방향 정확도(내적으로 구한 각도)를 근거로 모델이 실제 물체와 얼마나 닮았는지, 어긋난 점과 그 이유, 고칠 방법을 씁니다.",
    sh_url: "예전에 입력한 작품 공유 링크입니다. 지금은 이 칸을 쓰지 않습니다.",
    sh_shot: "다른 도구로 만든 화면을 캡처해 올립니다(선택, 흑백 50KB 이하로 줄여 보고서에 들어갑니다).",
    sh_r1: "가장 어려웠던 장면을 하나 이상 골라 ① 몇 단계, 어느 부위(곡선·벡터·꼭짓점)에서 ② 무엇이 왜 어려웠는지 ③ 계수·범위·성분을 어떻게 바꿔 보며 해결했는지(바꾸기 전과 후의 값, 정확도의 변화) ④ 그 과정에서 새로 알게 된 수학 개념을 씁니다.",
    sh_r2: "① 작품에서 가장 잘 표현된 부분과 그 이유 ② 실제 물체와 가장 달라 보이는 부분과 그 원인(위치·방향 일치율, 평균 거리·각도 차를 근거로) ③ 다시 만든다면 바꿀 곡선·벡터와 그때 기대되는 변화 ④ 이차곡선과 벡터로 실생활 물체를 표현해 보며 생각한 점을 씁니다.",
    sh_src: "참고한 자료(사진, 사이트, 책)와 그 주소를 적습니다. 물체 사진을 직접 찍지 않았다면 출처를 꼭 적습니다.",
    sh_tool: "체크한 도구마다 ① 몇 단계에서 ② 무엇을 하려고 ③ 어떻게 썼는지 ④ 도구가 보여 준 결과를 손 계산이나 다른 방법으로 어떻게 확인했는지 씁니다. 이 과제는 AI를 쓸 수 없습니다."
  };

  /* ───── 숫자 ───── */
  const num = v => { const s = String(v == null ? "" : v).trim(); if (s === "") return NaN; const n = +s; return isFinite(n) ? n : NaN; };
  const fm = (v, k) => { if (!isFinite(v)) return "–"; const p = Math.pow(10, k == null ? 3 : k); return String(Math.round(v * p) / p); };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /** 좌표평면 설정(빈칸은 기본값) */
  function cv(doc) {
    const c = doc.canvas || {}, R = RANGES.includes(+c.R) ? +c.R : 10, w = num(c.w), op = num(c.op), tol = num(c.tol), tolA = num(c.tolA);
    return { R, op: isNaN(op) ? 0.55 : clamp(op, 0, 1), rot: num(c.rot) || 0, tx: num(c.tx) || 0, ty: num(c.ty) || 0, w: w > 0 ? w : R * 1.6, tol: tol > 0 ? tol : 0.2, tolA: tolA > 0 ? tolA : 5, img: c.img || null };
  }
  /** 곡선 계수를 숫자로. ok=false 이면 그릴 수 없음 */
  function conicK(it) {
    it = it || {}; const type = normType(it.type), a = num(it.a), b = num(it.b), c = num(it.c), d = num(it.d);
    const k = { type, a, b: type === "원" ? a : b, c: isNaN(c) ? 0 : c, d: isNaN(d) ? 0 : d, xmin: num(it.xmin), xmax: num(it.xmax), ymin: num(it.ymin), ymax: num(it.ymax) };
    k.ok = /^포물선/.test(type) ? isFinite(a) && a !== 0 : a > 0 && k.b > 0;
    return k;
  }
  function vecK(it) {
    it = it || {}; const x0 = num(it.x0), y0 = num(it.y0), v1 = num(it.v1), v2 = num(it.v2);
    const ok = [x0, y0, v1, v2].every(isFinite) && (v1 !== 0 || v2 !== 0);
    return { x0, y0, v1, v2, ok, x1: x0 + v1, y1: y0 + v2, len: Math.hypot(v1, v2) };
  }
  const inDom = (k, x, y) => !(x < k.xmin - 1e-9 || x > k.xmax + 1e-9 || y < k.ymin - 1e-9 || y > k.ymax + 1e-9);   // NaN 은 비교가 거짓 → 제한 없음
  /** 곡선을 점들로(범위 제한을 지키고, 끊긴 곳에서 나눔) → [[ [x,y], ... ], ...] */
  function conicSegs(k, R) {
    if (!k.ok) return [];
    const L = R * 3, raw = [], N = 720;
    const { type, a, b, c, d } = k;
    if (type === "타원" || type === "원") { const s = []; for (let i = 0; i <= N; i++) { const t = 2 * Math.PI * i / N; s.push([c + a * Math.cos(t), d + b * Math.sin(t)]); } raw.push(s); }
    else if (type === "쌍곡선 (좌우)") { const U = Math.asinh(L / b); [1, -1].forEach(sg => { const s = []; for (let i = 0; i <= N; i++) { const u = -U + 2 * U * i / N; s.push([c + sg * a * Math.cosh(u), d + b * Math.sinh(u)]); } raw.push(s); }); }
    else if (type === "쌍곡선 (상하)") { const U = Math.asinh(L / a); [1, -1].forEach(sg => { const s = []; for (let i = 0; i <= N; i++) { const u = -U + 2 * U * i / N; s.push([c + a * Math.sinh(u), d + sg * b * Math.cosh(u)]); } raw.push(s); }); }
    else if (type === "포물선 (위아래)") { const s = []; for (let i = 0; i <= N; i++) { const x = c - L + 2 * L * i / N; s.push([x, d + a * (x - c) * (x - c)]); } raw.push(s); }
    else { const s = []; for (let i = 0; i <= N; i++) { const y = d - L + 2 * L * i / N; s.push([c + a * (y - d) * (y - d), y]); } raw.push(s); }
    const out = [];
    raw.forEach(s => { let cur = []; s.forEach(([x, y]) => { if (inDom(k, x, y) && Math.abs(x) <= L && Math.abs(y) <= L) cur.push([x, y]); else { if (cur.length > 1) out.push(cur); cur = []; } }); if (cur.length > 1) out.push(cur); });
    return out;
  }
  /** 모든 곡선·벡터를 이름과 함께 선분 묶음으로 */
  function allShapes(doc) {
    const R = cv(doc).R, out = [];
    (doc.conics || []).forEach((it, i) => { const k = conicK(it); if (k.ok) out.push({ name: `곡선 #${i + 1}`, segs: conicSegs(k, R) }); });
    (doc.vecs || []).forEach((it, i) => { const v = vecK(it); if (v.ok) out.push({ name: `벡터 #${i + 1}`, segs: [[[v.x0, v.y0], [v.x1, v.y1]]] }); });
    return out;
  }
  /** 점 P에서 선분 AB 위의 가장 가까운 점 Q */
  function nearOnSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = clamp(t, 0, 1);
    return [ax + t * dx, ay + t * dy];
  }
  const ptList = doc => (doc.pts || []).map((p, i) => ({ i, n: String((p || {}).n || `P${i + 1}`), x: num((p || {}).x), y: num((p || {}).y) })).filter(p => isFinite(p.x) && isFinite(p.y));
  /** 이름으로 꼭짓점 찾기. 같은 이름이 둘 이상이면 어느 점인지 알 수 없으므로 null(각도 계산에서 빠지고 안내가 나옴) */
  const ptByName = (doc, n) => { n = String(n == null ? "" : n).trim(); const m = ptList(doc).filter(p => p.n === n); return m.length === 1 ? m[0] : null; };
  const dupName = (doc, n) => { n = String(n == null ? "" : n).trim(); return !!n && ptList(doc).filter(p => p.n === n).length > 1; };
  /* 정확도 결과는 곡선·벡터·점·허용값이 그대로면 다시 계산하지 않습니다(한 화면에서 여러 곳이 같은 값을 씀) */
  const memo = new WeakMap();
  function cached(doc, key, fn) {
    const c = doc.canvas || {}, sig = JSON.stringify([doc.conics, doc.vecs, doc.pts, c.R, c.tol, c.tolA]);
    let m = memo.get(doc); if (!m) memo.set(doc, m = {});
    if (m[key] && m[key].sig === sig) return m[key].v;
    const v = fn(); m[key] = { sig, v }; return v;
  }
  const accuracy = doc => cached(doc, "acc", () => accuracy0(doc));
  const angleAcc = doc => cached(doc, "ang", () => angleAcc0(doc));
  /** ① 위치 정확도(벡터의 거리): 꼭짓점 P마다 모델 위의 가장 가까운 점 Q, QP→ = (xP−xQ, yP−yQ), |QP→| = √(…) ≤ 허용 거리이면 일치 */
  function accuracy0(doc) {
    const C = cv(doc), shapes = allShapes(doc), pts = ptList(doc);
    if (!pts.length || !shapes.length) return null;
    const rows = pts.map(p => { let best = Infinity, who = "", q = [NaN, NaN];
      shapes.forEach(s => s.segs.forEach(seg => { for (let j = 1; j < seg.length; j++) { const Q = nearOnSeg(p.x, p.y, seg[j - 1][0], seg[j - 1][1], seg[j][0], seg[j][1]), dd = Math.hypot(p.x - Q[0], p.y - Q[1]); if (dd < best) { best = dd; who = s.name; q = Q; } } }));
      return { n: p.n, x: p.x, y: p.y, qx: q[0], qy: q[1], dx: p.x - q[0], dy: p.y - q[1], d: best, who, ok: best <= C.tol }; });
    const ok = rows.filter(r => r.ok).length;
    return { rows, tol: C.tol, mean: rows.reduce((s, r) => s + r.d, 0) / rows.length, max: Math.max(...rows.map(r => r.d)), rate: ok / rows.length * 100, ok, n: rows.length };
  }
  /** ② 방향 정확도(벡터의 내적): 사진 기준선 u→ = AB→ 와 모델 벡터 v→ 의 사이각 θ, cosθ = (u→·v→)/(|u→||v→|) ≤ 허용 각도이면 일치 */
  function angleAcc0(doc) {
    const C = cv(doc), rows = [];
    (doc.vecs || []).forEach((it, i) => { it = it || {}; const v = vecK(it), A = ptByName(doc, it.pa), B = ptByName(doc, it.pb);
      if (!v.ok || !A || !B) return;
      const u1 = B.x - A.x, u2 = B.y - A.y, lu = Math.hypot(u1, u2); if (!lu) return;
      const dot = u1 * v.v1 + u2 * v.v2, cos = clamp(dot / (lu * v.len), -1, 1), th = Math.acos(cos) * 180 / Math.PI;
      rows.push({ i, name: `벡터 v${i + 1}`, a: A.n, b: B.n, u1, u2, v1: v.v1, v2: v.v2, dot, lu, lv: v.len, cos, th, ok: th <= C.tolA, ax: A.x, ay: A.y }); });
    if (!rows.length) return null;
    const ok = rows.filter(r => r.ok).length;
    return { rows, tolA: C.tolA, mean: rows.reduce((s, r) => s + r.th, 0) / rows.length, max: Math.max(...rows.map(r => r.th)), rate: ok / rows.length * 100, ok, n: rows.length };
  }

  /* ───── 식(LaTeX)·기하학적 요소 ───── */
  const sh = (v, s) => v === 0 ? s : `${s}${v > 0 ? "-" : "+"}${fm(Math.abs(v))}`;           // x-c
  const sq = (v, s) => v === 0 ? `${s}^2` : `(${sh(v, s)})^2`;                                  // (x-c)^2
  const coef = a => a === 1 ? "" : a === -1 ? "-" : fm(a);
  function conicTex(k) {
    if (!k.ok) return "";
    const { type, a, b, c, d } = k, fx = `\\left(\\frac{${sh(c, "x")}}{${fm(a)}}\\right)^2`, fy = `\\left(\\frac{${sh(d, "y")}}{${fm(b)}}\\right)^2`;
    if (type === "타원") return `${fx}+${fy}=1`;
    if (type === "원") return `${sq(c, "x")}+${sq(d, "y")}=${fm(a * a)}`;
    if (type === "쌍곡선 (좌우)") return `${fx}-${fy}=1`;
    if (type === "쌍곡선 (상하)") return `${fx}-${fy}=-1`;
    if (type === "포물선 (위아래)") return `${sh(d, "y")}=${coef(a)}${sq(c, "x")}`;
    return `${sh(c, "x")}=${coef(a)}${sq(d, "y")}`;
  }
  function domTex(k) {
    const one = (lo, hi, v) => isFinite(lo) && isFinite(hi) ? `${fm(lo)}\\le ${v}\\le ${fm(hi)}` : isFinite(lo) ? `${v}\\ge ${fm(lo)}` : isFinite(hi) ? `${v}\\le ${fm(hi)}` : "";
    return [one(k.xmin, k.xmax, "x"), one(k.ymin, k.ymax, "y")].filter(Boolean).join(",\\ ");
  }
  const pt = (x, y) => `(${fm(x)}, ${fm(y)})`;
  function conicProps(k) {
    if (!k.ok) return "";
    const { type, a, b, c, d } = k;
    if (type === "원") return `중심 ${pt(c, d)}, 반지름 ${fm(a)}`;
    if (type === "타원") { const f = Math.sqrt(Math.abs(a * a - b * b)); return `중심 ${pt(c, d)}, 가로 반지름 ${fm(a)}, 세로 반지름 ${fm(b)}` + (a === b ? " (원)" : a > b ? `, 초점 ${pt(c - f, d)}·${pt(c + f, d)}` : `, 초점 ${pt(c, d - f)}·${pt(c, d + f)}`); }
    const f = Math.sqrt(a * a + b * b), asy = `점근선 $${sh(d, "y")}=\\pm ${fm(b / a)}(${sh(c, "x")})$`;
    if (type === "쌍곡선 (좌우)") return `중심 ${pt(c, d)}, 꼭짓점 ${pt(c - a, d)}·${pt(c + a, d)}, 초점 ${pt(c - f, d)}·${pt(c + f, d)}, ${asy}`;
    if (type === "쌍곡선 (상하)") return `중심 ${pt(c, d)}, 꼭짓점 ${pt(c, d - b)}·${pt(c, d + b)}, 초점 ${pt(c, d - f)}·${pt(c, d + f)}, ${asy}`;
    const p = 1 / (4 * a);
    if (type === "포물선 (위아래)") return `꼭짓점 ${pt(c, d)}, 초점 ${pt(c, d + p)}, 준선 $y=${fm(d - p)}$, ${a > 0 ? "위로" : "아래로"} 열림`;
    return `꼭짓점 ${pt(c, d)}, 초점 ${pt(c + p, d)}, 준선 $x=${fm(c - p)}$, ${a > 0 ? "오른쪽으로" : "왼쪽으로"} 열림`;
  }
  const vecTex = v => v.ok ? `\\vec{v}=(${fm(v.v1)},\\ ${fm(v.v2)})` : "";

  /* ───── 좌표평면 그리기 (SVG) ───── */
  const imgCache = {};   // 파일 id → data URL (index.html 의 fileCache 도 함께 씁니다)
  const imgSrc = id => imgCache[id] || (typeof fileCache !== "undefined" && fileCache[id]) || "";
  const loadingImg = {};
  function loadImg(doc, owner, then) {
    const C = cv(doc); if (!C.img || !C.img.id || imgSrc(C.img.id) || loadingImg[C.img.id]) return;
    const id = C.img.id; loadingImg[id] = 1;
    api("getFile", { id, owner }).then(r => { imgCache[id] = `data:${r.mime};base64,${r.b64}`; delete loadingImg[id]; if (then) then(); }).catch(() => { delete loadingImg[id]; });
  }
  /* 좌표평면은 세 겹: 격자(sh-grid) · 사진(sh-img) · 곡선·벡터·점(sh-ovl).
   * 입력할 때는 사진 <image> 를 다시 만들지 않고 위치·투명도 속성만 바꾸고, 겹(sh-ovl)만 다시 그립니다(사진 data URL 을 매번 다시 읽지 않게). */
  const frame = (doc, o) => { const C = cv(doc), R = C.R, S = (o && o.S) || 600; return { C, R, S, X: x => (x + R) / (2 * R) * S, Y: y => (R - y) / (2 * R) * S }; };
  function gridSVG(F) {
    const { R, S, X, Y } = F, step = R <= 10 ? 1 : R <= 20 ? 2 : 5, lab = R <= 10 ? 2 : R <= 20 ? 4 : 10;
    let g = "";
    for (let v = -R; v <= R + 1e-9; v += step) {
      const ax = Math.abs(v) < 1e-9;
      g += `<line x1="${X(v)}" y1="0" x2="${X(v)}" y2="${S}" stroke="${ax ? "#64748B" : "#E2E8F0"}" stroke-width="${ax ? 1.4 : 0.8}"/><line x1="0" y1="${Y(v)}" x2="${S}" y2="${Y(v)}" stroke="${ax ? "#64748B" : "#E2E8F0"}" stroke-width="${ax ? 1.4 : 0.8}"/>`;
      if (!ax && Math.abs(Math.round(v / lab) * lab - v) < 1e-9) g += `<text x="${X(v)}" y="${Y(0) + 14}" font-size="11" text-anchor="middle" fill="#64748B">${fm(v)}</text><text x="${X(0) - 5}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#64748B">${fm(v)}</text>`;
    }
    return g + `<text x="${S - 6}" y="${Y(0) - 6}" font-size="12" text-anchor="end" fill="#334155" font-style="italic">x</text><text x="${X(0) + 6}" y="14" font-size="12" fill="#334155" font-style="italic">y</text>`;
  }
  /** 사진의 위치·크기·회전·투명도(SVG 속성 값) */
  function imgGeom(F) {
    const { C, R, S, X, Y } = F; if (!C.img || !C.img.w || !C.img.h) return null;
    const w = C.w / (2 * R) * S, h = w * C.img.h / C.img.w, cx = X(C.tx), cy = Y(C.ty);
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, opacity: C.op, transform: `rotate(${-C.rot} ${cx} ${cy})` };
  }
  function imgSVG(doc, F) {
    const G = imgGeom(F); if (!G) return "";
    const src = imgSrc(F.C.img.id);
    return src ? `<image href="${src}" xlink:href="${src}" x="${G.x}" y="${G.y}" width="${G.width}" height="${G.height}" opacity="${G.opacity}" preserveAspectRatio="none" transform="${G.transform}"/>`
      : `<text x="${F.S / 2}" y="${F.S / 2}" text-anchor="middle" font-size="14" fill="#94A3B8">사진 불러오는 중…</text>`;
  }
  /** 곡선·벡터·(정확도 보기) 거리 벡터·기준선·꼭짓점 */
  function overlaySVG(doc, o, F) {
    const { R, S, X, Y } = F; let sh2 = "";
    (doc.conics || []).forEach((it, i) => { const k = conicK(it), col = COLORS[i % COLORS.length];
      conicSegs(k, R).forEach(seg => { sh2 += `<polyline points="${seg.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`; });
      if (k.ok && o.labels !== false) sh2 += `<text x="${X(k.c) + 4}" y="${Y(k.d) - 4}" font-size="11" fill="${col}" font-weight="700">#${i + 1}</text>`; });
    (doc.vecs || []).forEach((it, i) => { const v = vecK(it), col = VCOLORS[i % VCOLORS.length]; if (!v.ok) return;
      const x0 = X(v.x0), y0 = Y(v.y0), x1 = X(v.x1), y1 = Y(v.y1), ang = Math.atan2(y1 - y0, x1 - x0), L = 12, W = 6;
      const hx = x1 - L * Math.cos(ang), hy = y1 - L * Math.sin(ang);
      sh2 += `<line x1="${x0}" y1="${y0}" x2="${hx}" y2="${hy}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/><polygon points="${x1},${y1} ${hx + W * Math.sin(ang)},${hy - W * Math.cos(ang)} ${hx - W * Math.sin(ang)},${hy + W * Math.cos(ang)}" fill="${col}"/><circle cx="${x0}" cy="${y0}" r="3" fill="${col}"/>`;
      if (o.labels !== false) sh2 += `<text x="${(x0 + x1) / 2 + 5}" y="${(y0 + y1) / 2 - 5}" font-size="11" fill="${col}" font-weight="700">v${i + 1}</text>`; });
    const acc = o.acc ? accuracy(doc) : null, okOf = {}; if (acc) acc.rows.forEach(r => { okOf[r.n + "|" + r.x + "|" + r.y] = r.ok; });
    let pp = "";
    if (o.acc) {   // 정확도 보기: 사진 기준선 AB→(점선 화살표)와 거리 벡터 QP→(모델 위의 점 Q → 꼭짓점 P)
      const ang = angleAcc(doc);
      if (ang) ang.rows.forEach(r => { const col = VCOLORS[r.i % VCOLORS.length], x0 = X(r.ax), y0 = Y(r.ay), x1 = X(r.ax + r.u1), y1 = Y(r.ay + r.u2), t = Math.atan2(y1 - y0, x1 - x0), hx = x1 - 10 * Math.cos(t), hy = y1 - 10 * Math.sin(t);
        pp += `<line x1="${x0}" y1="${y0}" x2="${hx}" y2="${hy}" stroke="${col}" stroke-width="2" stroke-dasharray="6 4" opacity=".75"/><polygon points="${x1},${y1} ${hx + 5 * Math.sin(t)},${hy - 5 * Math.cos(t)} ${hx - 5 * Math.sin(t)},${hy + 5 * Math.cos(t)}" fill="none" stroke="${col}" stroke-width="1.6" opacity=".85"/>`
          + `<text x="${(x0 + x1) / 2 - 8}" y="${(y0 + y1) / 2 + 14}" font-size="11" text-anchor="end" fill="${col}" font-weight="700" stroke="#fff" stroke-width="3" paint-order="stroke">θ${r.i + 1}=${fm(r.th, 1)}°</text>`; });
      if (acc) acc.rows.forEach(r => { if (r.d > 1e-6) pp += `<line x1="${X(r.qx)}" y1="${Y(r.qy)}" x2="${X(r.x)}" y2="${Y(r.y)}" stroke="${r.ok ? "#16A34A" : "#DC2626"}" stroke-width="1.6"/><circle cx="${X(r.qx)}" cy="${Y(r.qy)}" r="2.5" fill="${r.ok ? "#16A34A" : "#DC2626"}"/>`; });
    }
    ptList(doc).forEach(p => { const k = okOf[p.n + "|" + p.x + "|" + p.y], col = k === true ? "#16A34A" : k === false ? "#DC2626" : "#0EA5E9";
      if (acc) pp += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${acc.tol / (2 * R) * S}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-width=".8" stroke-dasharray="3 3"/>`;
      pp += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="#fff" stroke="${col}" stroke-width="2.4"/><text x="${X(p.x) + 8}" y="${Y(p.y) - 7}" font-size="12" font-weight="700" fill="${col}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(p.n)}</text>`; });
    return sh2 + pp;
  }
  /** o: {S 크기px, acc 정확도 색, pick 점 찍기, noImg 사진 빼기(PNG용), noBg, labels} */
  function planeSVG(doc, o) {
    o = o || {}; const F = frame(doc, o), S = F.S;
    const bg = o.noBg ? "" : `<rect width="${S}" height="${S}" fill="#fff"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${o.px || S}" height="${o.px || S}" font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif" class="sh-svg${o.pick ? " picking" : ""}" role="img" aria-label="좌표평면: 사진, 곡선, 벡터, 꼭짓점">
  <defs><clipPath id="shclip"><rect width="${S}" height="${S}"/></clipPath></defs>${bg}<g clip-path="url(#shclip)"><g class="sh-grid">${gridSVG(F)}</g><g class="sh-img">${o.noImg ? "" : imgSVG(doc, F)}</g><g class="sh-ovl">${overlaySVG(doc, o, F)}</g></g><rect width="${S}" height="${S}" fill="none" stroke="#CBD5E1"/></svg>`;
  }
  /** 화면의 좌표평면 갱신: 범위·사진이 그대로면 사진은 속성만, 곡선·점 겹만 다시 그립니다 */
  function updatePlane(el, doc, o) {
    const F = frame(doc, o), C = F.C, key = [C.R, C.img ? C.img.id : "", C.img && imgSrc(C.img.id) ? 1 : 0, o.acc ? 1 : 0].join("|"), svg = el.querySelector("svg.sh-svg");
    if (!svg || el.dataset.k !== key) { el.innerHTML = planeSVG(doc, o); el.dataset.k = key; return; }
    svg.classList.toggle("picking", !!o.pick);
    const im = svg.querySelector(".sh-img image"), G = imgGeom(F);
    if (im && G) Object.keys(G).forEach(a => im.setAttribute(a, G[a]));
    svg.querySelector(".sh-ovl").innerHTML = overlaySVG(doc, o, F);
  }
  let pick = false;   // [점 찍기] 켜짐
  function refreshPlanes(root, doc, owner) {
    root.querySelectorAll("[data-plane]").forEach(el => { updatePlane(el, doc, { acc: el.dataset.plane === "acc", pick: pick && el.dataset.plane === "pick" }); });
    root.querySelectorAll("[data-sheq]").forEach(el => { const k = conicK((doc.conics || [])[+el.dataset.sheq]), t = conicTex(k), dm = domTex(k);
      el.innerHTML = k.ok ? MathTool.render(`$${t}$${dm ? `  $(${dm})$` : ""}`) : '<span class="sub">계수를 넣으면 식이 나타납니다.</span>'; });
    root.querySelectorAll("[data-shprop]").forEach(el => { const k = conicK((doc.conics || [])[+el.dataset.shprop]); el.innerHTML = k.ok ? MathTool.render(conicProps(k)) : "–"; });
    root.querySelectorAll("[data-shvec]").forEach(el => { const v = vecK((doc.vecs || [])[+el.dataset.shvec]);
      el.innerHTML = v.ok ? MathTool.render(`$${vecTex(v)}$ · 종점 ${pt(v.x1, v.y1)} · 크기 $|\\vec v|=${fm(v.len)}$`) : '<span class="sub">시점과 성분을 모두 넣으면 화살표가 그려집니다.</span>'; });
    root.querySelectorAll("[data-shref]").forEach(el => { el.innerHTML = refHint(doc, (doc.vecs || [])[+el.dataset.shref] || {}); mathPass(el); });   // 기준선 A·B 를 고르면 바로 u→ 표시
    root.querySelectorAll("[data-shacc]").forEach(el => { el.innerHTML = accHTML(doc); mathPass(el); });
    if (doc.canvas && doc.canvas.img) loadImg(doc, owner, () => refreshPlanes(root, doc, owner));
  }
  const okPill = ok => ok ? '<span class="pill sub">일치</span>' : '<span class="pill live">벗어남</span>';
  const vt = (a, b) => `(${fm(a)},\\ ${fm(b)})`;
  const rate = r => r >= 80 ? "ok" : r >= 50 ? "" : "warn";
  function accHTML(doc) {
    const A = accuracy(doc), G = angleAcc(doc);
    const tiles = `<div class="sh-acc">
      <div><small>① 위치 일치율 (거리)</small><b class="${A ? rate(A.rate) : ""}">${A ? fm(A.rate, 1) + "%" : "–"}</b><span>${A ? `${A.ok} / ${A.n}점이 $|\\overrightarrow{QP}|\\le ${fm(A.tol)}$` : "꼭짓점과 곡선·벡터가 필요합니다"}</span></div>
      <div><small>평균 거리 $|\\overrightarrow{QP}|$</small><b>${A ? fm(A.mean) : "–"}</b><span>${A ? `좌표 단위 · 가장 먼 점 ${fm(A.max)}` : ""}</span></div>
      <div><small>② 방향 일치율 (각도)</small><b class="${G ? rate(G.rate) : ""}">${G ? fm(G.rate, 1) + "%" : "–"}</b><span>${G ? `${G.ok} / ${G.n}개 벡터가 $\\theta\\le ${fm(G.tolA, 1)}^\\circ$` : "3단계에서 벡터의 사진 기준선을 고르세요"}</span></div>
      <div><small>평균 각도 차 $\\theta$</small><b>${G ? fm(G.mean, 2) + "°" : "–"}</b><span>${G ? `가장 큰 차 ${fm(G.max, 2)}°` : ""}</span></div></div>`;
    const t1 = A ? `<h4 class="sh-h">① 위치: 벡터의 거리 계산 ${tx("$\\overrightarrow{QP}=(x_P-x_Q,\\ y_P-y_Q)$,  $|\\overrightarrow{QP}|=\\sqrt{(x_P-x_Q)^2+(y_P-y_Q)^2}$")}</h4>
      <div class="tbl-wrap"><table class="t sh-num"><thead><tr><th>꼭짓점 $P$</th><th>모델 위의 점 $Q$</th><th>$\\overrightarrow{QP}$</th><th>$|\\overrightarrow{QP}|$</th><th>가장 가까운 선</th><th>일치</th></tr></thead><tbody>${A.rows.map(r => `<tr><td class="lab">${esc(r.n)} ${pt(r.x, r.y)}</td><td class="num">${pt(r.qx, r.qy)}</td><td class="num">${tx(`$${vt(r.dx, r.dy)}$`)}</td><td class="num">${fm(r.d)}</td><td>${esc(r.who)}</td><td>${okPill(r.ok)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="sub">${ptList(doc).length ? "곡선이나 벡터를 하나 이상 그리면 위치 정확도가 계산됩니다." : "1단계에서 사진 위에 꼭짓점을 찍으면 위치 정확도가 계산됩니다."}</p>`;
    const t2 = G ? `<h4 class="sh-h">② 방향: 내적으로 각도 계산 ${tx("$\\cos\\theta=\\dfrac{\\vec u\\cdot\\vec v}{|\\vec u||\\vec v|}=\\dfrac{u_1v_1+u_2v_2}{|\\vec u||\\vec v|}$")}</h4>
      <div class="tbl-wrap"><table class="t sh-num"><thead><tr><th>벡터</th><th>사진 기준선 $\\vec u=\\overrightarrow{AB}$</th><th>모델 $\\vec v$</th><th>$\\vec u\\cdot\\vec v$</th><th>$|\\vec u|$, $|\\vec v|$</th><th>$\\cos\\theta$</th><th>$\\theta$</th><th>일치</th></tr></thead><tbody>${G.rows.map(r => `<tr><td class="lab">v${r.i + 1}<div class="sub">${esc(r.a)} → ${esc(r.b)}</div></td><td class="num">${tx(`$${vt(r.u1, r.u2)}$`)}</td><td class="num">${tx(`$${vt(r.v1, r.v2)}$`)}</td><td class="num">${fm(r.dot)}</td><td class="num">${fm(r.lu)} · ${fm(r.lv)}</td><td class="num">${fm(r.cos, 5)}</td><td class="num"><b>${fm(r.th, 2)}°</b></td><td>${okPill(r.ok)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="sub">3단계 벡터 카드에서 '사진 기준선'의 시작점 A와 끝점 B(1단계에서 찍은 꼭짓점)를 고르면 방향 정확도가 계산됩니다.</p>`;
    return tiles.replace(/\$[^$]+\$/g, m => tx(m)) + t1.replace(/<th>([^<]*\$[^<]*)<\/th>/g, (m, h) => `<th>${tx(h)}</th>`) + t2.replace(/<th>([^<]*\$[^<]*)<\/th>/g, (m, h) => `<th>${tx(h)}</th>`);
  }

  /* ───── 기록 ───── */
  function blank() {
    return { v: 2, kind: "shape", info: {}, ans: {}, canvas: {}, pts: [], maps: [{}], conics: [{ type: "타원", a: "3", b: "2", c: "0", d: "0" }], vecs: [{}], checks: {}, tools: {}, photos: {}, status: "draft",
      data: {}, models: {}, calc: {} };   // data·models·calc: 모델링 공용 함수가 빈 값으로 안전하게 지나가도록
  }
  /** 서버에서 받은 기록을 화면에 맞게 다듬습니다(배열이 없으면 만들기, 탐구 대상 → 제목). */
  function afterLoad(doc) {
    ["maps", "conics", "vecs", "pts"].forEach(k => { if (!Array.isArray(doc[k])) doc[k] = []; });
    if (!doc.canvas || typeof doc.canvas !== "object") doc.canvas = {};
    doc.kind = "shape";
    if (doc.ans && doc.ans.sh_obj) doc.info.title = doc.ans.sh_obj;
  }
  const filled = v => String(v == null ? "" : v).trim() !== "";
  const LIST_NEW = { maps: () => ({}), conics: () => ({ type: "타원", a: "3", b: "2", c: "0", d: "0" }), vecs: () => ({}), pts: () => ({}) };
  const conicDone = it => conicK(it).ok && filled((it || {}).role);
  const vecDone = it => vecK(it).ok && filled((it || {}).meaning);
  function listFrac(arr, goal, parts) { const tot = Math.max(arr.length, goal) * parts.length; let have = 0; arr.forEach(it => parts.forEach(f => { if (f(it || {})) have++; })); return tot ? Math.min(1, have / tot) : 0; }
  function progress(doc) {
    const a = doc.ans || {}, ck = doc.checks || {};
    const mapF = listFrac(doc.maps || [], GOAL.maps, [m => filled(m.part), m => filled(m.math), m => filled(m.desc)]);
    const s0 = ([filled(a.sh_obj), filled(a.sh_reason), !!cv(doc).img].filter(Boolean).length + Math.min(1, ptList(doc).length / GOAL.pts) + mapF) / 5;
    const s1 = listFrac(doc.conics || [], GOAL.conics, [it => conicK(it).ok, it => filled(it.role)]);
    const s2 = listFrac(doc.vecs || [], GOAL.vecs, [it => vecK(it).ok, it => filled(it.meaning), it => !!(ptByName(doc, it.pa) && ptByName(doc, it.pb))]);
    const s3 = (ANALYSIS.filter(([k]) => filled(a[k])).length + (accuracy(doc) ? 1 : 0) + (angleAcc(doc) ? 1 : 0)) / (ANALYSIS.length + 2);
    const s4 = (CHECKS.filter(([k]) => ck[k]).length / CHECKS.length + [a.sh_r1, a.sh_r2, a.sh_tool].filter(filled).length) / 4;
    return [s0, s1, s2, s3, s4];
  }
  function homeProgress(doc) { const a = doc.ans || {}; return [a.sh_obj, a.sh_src, a.sh_tool].filter(filled).length / 3; }
  function summary(doc) {
    const p = progress(doc), u = String((doc.ans || {}).sh_url || "").trim(), A = accuracy(doc), G = angleAcc(doc);
    return { progress: Math.round(p.reduce((x, y) => x + y, 0) / 5 * 100), nConic: (doc.conics || []).filter(conicDone).length, nVec: (doc.vecs || []).filter(vecDone).length,
      nPt: ptList(doc).length, acc: A ? Math.round(A.rate * 10) / 10 : null, dist: A ? Math.round(A.mean * 1000) / 1000 : null,
      accA: G ? Math.round(G.rate * 10) / 10 : null, ang: G ? Math.round(G.mean * 100) / 100 : null, url: /^https?:\/\//.test(u) ? u : "" };
  }

  /* ───── 사진 올리기: 컬러 그대로 250KB 이하 JPEG ───── */
  async function compressColor(file) {
    let src; try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no({ error: "BAD_FILE" }); im.src = URL.createObjectURL(file); }); }
    const W0 = src.width, H0 = src.height; let side = Math.min(1600, Math.max(W0, H0));
    for (let t = 0; t < 12; t++) {
      const k = side / Math.max(W0, H0), w = Math.max(1, Math.round(W0 * k)), h = Math.max(1, Math.round(H0 * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
      for (const q of [0.86, 0.78, 0.68, 0.58, 0.48]) { const b = await new Promise(r => c.toBlob(r, "image/jpeg", q)); if (b && b.size <= 250 * 1024) return { b64: await blobB64(b), size: b.size, w, h }; }
      side = Math.round(side * 0.82); if (side < 320) break;
    }
    throw { error: "BIG_FILE" };
  }
  function uploadImage() {
    pickFile("image/*", async file => {
      try {
        setSave("wait", "사진을 250KB 이하로 줄이는 중…"); const c = await compressColor(file);
        setSave("wait", `사진 올리는 중… (${kb(c.size)})`); const r = await api("upload", { kind: "image", key: "sh_img", b64: c.b64 });
        const R = cv(me).R, fitW = R * 1.6 * Math.min(1, c.w / c.h);   // 원점 중심에 판의 80% 크기로
        me.canvas = Object.assign({}, me.canvas || {}, { img: Object.assign({}, r.file, { w: c.w, h: c.h }), tx: "0", ty: "0", rot: "0", w: String(fm(fitW, 2)), op: (me.canvas || {}).op || "0.55" });
        imgCache[r.file.id] = "data:image/jpeg;base64," + c.b64;
        scheduleSave(); renderStudent.keepScroll = true; renderStudent(); setSave("ok", `사진을 올렸습니다 (${kb(c.size)}) · 좌표평면 가운데에 놓았습니다`);
      } catch (e) { setSave("err", errMsg(e)); }
    });
  }

  /* ───── 화면 조각 ───── */
  let inited = false;
  function init() {
    if (inited) return; inited = true;
    Object.assign(FIELD_HELP, HELP);   // 칸 이름 풍선(index.html 의 tipAttr)
    const st = document.createElement("style");
    st.textContent = `.sh-items{display:grid;gap:12px}
.sh-item{border:1px solid var(--line);border-left:5px solid var(--sc,var(--accent));border-radius:10px;padding:10px 12px;display:grid;gap:8px;background:var(--paper)}
.sh-item-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sh-item-h b{font-size:14px;color:var(--sc,var(--accent))}.sh-item-h .sp{flex:1}
.sh-item select,.sh-ctl select{border:1px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--fill);color:var(--ink);font:inherit;font-size:13px}
.sh-par{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:end}.sh-par label{display:grid;gap:2px;font-size:12px;color:var(--muted)}
.sh-par input{width:74px;border:1px solid var(--line);border-radius:6px;padding:4px 6px;background:var(--fill);color:var(--ink);font:inherit;font-size:13px}
.sh-par input:placeholder-shown{background:var(--good-soft)}.sh-par .sep{align-self:center;color:var(--muted);font-size:12px}
.sh-auto{font-size:13px;padding:6px 10px;background:var(--label);border-radius:6px;overflow-x:auto}
.sh-tools{padding:8px 12px;font-size:14px;line-height:1.6;min-width:0}.sh-toolguide{margin:0;padding-left:18px}.sh-toolguide li{margin:3px 0}
.sh-add{justify-self:start}.sh-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.sh-shot img{max-width:100%;border:1px solid var(--line);border-radius:8px}
.sh-plane{position:relative}.sh-plane svg{width:100%;height:auto;display:block;border-radius:10px;background:#fff;touch-action:manipulation}
.sh-plane svg.picking{cursor:crosshair;outline:3px solid var(--accent);outline-offset:-3px}
/* 좌표평면 + 옆 카드 한 묶음: 좌표평면은 이 묶음 안에서만 따라 내려와(sticky) 아래 카드와 겹치지 않습니다 */
.sh-pair{grid-column:span 12;display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:14px;align-items:start;min-width:0}
.sh-pair.rev{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}.sh-pair>.card{grid-column:auto}
.card.sh-sticky{position:sticky;top:calc(var(--toph,64px) + 64px);align-self:start;z-index:1}
@container (max-width:760px){.sh-pair,.sh-pair.rev{grid-template-columns:minmax(0,1fr)}.card.sh-sticky{position:static}}
.sh-ban{margin:0 0 12px;padding:8px 14px;border-radius:10px;background:var(--bad-soft);border:1px solid color-mix(in srgb,var(--bad) 45%,transparent);color:var(--ink);font-size:13.5px}.sh-ban b{color:var(--bad)}
.card.sh-banbox,.aibox.sh-banbox{background:var(--bad-soft);border:1.5px solid var(--bad);color:var(--ink)}.sh-banbox>b{color:var(--bad);font-size:16px}.sh-banbox ul{margin:6px 0 0;padding-left:20px;display:grid;gap:3px;font-size:14px}
table.t.sh-num td,table.t.sh-num th{white-space:nowrap;padding:6px 12px!important}table.t.sh-num td.num{font-variant-numeric:tabular-nums;text-align:right}
.sh-h{margin:14px 0 6px;font-size:14px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.sh-ref{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:8px 10px;font-size:13px}
.sh-sec{display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--line)}.sh-sec:first-child{border-top:0;padding-top:0}
.sh-pts input.bad{outline:2px solid var(--bad);outline-offset:-1px}
.sh-sec h4{margin:0;font-size:14px;color:var(--accent);cursor:help}
.sh-ctl{display:grid;gap:10px}.sh-ctl .rowc{display:grid;grid-template-columns:96px minmax(80px,1fr) 72px;gap:8px;align-items:center;font-size:13px}
.sh-ctl input[type=range]{width:100%;accent-color:var(--accent)}.sh-ctl input[type=number]{width:78px;border:1px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--fill);color:var(--ink);font:inherit;font-size:13px}
.sh-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.btn.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.sh-acc{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px}.sh-acc>div{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:grid;gap:2px}
.sh-acc small{color:var(--muted)}.sh-acc b{font-size:24px}.sh-acc b.ok{color:var(--good)}.sh-acc b.warn{color:var(--bad)}.sh-acc span{font-size:12px;color:var(--muted)}
.sh-pts td input{width:80px;border:1px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--fill);color:var(--ink);font:inherit;font-size:13px}
.chooser{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:24px}
.chooser button{--c1:#4F46E5;--c2:#0EA5E9;--sh:rgba(79,70,229,.45);display:grid;gap:10px;justify-items:start;align-content:start;text-align:left;padding:28px 24px 24px;border:1px solid var(--line);border-top:5px solid var(--c1);border-radius:18px;background:var(--paper);background:linear-gradient(180deg,color-mix(in srgb,var(--c1) 9%,var(--paper)),var(--paper) 60%);color:var(--ink);cursor:pointer;font:inherit;transition:transform .15s,box-shadow .15s}
.chooser button.t-shape{--c1:#059669;--c2:#22C55E;--sh:rgba(5,150,105,.45)}
.chooser button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 30px -14px var(--sh);border-color:var(--c1)}
.chooser button:disabled{opacity:.55;cursor:not-allowed}
.chooser b{font-size:24px;font-weight:800;line-height:1.3;letter-spacing:-.02em;background:linear-gradient(90deg,var(--c1),var(--c2));-webkit-background-clip:text;background-clip:text;color:transparent}
.chooser small{color:var(--muted);font-size:14px;line-height:1.55}
.chooser .ci{justify-self:center;margin:2px 0 8px;width:132px;height:132px;border-radius:32px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 14px 28px -12px var(--sh)}
.chooser .ci svg{width:96px;height:96px}
.chooser-guides{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
.chooser-guides a{display:inline-flex;align-items:center;gap:6px;text-decoration:none;padding:8px 14px;font-size:14px;border-radius:10px}
.chooser-guides a.t-model{color:#4F46E5;border-color:#C7D2FE}.chooser-guides a.t-shape{color:#059669;border-color:#A7F3D0}
@media (max-width:560px){.chooser .ci{width:104px;height:104px;border-radius:26px}.chooser .ci svg{width:76px;height:76px}.chooser b{font-size:21px}.chooser-guides a{width:100%}.sh-ctl .rowc{grid-template-columns:86px minmax(0,1fr) 70px}}`;
    document.head.appendChild(st);
    const live = p => /^(canvas|conics|vecs|pts)\./.test(p);
    // 입력: 슬라이더·숫자 칸 짝 맞추기, 좌표평면·식·정확도 다시 그리기, 탐구 대상 → 제목
    app.addEventListener("input", e => {
      if (TASK !== "shape" || view !== "student" || !ME) return; const t = e.target, p = t.dataset && t.dataset.p; if (!p) return;
      if (p === "ans.sh_obj") me.info.title = t.value;
      if (/^maps\./.test(p)) { if (t.type === "hidden") updMShow(p); else updPrev(t); }
      if (live(p)) { app.querySelectorAll(`[data-p="${p}"]`).forEach(el => { if (el !== t) el.value = t.value; }); refreshPlanes(app, me); }
      if (/^pts\.\d+\.n$/.test(p)) { const dup = dupName(me, t.value); t.classList.toggle("bad", dup); if (dup) setSave("err", `이름이 '${t.value.trim()}'인 꼭짓점이 이미 있습니다. 각도 평가에 쓰려면 다른 이름으로 바꾸세요`); }
    });
    app.addEventListener("change", e => {
      if (TASK !== "shape" || view !== "student" || !ME) return; const p = e.target.dataset && e.target.dataset.p; if (!p) return;
      if (/^conics\.\d+\.type$/.test(p) || p === "canvas.R") { renderStudent.keepScroll = true; renderStudent(); }   // 칸 이름·슬라이더 범위가 바뀜
    });
    app.addEventListener("click", e => {
      if (TASK !== "shape" || view !== "student" || !ME) return;
      const svg = e.target.closest && e.target.closest('[data-plane="pick"] svg');
      if (svg && pick && !locked()) {   // 사진 위를 눌러 꼭짓점 찍기
        const r = svg.getBoundingClientRect(), R = cv(me).R, x = -R + (e.clientX - r.left) / r.width * 2 * R, y = R - (e.clientY - r.top) / r.height * 2 * R;
        const arr = Array.isArray(me.pts) ? me.pts : (me.pts = []); if (arr.length >= MAX.pts) { setSave("err", `점은 ${MAX.pts}개까지 찍을 수 있습니다`); return; }
        let n = arr.length + 1; const names = new Set(arr.map(q => String((q || {}).n || ""))); while (names.has("P" + n)) n++;
        arr.push({ n: "P" + n, x: fm(x, 2), y: fm(y, 2) }); scheduleSave(); renderStudent.keepScroll = true; renderStudent(); return;
      }
      const t = e.target.closest && e.target.closest("button"); if (!t) return;
      const act = t.dataset.act; if (!act || !/^sh/.test(act)) return;
      if (locked()) return;
      if (act === "shImg") { uploadImage(); return; }
      if (act === "shImgDel") { if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "한 번 더 누르면 뺍니다"; setTimeout(() => { if (t.isConnected) { delete t.dataset.sure; t.textContent = "사진 빼기"; } }, 4000); return; }
        delete me.canvas.img; scheduleSave(); renderStudent.keepScroll = true; renderStudent(); return; }
      if (act === "shPick") { pick = !pick; renderStudent.keepScroll = true; renderStudent(); setSave("ok", pick ? "사진 위를 누르면 꼭짓점이 찍힙니다" : "점 찍기를 껐습니다"); return; }
      if (act === "shFit") { const c = me.canvas || (me.canvas = {}), C = cv(me); c.tx = "0"; c.ty = "0"; c.rot = "0"; c.w = String(fm(C.R * 1.6 * (C.img && C.img.h > C.img.w ? C.img.w / C.img.h : 1), 2)); scheduleSave(); renderStudent.keepScroll = true; renderStudent(); return; }
      const k = t.dataset.list; if (!LIST_NEW[k]) return;
      const arr = Array.isArray(me[k]) ? me[k] : (me[k] = []);
      if (act === "shAdd") {
        if (arr.length >= MAX[k]) { setSave("err", `${MAX[k]}개까지 넣을 수 있습니다`); return; }
        arr.push(LIST_NEW[k]()); scheduleSave(); renderStudent.keepScroll = true; renderStudent();
        const el = app.querySelector(`[data-item="${k}.${arr.length - 1}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (act === "shDel") {
        const i = +t.dataset.i; if (!(i >= 0 && i < arr.length)) return;
        if (k !== "pts" && !t.dataset.sure) { t.dataset.sure = 1; t.textContent = "한 번 더 누르면 지웁니다"; setTimeout(() => { if (t.isConnected) { delete t.dataset.sure; t.textContent = "삭제"; } }, 4000); return; }
        arr.splice(i, 1); scheduleSave(); renderStudent.keepScroll = true; renderStudent(); setSave("ok", `${i + 1}번째 항목을 지웠습니다`);
      }
    });
  }
  const lookStyle = si => { const L = LOOK[si + 1]; return `--g1:${L[0]};--g2:${L[1]}`; };
  function headHTML(si) {
    const L = LOOK[si + 1], s = si < 0 ? null : STAGES[si];
    return `<div class="stage-head"><div class="sico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${L[2]}</svg></div>
  <div style="min-width:0"><div class="kicker">${si < 0 ? "기초 자료" : `STEP ${si + 1} · 실생활 도형 디자인 보고서`}</div><h2>${si < 0 ? "나의 수행" : `${si + 1}단계 · ${esc(s.name)}`}</h2>
  <p>${si < 0 ? "기본 정보 · 활동 대시보드 · 내 결과물 · 출처와 도구" : `🎯 ${esc(s.goal)} <span class="time">⏱ ${esc(s.time)}</span>`}</p></div></div>`;
  }
  const card = (no, title, hint, body, cls) => `<div class="card${cls ? " " + cls : ""}"><div class="blk"><div class="no">${esc(no)}</div><div><h3>${tx(title)}</h3>${hint ? `<p class="hint">${tx(hint)}</p>` : ""}</div><div class="body">${body}</div></div></div>`;
  const row = (label, help, inner) => `<div class="row">${labHTML(label, help)}<div style="min-width:0">${inner}</div></div>`;
  // 풀이 칸의 'AI를 활용했다면…' 안내(모델링 과제용)는 이 과제에서 뺍니다(AI 금지)
  const ansRow = (doc, key, label, kind, ro) => kind === "longmath"
    ? `<div class="row long">${labLongHTML(label, key, ro)}<div style="min-width:0">${fieldHTML(doc, key, kind, ro, label).replace(/<div class="ainote">[\s\S]*?<\/div>/, "")}</div></div>`
    : row(label, key, fieldHTML(doc, key, kind || "", ro, label));
  const roBox = v => `<div class="ro${filled(v) ? "" : " empty"}"${filled(v) && MathTool.hasMath(v) ? " data-mathro" : ""}>${filled(v) ? esc(v) : "(비어 있음)"}</div>`;
  function txtIn(path, v, ro, label, long) {
    if (ro) return roBox(v);
    return long ? `<textarea class="fld" id="f_${path}" data-p="${path}" rows="2" placeholder=" " aria-label="${esc(label)}">${esc(v || "")}</textarea>`
      : `<input class="fld" id="f_${path}" data-p="${path}" value="${esc(v || "")}" placeholder=" " aria-label="${esc(label)}" autocomplete="off">`;
  }
  function txtMathIn(path, v, ro, label) {
    if (ro) return roBox(v);
    return `<div class="mt-wrap"><input class="fld math" id="f_${path}" data-p="${path}" value="${esc(v || "")}" placeholder=" " aria-label="${esc(label)}" autocomplete="off">${MathTool.buttonHTML(path)}</div><div class="mt-prev" data-prev="${path}" aria-live="polite"></div>`;
  }
  /** 숫자 칸(계수·좌표) */
  const numIn = (path, v, label, ro, ph) => `<label>${tx(label)}<input data-p="${path}" value="${esc(v == null ? "" : v)}" inputmode="decimal" placeholder="${esc(ph || " ")}" aria-label="${esc(plain(label))}" autocomplete="off"${ro ? " disabled" : ""}></label>`;
  const delBtn = (k, i, ro) => ro ? "" : `<button class="btn" type="button" data-act="shDel" data-list="${k}" data-i="${i}">삭제</button>`;
  const addBtn = (k, label, ro) => ro ? "" : `<button class="btn pri sh-add" type="button" data-act="shAdd" data-list="${k}">＋ ${esc(label)}</button>`;
  const algeoLinks = () => `<div class="sh-links"><a class="btn" style="text-decoration:none" href="${ALGEO_HOME}" target="_blank" rel="noopener">알지오매스 열기 ↗</a></div>`;
  const help = items => `<details class="help"><summary>💡 막히면 보세요 (감점 없음)</summary><ul>${items.map(h => `<li>${tx(h)}</li>`).join("")}</ul></details>`;
  function photoBox(doc, key, ro) {
    const ph = (doc.photos || {})[key];
    if (!ph) return ro ? `<div class="ro empty">(올린 화면 없음)</div>` : `<div class="phbox" data-photobox="${key}"></div>`;
    return `<div class="phbox sh-shot" data-photobox="${key}"><div class="phimg" data-fimg="${esc(ph.id)}">사진 불러오는 중…</div><div class="sub">📷 ${kb(ph.size)} · ${ago(ph.at)} · 보고서에 함께 들어갑니다${ro ? "" : ` · <button type="button" class="linkbtn" data-delphoto="${key}">사진 빼기</button>`}</div></div>`;
  }
  /** 좌표평면 카드: kind = pick(1단계, 점 찍기) · show(2·3단계) · acc(4단계, 정확도 색) */
  function planeCard(doc, kind, ro, title, hint, cls) {
    const C = cv(doc), opRow = `<div class="rowc"><span>사진 투명도</span><input type="range" min="0" max="1" step="0.05" data-p="canvas.op" value="${C.op}"${ro ? " disabled" : ""} aria-label="사진 투명도"><input type="number" min="0" max="1" step="0.05" data-p="canvas.op" value="${C.op}"${ro ? " disabled" : ""} aria-label="사진 투명도 값"></div>`;
    const legend = kind === "acc" ? `<p class="sub" style="margin:6px 0 0">● 초록: 허용 거리 안(일치) · ● 빨강: 벗어남 · 점선 원: 허용 거리</p>` : kind === "pick" ? "" : `<p class="sub" style="margin:6px 0 0">사진은 1단계에서 올리고 맞춥니다. 점은 1단계에서 찍은 꼭짓점입니다.</p>`;
    return `<div class="card ${cls || ""}"><div class="blk"><div class="no">⌖</div><div><h3>${esc(title)}</h3>${hint ? `<p class="hint">${tx(hint)}</p>` : ""}</div><div class="body">
    <div class="sh-plane" data-plane="${kind}">${planeSVG(doc, { acc: kind === "acc", pick: pick && kind === "pick" })}</div>${legend}
    ${C.img && kind !== "pick" ? `<div class="sh-ctl" style="margin-top:8px">${opRow}</div>` : ""}</div></div></div>`;
  }
  /** 1단계: 사진 올리기·좌표평면에 맞추기·꼭짓점 찍기 */
  function setupCards(doc, ro) {
    const C = cv(doc), R = C.R, c = doc.canvas || {}, pts = doc.pts || [];
    const rng = (key, label, min, max, step, val) => `<div class="rowc"><span>${tx(label)}</span><input type="range" min="${min}" max="${max}" step="${step}" data-p="canvas.${key}" value="${val}"${ro ? " disabled" : ""} aria-label="${esc(plain(label))}"><input type="number" min="${min}" max="${max}" step="${step}" data-p="canvas.${key}" value="${esc(c[key] != null && c[key] !== "" ? c[key] : val)}"${ro ? " disabled" : ""} aria-label="${esc(plain(label))} 값"></div>`;
    const ctl = `<div class="sh-ctl">
      <div class="sh-btns">${ro ? "" : `<button class="btn pri" type="button" data-act="shImg">📷 ${C.img ? "사진 바꾸기" : "사진 올리기"}</button>`}${C.img && !ro ? `<button class="btn" type="button" data-act="shImgDel">사진 빼기</button>` : ""}<span class="sub">${C.img ? `${C.img.w}×${C.img.h}px · ${kb(C.img.size)} · ${ago(C.img.at)}` : "아직 사진이 없습니다. 컬러로 250KB 이하로 줄여 저장합니다."}</span></div>
      <div class="rowc"><span>좌표 범위</span><select data-p="canvas.R"${ro ? " disabled" : ""} aria-label="좌표 범위">${RANGES.map(v => `<option value="${v}"${v === R ? " selected" : ""}>−${v} ~ ${v}</option>`).join("")}</select><span></span></div>
      ${C.img ? `${rng("op", "투명도", 0, 1, 0.05, C.op)}${rng("rot", "회전 (°)", -180, 180, 1, C.rot)}${rng("tx", "평행이동 $x$", -R, R, 0.1, C.tx)}${rng("ty", "평행이동 $y$", -R, R, 0.1, C.ty)}${rng("w", "사진 가로 길이", +(R * 0.1).toFixed(2), R * 4, 0.1, +fm(C.w, 2))}
      ${ro ? "" : `<div class="sh-btns"><button class="btn" type="button" data-act="shFit">↺ 원점 가운데로 되돌리기</button><span class="sub">회전은 사진의 가운데(평행이동한 점)를 중심으로 돕니다. 물체의 중심이나 대칭축이 원점·좌표축에 오도록 맞추면 식이 간단해집니다.</span></div>`}` : ""}
    </div>`;
    const ptTable = `<div class="sh-btns" style="margin:4px 0 8px">${ro ? "" : `<button class="btn${pick ? " on" : ""}" type="button" data-act="shPick">${pick ? "✓ 점 찍는 중 (끄려면 누르기)" : "⊕ 점 찍기 켜기"}</button>`}<span class="sub">${pick ? "왼쪽 좌표평면에서 사진의 꼭짓점을 누르세요." : "사진에서 모델이 지나야 할 꼭짓점·끝점을 3개 이상 고르세요."}</span></div>
      <div class="tbl-wrap"><table class="t sh-pts"><thead><tr><th>이름</th><th>${tx("$x$")}</th><th>${tx("$y$")}</th><th></th></tr></thead><tbody>${pts.length ? pts.map((p, i) => { p = p || {};
        return ro ? `<tr><td class="lab">${esc(p.n || "P" + (i + 1))}</td><td class="num">${esc(p.x)}</td><td class="num">${esc(p.y)}</td><td></td></tr>`
          : `<tr data-item="pts.${i}"><td><input data-p="pts.${i}.n" value="${esc(p.n || "")}" placeholder="P${i + 1}" aria-label="${i + 1}번째 점 이름"></td><td><input data-p="pts.${i}.x" value="${esc(p.x == null ? "" : p.x)}" inputmode="decimal" placeholder=" " aria-label="${i + 1}번째 점 x"></td><td><input data-p="pts.${i}.y" value="${esc(p.y == null ? "" : p.y)}" inputmode="decimal" placeholder=" " aria-label="${i + 1}번째 점 y"></td><td>${delBtn("pts", i, ro)}</td></tr>`; }).join("")
        : `<tr><td colspan="4" class="sub">아직 찍은 점이 없습니다.</td></tr>`}</tbody></table></div>${ro ? "" : `<div style="margin-top:6px">${addBtn("pts", "좌표로 점 넣기", ro)}</div>`}`;
    return `<div class="sh-pair"><div class="card c7 sh-sticky"><div class="blk"><div class="no">③</div><div><h3>사진을 좌표평면에 맞추기</h3><p class="hint">${tx("물체 사진을 올리면 원점 가운데에 반투명하게 놓입니다. 회전·평행이동·크기를 조절해 맞추세요.")}</p></div><div class="body">
      <div class="sh-plane" data-plane="pick">${planeSVG(doc, { pick })}</div></div></div></div>
      ${card("④", "사진 조절과 꼭짓점 고르기", "꼭짓점은 4단계에서 모델의 정확도를 재는 기준점이 됩니다.", `<div class="sh-sec"><h4${tipAttr("sh_img")}>🖼 물체 사진</h4>${ctl}</div><div class="sh-sec"><h4${tipAttr("sh_pts")}>⊕ 꼭짓점 (기준점)</h4>${ptTable}</div>`, "c5")}</div>`;   // sh-pair: 좌표평면은 이 묶음 안에서만 따라 내려옵니다
  }
  function conicItem(doc, it, i, ro) {
    it = it || {}; const k = conicK(it), col = COLORS[i % COLORS.length], ty = k.type, circle = ty === "원", par = /^포물선/.test(ty);
    return `<div class="sh-item" style="--sc:${col}" data-item="conics.${i}"><div class="sh-item-h"><b>곡선 #${i + 1}</b>${ro ? `<span class="pill">${esc(ty)}</span>` : `<select data-p="conics.${i}.type" aria-label="곡선 #${i + 1} 종류">${CONIC_TYPES.map(o => `<option${o === ty ? " selected" : ""}>${o}</option>`).join("")}</select>`}<span class="sp"></span>${delBtn("conics", i, ro)}</div>
      <div class="sh-auto" data-sheq="${i}"></div>
      ${row("계수", "sh_c_par", `<div class="sh-par" style="padding:8px 10px">${par ? numIn(`conics.${i}.a`, it.a, "$a$ (0이 아님)", ro) : numIn(`conics.${i}.a`, it.a, circle ? "반지름 $r$" : "$a$ (가로)", ro)}${circle || par ? "" : numIn(`conics.${i}.b`, it.b, "$b$ (세로)", ro)}${numIn(`conics.${i}.c`, it.c, "$c$ (중심 $x$)", ro, "0")}${numIn(`conics.${i}.d`, it.d, "$d$ (중심 $y$)", ro, "0")}</div>`)}
      ${row("범위 제한", "sh_c_dom", `<div class="sh-par" style="padding:8px 10px">${numIn(`conics.${i}.xmin`, it.xmin, "$x$ 최소", ro)}<span class="sep">≤ x ≤</span>${numIn(`conics.${i}.xmax`, it.xmax, "$x$ 최대", ro)}${numIn(`conics.${i}.ymin`, it.ymin, "$y$ 최소", ro)}<span class="sep">≤ y ≤</span>${numIn(`conics.${i}.ymax`, it.ymax, "$y$ 최대", ro)}</div>`)}
      ${row("기하학적 요소 (자동)", "sh_c_par", `<div class="sh-auto" data-shprop="${i}" style="border-radius:0;background:transparent"></div>`)}
      ${row("담당하는 물체의 부위", "sh_c_role", txtIn(`conics.${i}.role`, it.role, ro, "담당하는 물체의 부위"))}</div>`;
  }
  function vecItem(doc, it, i, ro) {
    it = it || {}; const col = VCOLORS[i % VCOLORS.length];
    return `<div class="sh-item" style="--sc:${col}" data-item="vecs.${i}"><div class="sh-item-h"><b>벡터 v${i + 1}</b><span class="sp"></span>${delBtn("vecs", i, ro)}</div>
      <div class="sh-auto" data-shvec="${i}"></div>
      ${row("시점과 성분", "sh_v_par", `<div class="sh-par" style="padding:8px 10px">${numIn(`vecs.${i}.x0`, it.x0, "시점 $x_0$", ro)}${numIn(`vecs.${i}.y0`, it.y0, "시점 $y_0$", ro)}<span class="sep">+</span>${numIn(`vecs.${i}.v1`, it.v1, "성분 $v_1$", ro)}${numIn(`vecs.${i}.v2`, it.v2, "성분 $v_2$", ro)}</div>`)}
      ${row("구조적·디자인적 의미 (선의 역할)", "sh_v_meaning", txtIn(`vecs.${i}.meaning`, it.meaning, ro, "구조적·디자인적 의미"))}
      ${row("사진 기준선 $\\overrightarrow{AB}$ (각도 평가)", "sh_v_ref", refSel(doc, it, i, ro))}</div>`;
  }
  /** 벡터마다 사진 속 실제 선의 시작점 A·끝점 B(1단계 꼭짓점)를 고릅니다 → 4단계에서 내적으로 사이각 계산 */
  function refSel(doc, it, i, ro) {
    const names = ptList(doc).map(p => p.n), sel = (k, v) => ro ? `<b>${esc(v || "–")}</b>`
      : `<select data-p="vecs.${i}.${k}" aria-label="벡터 v${i + 1} 기준선 ${k === "pa" ? "시작점 A" : "끝점 B"}"><option value="">(고르기)</option>${names.map(n => `<option${n === v ? " selected" : ""}>${esc(n)}</option>`).join("")}${v && !names.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
    return `<div class="sh-ref">A ${sel("pa", it.pa)} → B ${sel("pb", it.pb)}<span class="sub" data-shref="${i}">${refHint(doc, it)}</span></div>`;
  }
  /** 기준선 안내: u→ = AB→ 성분, 또는 무엇이 모자라는지 */
  function refHint(doc, it) {
    it = it || {}; const names = ptList(doc).map(p => p.n);
    if (!names.length) return "1단계에서 꼭짓점을 먼저 찍으세요.";
    const dup = [it.pa, it.pb].filter(n => dupName(doc, n));
    if (dup.length) return `⚠ 이름이 '${esc(dup[0])}'인 꼭짓점이 둘 이상입니다. 1단계에서 이름을 다르게 고치세요.`;
    const A = ptByName(doc, it.pa), B = ptByName(doc, it.pb);
    if (!A || !B) return "사진에서 이 벡터가 나타내는 선의 시작점과 끝점을 고르세요.";
    if (A.x === B.x && A.y === B.y) return "⚠ A와 B가 같은 점입니다. 서로 다른 점을 고르세요.";
    return tx(`$\\vec u=\\overrightarrow{AB}=${vt(B.x - A.x, B.y - A.y)}$`);
  }
  function stageCards(doc, si, ro) {
    if (si === 0) {
      const maps = doc.maps || [];
      return card("①", "탐구 대상 실생활 물체", "모델링할 물체를 정합니다. [나의 수행]의 탐구 대상과 연결됩니다.", ansRow(doc, "sh_obj", "탐구 대상 실생활 물체명", "", ro))
        + card("②", "선정 이유 및 수학적 요소 분석", "작성 시점은 자유입니다. 탐구하면서 알게 된 점을 계속 더해도 됩니다.", ansRow(doc, "sh_reason", "선정 이유와 물체에서 찾은 수학적 요소", "long", ro))
        + setupCards(doc, ro)
        + card("⑤", "물체 구성 요소별 매핑 계획도", "물체를 부위로 나누고, 부위마다 어떤 2D 수학 요소(제한된 타원·포물선·벡터 등)로 나타낼지 계획합니다.",
          `<div class="sh-items">${maps.map((m, i) => `<div class="sh-item" data-item="maps.${i}"><div class="sh-item-h"><b>매핑 계획 #${i + 1}</b><span class="sp"></span>${delBtn("maps", i, ro)}</div>
            ${row("물체의 부위", "sh_map_part", txtIn(`maps.${i}.part`, (m || {}).part, ro, "물체의 부위"))}
            ${row("사용할 2D 수학 요소", "sh_map_math", txtIn(`maps.${i}.math`, (m || {}).math, ro, "사용할 2D 수학 요소"))}
            ${row("예상 형태 및 범위 제한 방식", "sh_map_desc", txtMathIn(`maps.${i}.desc`, (m || {}).desc, ro, "예상 형태 및 범위 제한 방식"))}</div>`).join("")}
            ${maps.length ? "" : `<p class="sub">아직 매핑 계획이 없습니다.</p>`}${addBtn("maps", "매핑 계획 추가하기", ro)}</div>`)
        + `<div class="card low hint">${help(["사진은 물체가 화면 가운데에 크게, 정면이나 옆면에서 반듯하게 찍힌 것이 좋습니다.", "물체의 중심이나 대칭축을 원점·$y$축에 맞추면 곡선의 $c$, $d$가 0이 되어 식이 간단해집니다.", "꼭짓점은 곡선이 이어지는 점, 가장 높은·낮은 점, 끝점처럼 모양을 결정하는 점을 고릅니다."])}</div>`;
    }
    if (si === 1) {
      const cs = doc.conics || [];
      return `<div class="sh-pair rev">` + planeCard(doc, "show", ro, "좌표평면", "계수와 범위를 바꾸면 곡선이 바로 움직입니다. 사진의 윤곽에 맞춰 보세요.", "c5 sh-sticky")
        + card("①", "계수로 그리는 이차곡선", "곡선마다 종류를 고르고 계수 $a,b,c,d$와 범위를 넣습니다. 식과 기하학적 요소는 자동으로 나옵니다.",
          `<div class="sh-items">${cs.map((it, i) => conicItem(doc, it, i, ro)).join("")}${cs.length ? "" : `<p class="sub">아직 곡선이 없습니다.</p>`}${addBtn("conics", "곡선 추가하기", ro)}</div>`, "c7") + `</div>`
        + `<div class="card low hint">${help(["타원: $\\left(\\dfrac{x-c}{a}\\right)^2+\\left(\\dfrac{y-d}{b}\\right)^2=1$ · 중심 $(c,d)$, 가로 반지름 $a$, 세로 반지름 $b$", "원: $a=b=r$ 인 타원 · $(x-c)^2+(y-d)^2=r^2$", "쌍곡선: $\\left(\\dfrac{x-c}{a}\\right)^2-\\left(\\dfrac{y-d}{b}\\right)^2=1$ (좌우로 열림), $=-1$ (위아래로 열림) · 점근선 $y-d=\\pm\\dfrac{b}{a}(x-c)$", "포물선: $y-d=a(x-c)^2$ (위아래로 열림), $x-c=a(y-d)^2$ (좌우로 열림) · 꼭짓점 $(c,d)$, $|a|$가 클수록 좁아짐", "범위 제한: 곡선의 일부만 쓰려면 $x$·$y$의 최소·최대를 넣습니다. 예: 위쪽 반만 쓰려면 $y$ 최소에 $d$."])}</div>`;
    }
    if (si === 2) {
      const vs = doc.vecs || [];
      return `<div class="sh-pair rev">` + planeCard(doc, "show", ro, "좌표평면", "직선 부분은 벡터(화살표)로 나타냅니다.", "c5 sh-sticky")
        + card("①", "벡터로 나타내는 직선", "시점 $(x_0,y_0)$과 성분 $(v_1,v_2)$를 넣으면 화살표가 그려지고, 종점과 크기가 자동으로 나옵니다.",
          `<div class="sh-items">${vs.map((it, i) => vecItem(doc, it, i, ro)).join("")}${vs.length ? "" : `<p class="sub">아직 벡터가 없습니다.</p>`}${addBtn("vecs", "벡터 추가하기", ro)}</div>`, "c7") + `</div>`
        + `<div class="card low hint">${help(["시점 $A(x_1,y_1)$, 종점 $B(x_2,y_2)$이면 $\\overrightarrow{AB}=(x_2-x_1,\\ y_2-y_1)$", "크기: $|\\vec v|=\\sqrt{v_1^2+v_2^2}$ · 단위벡터: $\\dfrac{\\vec v}{|\\vec v|}$", "두 벡터가 이루는 각: $\\cos\\theta=\\dfrac{\\vec a\\cdot\\vec b}{|\\vec a||\\vec b|}$ · 수직이면 $\\vec a\\cdot\\vec b=0$", "대칭축을 벡터로 나타내면 곡선이 그 축에 대해 대칭인지 설명하기 좋습니다."])}</div>`;
    }
    if (si === 3) {
      const C = cv(doc);
      const cvs = doc.canvas || {};
      return `<div class="sh-pair rev">` + planeCard(doc, "acc", ro, "정확도 보기", "초록·빨강 선분: 모델 위의 점 $Q$에서 꼭짓점 $P$로 가는 벡터 $\\overrightarrow{QP}$ · 점선 화살표: 사진 기준선 $\\vec u=\\overrightarrow{AB}$와 사이각 $\\theta$", "c5 sh-sticky")
        + card("①", "모델의 정확도: 벡터의 거리와 내적", "① 위치: 꼭짓점 $P$와 모델 위의 가장 가까운 점 $Q$ 사이 벡터 $\\overrightarrow{QP}$의 크기. ② 방향: 사진 기준선 $\\vec u$와 모델 벡터 $\\vec v$의 내적으로 구한 사이각 $\\theta$.",
          `${row("허용 거리 · 허용 각도", "sh_tolA", `<div class="sh-par" style="padding:8px 10px"><label>${tx("허용 거리 $|\\overrightarrow{QP}|$")}<input data-p="canvas.tol" value="${esc(cvs.tol == null ? "" : cvs.tol)}" placeholder="${C.tol}" inputmode="decimal"${ro ? " disabled" : ""} aria-label="허용 거리"></label><label>${tx("허용 각도 $\\theta$ (°)")}<input data-p="canvas.tolA" value="${esc(cvs.tolA == null ? "" : cvs.tolA)}" placeholder="${C.tolA}" inputmode="decimal"${ro ? " disabled" : ""} aria-label="허용 각도"></label></div>`)}<div data-shacc style="margin-top:10px"></div>`, "c7") + `</div>`
        + ANALYSIS.map(([k, l], i) => card(["②", "③", "④"][i], l, HELP[k], ansRow(doc, k, l, "longmath", ro))).join("")
        + `<div class="card low hint">${help(["연결: 두 곡선이 만나는 점을 두 식에 모두 넣어 성립하는지 보이면 매끄럽게 이어진다는 근거가 됩니다.", "대칭: $x$ 대신 $-x$를 넣어도 식이 같으면 $y$축 대칭, $y$ 대신 $-y$를 넣어도 같으면 $x$축 대칭입니다.", "정확도가 낮다면: 어느 점이 벗어났는지 보고 그 부위의 계수·범위를 고치거나, 곡선을 나눠 더 그립니다."])}</div>`;
    }
    const ck = doc.checks || {}, T = doc.tools || {}, oldUrl = String((doc.ans || {}).sh_url || "").trim();
    return card("①", REFLECT[0][1], "선생님은 '어려웠다'는 말보다 무엇을 시도하고 어떻게 판단했는지를 봅니다. 실제로 바꾼 값과 그 결과를 넣어 내 과정이 드러나게 씁니다.", ansRow(doc, "sh_r1", REFLECT[0][1], "longmath", ro))
      + card("②", REFLECT[1][1], "느낌만 쓰지 말고 4단계의 정확도 수치와 좌표평면 그림을 근거로 내 작품을 스스로 평가합니다. 잘된 점과 부족한 점을 모두 씁니다.", ansRow(doc, "sh_r2", REFLECT[1][1], "longmath", ro))
      + card("③", "사용한 도구와 활용 설명", "도구는 계산과 그리기를 돕는 수단이고, 곡선의 종류·계수와 벡터를 정하는 판단은 내가 합니다. 도구가 보여 준 값을 그대로 믿지 말고 확인한 방법까지 씁니다.",
        `<div class="row"><div class="lab">쓸 수 있는 도구</div><div class="sh-tools"><ul class="sh-toolguide">${TOOL_GUIDE.map(t => `<li>${t}</li>`).join("")}</ul>${ro ? "" : algeoLinks()}</div></div>
        <div class="row">${labHTML("사용한 도구", "sh_tool")}<div class="toolchk">${TOOLS_SH().map(([k, l]) => `<label><input type="checkbox" data-p="tools.${k}"${T[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(l)}</label>`).join("")}</div></div>
        ${ansRow(doc, "sh_tool", "도구를 어디에, 어떻게 썼고 결과를 어떻게 확인했는지", "long", ro)}
        ${row("다른 도구로 만든 화면 (선택)", "sh_shot", `${ro ? "" : `<div style="padding:6px 10px"><button type="button" class="btn" data-photo="sh_shot">📷 화면 사진 올리기</button></div>`}${photoBox(doc, "sh_shot", ro)}`)}
        ${oldUrl ? `<div class="row"><div class="lab">예전에 입력한 작품 링크</div><div class="ro">${esc(oldUrl)}</div></div>` : ""}`)
      + `<div class="card"><div class="blk"><div class="no">✓</div><div><h3>제출 전 자기 점검</h3></div><div class="body checks">${CHECKS.map(([k, t]) => `<label><input type="checkbox" id="c_${k}" data-p="checks.${k}"${ck[k] ? " checked" : ""}${ro ? " disabled" : ""}> <span>${esc(t)}</span></label>`).join("")}</div></div></div>`
      + `<div class="card"><div class="submitbox" data-out="submit"></div></div>`;
  }
  function stageHTML(doc, si, ro) { return `<section class="stage" style="${lookStyle(si)}">${headHTML(si)}${banStrip()}<div class="bento">${stageCards(doc, si, ro)}</div>${ro ? "" : footNav(si)}</section>`; }

  /* ── [나의 수행] ── */
  function dashHTML(doc) {
    const p = progress(doc), avg = Math.round(p.reduce((x, y) => x + y, 0) / 5 * 100), A = doc.act || {}, st = A.st || {}, acc = accuracy(doc), ang = angleAcc(doc);
    const keys = [-1, 0, 1, 2, 3, 4], mx = Math.max(1, ...keys.map(k => st[k] || 0)), logs = (A.log || []).slice(-5).reverse();
    const nC = (doc.conics || []).filter(it => conicK(it).ok).length, nV = (doc.vecs || []).filter(it => vecK(it).ok).length;
    return `<div class="dash">
  <div class="dtop"><div class="dring">${ringSVG(avg).replace('stop-color="#4F46E5"', 'stop-color="#059669"').replace('stop-color="#0EA5E9"', 'stop-color="#22C55E"')}<div><b>전체 작성률</b><small>${doc.status === "submitted" ? "제출함" : "작성 중"}${doc.updatedAt ? ` · 저장 ${ago(doc.updatedAt)}` : ""}</small></div></div>
  <div class="dbars">${STAGES.map((s, k) => `<div><span>${k + 1} ${SHORT[k]}</span><i><b style="width:${Math.round(p[k] * 100)}%"></b></i><em>${Math.round(p[k] * 100)}%</em></div>`).join("")}</div></div>
  <div class="dtiles">
    <div><small>⏱ 탐구 시간</small><b>${tmFmt(A.explore)}</b><span>오늘 ${tmFmt((A.days || {})[dayKey()])}</span></div>
    <div><small>⌨ 입력 시간</small><b>${tmFmt(A.input)}</b><span>글·수식을 입력한 시간</span></div>
    <div><small>💤 활동 없음</small><b>${A.idleN || 0}회</b><span>모두 ${tmFmt(A.idleSec)}</span></div>
    <div><small>⬭ 곡선 · ➚ 벡터</small><b>${nC}<em> · ${nV}</em></b><span>그려진 곡선 · 벡터</span></div>
    <div><small>⊕ 꼭짓점</small><b>${ptList(doc).length}</b><span>정확도 기준점</span></div>
    <div><small>🎯 위치 · 방향 일치율</small><b class="acc">${acc ? fm(acc.rate, 1) + "%" : "–"}<em> · ${ang ? fm(ang.rate, 1) + "%" : "–"}</em></b><span>평균 거리 ${acc ? fm(acc.mean) : "–"} · 평균 각도 차 ${ang ? fm(ang.mean, 2) + "°" : "–"}</span></div>
  </div>
  <div class="dsplit"><div class="dbars dtime"><small>단계별 탐구 시간</small>${keys.map(k => `<div><span>${k < 0 ? "나의 수행" : (k + 1) + " " + SHORT[k]}</span><i><b style="width:${Math.round((st[k] || 0) / mx * 100)}%"></b></i><em>${tmFmt(st[k])}</em></div>`).join("")}</div>
  <div class="dlog"><small>최근 활동 기록</small>${logs.length ? `<ul>${logs.map(s => `<li><b>${new Date(s.s).getMonth() + 1}/${new Date(s.s).getDate()} ${hhmm(s.s)}–${hhmm(s.e)}</b><span>탐구 ${tmFmt(s.x)} · 입력 ${tmFmt(s.i)}${s.n ? ` · <em>활동 없음 ${s.n}회 (${tmFmt(s.d)})</em>` : ""}</span></li>`).join("")}</ul>` : '<p class="sub">아직 기록이 없습니다.</p>'}</div></div>
  </div>`;
  }
  const PHOTO_LABEL = Object.assign({ sh_shot: "다른 도구로 만든 화면" }, Object.fromEntries(ANALYSIS), Object.fromEntries(REFLECT));
  function filesHTML(doc) {
    const P = doc.photos || {}, isT = ME && ME.role === "teacher", pk = Object.keys(P), I = cv(doc).img;
    const item = (ic, t, sub, url) => `<li><span class="fi">${ic}</span><div><b>${t}</b><small>${sub}</small></div>${url && isT ? `<a class="btn" style="text-decoration:none" href="${esc(url)}" target="_blank" rel="noopener">열기 ↗</a>` : ""}</li>`;
    return `<ul class="files">${I ? item("🖼", "모델링할 물체 사진", `컬러 · ${I.w}×${I.h}px · ${kb(I.size)} · ${ago(I.at)}`, I.url) : item("🖼", "물체 사진 없음", "1단계 ③에서 [사진 올리기]로 올립니다")}
      ${pk.map(k => item("📷", `사진 · ${esc(PHOTO_LABEL[k] || k)}`, `${kb(P[k].size)} · ${ago(P[k].at)} · 보고서(구글 문서·PDF)에 함께 들어갑니다`, P[k].url)).join("")}</ul>`;
  }
  function homeHTML(doc, ro, acct) {
    const i = doc.info || {}; acct = acct || {}; const sid = acct.sid || i.sid || "", name = acct.name || i.name || "", T = doc.tools || {};
    const stu = ME && ME.role === "student" && view === "student";
    return `<section class="stage home" style="${lookStyle(-1)}">${headHTML(-1)}<div class="bento">
  <div class="card sh-banbox">${AI_BAN}</div>
  ${card("①", "기본 정보", "학번·이름은 가입할 때 정한 값으로 고정됩니다. 틀렸다면 선생님께 알려 주세요.",
    `<div class="row"><div class="lab">학번 🔒</div><div class="ro locked num">${esc(sid) || "–"}</div></div>
    <div class="row"><div class="lab">이름 🔒</div><div class="ro locked">${esc(name) || "–"}</div></div>
    ${row("탐구 대상 실생활 물체", "sh_obj", fieldHTML(doc, "sh_obj", "", ro, "탐구 대상") + `<div class="sub" style="padding:4px 10px 6px">🔗 1단계 ①과 연결되어 함께 바뀝니다.</div>`)}`)}
  ${card("②", "활동 대시보드", "탐구 시간·입력 시간은 화면을 쓰는 동안 자동으로 기록됩니다. 2분 넘게 아무 움직임이 없으면 '활동 없음'으로 기록하고 시간에서 뺍니다.", `<div data-out="dash"></div>`)}
  ${card("③", "내 결과물 확인 및 내려받기", "쓴 내용은 보고서 서식의 구글 문서로 선생님 폴더(실생활 도형 디자인 보고서)에 자동으로 반영됩니다. 좌표평면 그림도 함께 들어갑니다. PDF로 내려받아 확인하세요.",
    `${stu ? `<div class="docbar"><div class="grow"><b>📄 내 도형 디자인 보고서</b><small id="docSt"></small><small id="pdfLink"></small></div><button class="btn" type="button" data-act="docNow">지금 문서에 반영</button><button class="btn pri" type="button" data-act="pdf">⬇ PDF로 받기</button></div>` : ""}<div data-out="files"></div>`)}
  ${card("④", "출처와 도구", "보고서에는 5단계 끝에 들어갑니다.",
    `${ansRow(doc, "sh_src", "참고 자료 출처 (사진·사이트·책)", "long", ro)}
    <div class="row">${labHTML("사용한 도구", "sh_tool")}<div class="toolchk">${TOOLS_SH().map(([k, l]) => `<label><input type="checkbox" data-p="tools.${k}"${T[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(l)}</label>`).join("")}</div></div>
    ${ansRow(doc, "sh_tool", "도구를 어디에 어떻게 썼는지", "long", ro)}
    <div class="aibox on sh-banbox">${AI_BAN}</div>`)}
  </div>${ro ? "" : footNav(-1)}</section>`;
  }

  /* ── 학생 화면 틀 ── */
  function stepsHTML(p) {
    const hp = homeProgress(me);
    return `<button role="tab" type="button" class="home ${hp >= .999 ? "done" : hp > 0 ? "part" : ""}" aria-selected="${stage < 0}" data-stage="-1" title="나의 수행 · 기본 정보·대시보드·결과물·출처"><i></i>나의 수행</button>` +
      STAGES.map((s, k) => `<button role="tab" type="button" class="${p[k] >= .999 ? "done" : p[k] > 0 ? "part" : ""}" aria-selected="${k === stage}" data-stage="${k}" title="${k + 1}단계 ${esc(s.name)} · ${Math.round(p[k] * 100)}%"><i></i>${k + 1} ${SHORT[k]}</button>`).join("");
  }
  function statusHTML(p) {
    const s = STAGES[stage], avg = Math.round(p.reduce((x, y) => x + y, 0) / 5 * 100), A = me.act || {}, acc = accuracy(me), ang = angleAcc(me);
    return `${stage < 0 ? `<span><b>나의 수행</b></span><span>탐구 ${tmFmt(A.explore)} · 입력 ${tmFmt(A.input)}</span>` : `<span><b>${stage + 1}단계 · ${esc(s.name)}</b></span><span>⏱ ${esc(s.time)}</span>`}<span class="sep"></span>
    <span>작성률 <span class="k">${avg}%</span></span><span>꼭짓점 <span class="k">${ptList(me).length}</span></span><span>위치 <span class="k acc">${acc ? fm(acc.rate, 1) + "%" : "–"}</span></span><span>방향 <span class="k acc">${ang ? fm(ang.rate, 1) + "%" : "–"}</span></span>`;
  }
  function renderStudentShape() {
    init(); if (stage !== 0) pick = false;
    const p = progress(me), ro = locked(), y = window.scrollY;
    app.innerHTML = studentFrameHTML(stepsHTML(p), statusHTML(p), stage < 0 ? homeHTML(me, false, ME) : stageHTML(me, stage, false), ro);
    if (ro) app.querySelectorAll("#stageBox [data-p], #stageBox [data-act^=sh]").forEach(e => { e.disabled = true; });
    outputs(app, me); updateDocSt(); finishStudentRender(y);
  }
  function refresh() { const p = progress(me), st = document.getElementById("steps"), ls = document.getElementById("labStatus"); if (st) st.innerHTML = stepsHTML(p); if (ls) ls.innerHTML = statusHTML(p); }
  /** 자동으로 채우는 부분(대시보드·결과물·제출 상자·좌표평면·식·정확도·수식 그리기·사진) */
  function outputs(root, doc, owner) {
    const put = (s, h) => root.querySelectorAll(`[data-out="${s}"]`).forEach(e => { e.innerHTML = h; });
    put("dash", dashHTML(doc)); put("files", filesHTML(doc)); put("submit", submitHTML(doc));
    const T = doc.tools || {}; root.querySelectorAll('[data-out="aibox"]').forEach(e => e.classList.toggle("on", !!T.ai));
    refreshPlanes(root, doc, owner);
    root.querySelectorAll("[data-mathro]").forEach(e => { if (!e.dataset.done) { e.dataset.done = 1; MathTool.renderInto(e, e.textContent); } });
    root.querySelectorAll("[data-prev]").forEach(pv => { const f = document.getElementById("f_" + pv.dataset.prev); if (f && !pv.dataset.done) { pv.dataset.done = 1; updPrev(f); } });
    loadPhotos(root, owner); mathPass(root);
  }

  /* ── 교사 화면 ── */
  function renderRoster(box, rows) {
    box.innerHTML = `<table><thead><tr><th>학번</th><th>이름</th><th>탐구 대상</th><th>단계별 작성 (1~5)</th><th>곡선·벡터·점</th><th>위치 · 방향 일치율</th><th>상태</th><th>최근 저장</th></tr></thead><tbody>
  ${rows.map(r => { const d = r.doc, A = accuracy(d), G = angleAcc(d);
    return `<tr data-sel="${esc(r.id)}" aria-selected="${r.id === sel}"><td class="num">${esc(r.sid) || "–"}</td><td>${esc(r.name) || '<span class="sub">이름 없음</span>'}${pasteBadge(r.doc)}<div class="sub">${esc(r.login)}</div></td>
  <td style="white-space:normal;min-width:160px">${esc(r.title) || '<span class="sub">아직 정하지 않음</span>'}${cv(d).img ? ' <span class="pill">사진</span>' : ""}</td>
  <td><div class="prog" title="${r.p.map((v, k) => `${k + 1}단계 ${Math.round(v * 100)}%`).join(", ")}">${r.p.map(v => `<span><i style="width:${Math.round(v * 100)}%"></i></span>`).join("")}</div></td>
  <td class="num">${(d.conics || []).filter(it => conicK(it).ok).length} · ${(d.vecs || []).filter(it => vecK(it).ok).length} · ${ptList(d).length}</td>
  <td class="num">${A ? fm(A.rate, 1) + "%" : "–"} · ${G ? fm(G.rate, 1) + "%" : "–"}<div class="sub">${A ? "거리 " + fm(A.mean) : ""}${G ? " · 각도 " + fm(G.mean, 1) + "°" : ""}</div></td>
  <td>${d.status === "submitted" ? '<span class="pill sub">제출함</span>' : r.live ? '<span class="pill live">작성 중</span>' : r.upd ? '<span class="pill">미제출</span>' : '<span class="pill">시작 전</span>'}</td>
  <td class="sub">${ago(r.upd)}</td></tr>`; }).join("")}</tbody></table>`;
  }
  function renderDetail(box, r) {
    init(); const doc = r.doc;
    box.innerHTML = `<div class="detail"><div style="min-width:0">${detailHeadHTML(r, doc)}
    <div class="dtabs"><button type="button" data-dst="-1" aria-pressed="${selStage < 0}">나의 수행</button>${STAGES.map((st, k) => `<button type="button" data-dst="${k}" aria-pressed="${k === selStage}">${k + 1}. ${esc(st.name)} ${Math.round(r.p[k] * 100)}%</button>`).join("")}</div>
    <div id="dStage">${selStage < 0 ? homeHTML(doc, true, { sid: r.sid, name: r.name }) : stageHTML(doc, selStage, true)}</div></div>
    <aside class="grade" id="gradeBox"><h3>채점</h3><p class="sub">실생활 도형 디자인 보고서의 채점 칸은 평가 기준(평가요소·배점)을 정한 뒤 추가합니다. 지금은 학생 활동지와 보고서 문서를 확인할 수 있습니다.</p></aside></div>`;
    outputs(document.getElementById("dStage"), doc, sel);
  }

  /* ── 보고서(구글 문서) 명세: Docs.gs 가 활동지 서식으로 그립니다 ── */
  /** 좌표평면 PNG: 사진은 캔버스에 직접(투명도·회전·평행이동), 격자·곡선·벡터·점은 SVG로 덧그립니다. */
  function planePNG(doc, src, acc) {
    const S = 900, C = cv(doc), R = C.R;
    return new Promise(res => {
      const cvs = document.createElement("canvas"); cvs.width = S; cvs.height = S; const x = cvs.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
      const overlay = () => { const im = new Image(); im.onload = () => { x.drawImage(im, 0, 0, S, S); try { res(cvs.toDataURL("image/png").split(",")[1]); } catch (e) { res(""); } }; im.onerror = () => res("");
        im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(planeSVG(doc, { S, noImg: true, noBg: true, acc })); };
      if (!src || !C.img || !C.img.w) return overlay();
      const ph = new Image(); ph.onload = () => {
        const w = C.w / (2 * R) * S, h = w * C.img.h / C.img.w, cx = (C.tx + R) / (2 * R) * S, cy = (R - C.ty) / (2 * R) * S;
        x.save(); x.globalAlpha = C.op; x.translate(cx, cy); x.rotate(-C.rot * Math.PI / 180); x.drawImage(ph, -w / 2, -h / 2, w, h); x.restore(); overlay(); };
      ph.onerror = overlay; ph.src = src;
    });
  }
  async function planePNGs(doc, owner) {
    const C = cv(doc); let src = C.img ? imgSrc(C.img.id) : "";
    if (C.img && !src) { try { const r = await api("getFile", { id: C.img.id, owner }); src = imgCache[C.img.id] = `data:${r.mime};base64,${r.b64}`; } catch (e) { src = ""; } }
    return Promise.all([planePNG(doc, src, false), planePNG(doc, src, true)]);
  }
  function spec(doc, acct, owner) {
    acct = acct || {}; const a = doc.ans || {}, ck = doc.checks || {}, info = doc.info || {}, P = doc.photos || {}, C = cv(doc), A = accuracy(doc), G = angleAcc(doc);
    const v = x => String(x == null ? "" : x);
    const photo = (k, cap) => P[k] && P[k].id ? [{ t: "photo", id: P[k].id, caption: cap }] : [];
    const IMG = (i, cap) => ({ t: "image", i, w: 380, h: 380, caption: cap });   // 0: 사진·곡선·벡터·점, 1: 정확도 색
    const maps = doc.maps || [], pts = ptList(doc), hasShapes = allShapes(doc).length > 0;
    const conicRows = (doc.conics || []).map((it, i) => { const k = conicK(it), dm = domTex(k);
      return { no: `#${i + 1}`, title: `곡선 · ${k.type}`, parts: [{ t: "fields", rows: [["방정식", k.ok ? `$${conicTex(k)}$` : "(계수를 넣지 않음)"], ["범위 제한", dm ? `$${dm}$` : "제한 없음"], ["기하학적 요소", conicProps(k) || "–"], ["담당하는 물체의 부위", v(it.role)]] }] }; });
    const vecRows = (doc.vecs || []).map((it, i) => { const w = vecK(it);
      return { no: `v${i + 1}`, title: "벡터", parts: [{ t: "fields", rows: [["성분", w.ok ? `$${vecTex(w)}$` : "(시점·성분을 넣지 않음)"], ["시점 → 종점", w.ok ? `${pt(w.x0, w.y0)} → ${pt(w.x1, w.y1)}` : "–"], ["크기", w.ok ? `$|\\vec v|=${fm(w.len)}$` : "–"], ["구조적·디자인적 의미", v(it.meaning)], ["사진 기준선 A → B", filled(it.pa) && filled(it.pb) ? `${v(it.pa)} → ${v(it.pb)}` : "(고르지 않음)"]] }] }; });
    const stages = [
      [{ no: "①", title: "탐구 대상 실생활 물체", parts: [{ t: "fields", rows: [["탐구 대상 실생활 물체명", v(a.sh_obj)]] }] },
        { no: "②", title: "선정 이유 및 수학적 요소 분석", parts: [{ t: "fields", rows: [["선정 이유와 수학적 요소", v(a.sh_reason)]] }] },
        { no: "③", title: "사진을 좌표평면에 맞추기와 꼭짓점", parts: [{ t: "fields", auto: 1, rows: [["좌표 범위", `−${R0(C)} ~ ${R0(C)}`], ["사진 조절", C.img ? `투명도 ${fm(C.op, 2)} · 회전 ${fm(C.rot, 1)}° · 평행이동 (${fm(C.tx, 2)}, ${fm(C.ty, 2)}) · 가로 길이 ${fm(C.w, 2)}` : "(사진 없음)"]] },
          { t: "table", cols: ["꼭짓점", "x", "y"], rows: pts.length ? pts.map(p => [p.n, fm(p.x), fm(p.y)]) : [["(없음)", "", ""]] }] },
        { no: "④", title: "물체 구성 요소별 매핑 계획도", parts: [{ t: "table", cols: ["#", "물체의 부위", "사용할 2D 수학 요소", "예상 형태 및 범위 제한 방식"], fill: [1, 2, 3],
          rows: (maps.length ? maps : [{}]).map((m, i) => [String(i + 1), v((m || {}).part), v((m || {}).math), v((m || {}).desc)]) }] }],
      [{ no: "", title: "완성된 모델 (좌표평면)", parts: [IMG(0, "물체 사진 위에 그린 이차곡선·벡터와 꼭짓점")] }].concat(conicRows),
      vecRows,
      [{ no: "①", title: "모델의 정확도: 벡터의 거리와 내적", parts: [
          { t: "fields", auto: 1, rows: [
            ["① 위치 (벡터의 거리)", A ? `일치율 ${fm(A.rate, 1)}% (${A.ok} / ${A.n}점, 허용 거리 ${fm(A.tol)}) · 평균 거리 ${fm(A.mean)} · 가장 먼 점 ${fm(A.max)}` : (pts.length ? (hasShapes ? "–" : "곡선·벡터가 없어 계산하지 못함") : "꼭짓점이 없어 계산하지 못함")],
            ["② 방향 (내적으로 구한 각도)", G ? `일치율 ${fm(G.rate, 1)}% (${G.ok} / ${G.n}개, 허용 각도 ${fm(G.tolA, 1)}°) · 평균 각도 차 ${fm(G.mean, 2)}° · 가장 큰 차 ${fm(G.max, 2)}°` : "사진 기준선을 고른 벡터가 없어 계산하지 못함"]] }]
          .concat(A ? [{ t: "table", cols: ["꼭짓점 $P$", "모델 위의 점 $Q$", "$\\overrightarrow{QP}$", "$|\\overrightarrow{QP}|$", "가장 가까운 선", "일치"], rows: A.rows.map(r => [`${r.n} ${pt(r.x, r.y)}`, pt(r.qx, r.qy), `$${vt(r.dx, r.dy)}$`, fm(r.d), r.who, r.ok ? "일치" : "벗어남"]) }] : [])
          .concat(G ? [{ t: "table", cols: ["벡터", "$\\vec u=\\overrightarrow{AB}$", "$\\vec v$", "$\\vec u\\cdot\\vec v$", "$|\\vec u|,\\ |\\vec v|$", "$\\cos\\theta$", "$\\theta$", "일치"], rows: G.rows.map(r => [`v${r.i + 1} (${r.a}→${r.b})`, `$${vt(r.u1, r.u2)}$`, `$${vt(r.v1, r.v2)}$`, fm(r.dot), `${fm(r.lu)}, ${fm(r.lv)}`, fm(r.cos, 5), `${fm(r.th, 2)}°`, r.ok ? "일치" : "벗어남"]) }] : [])
          .concat(A || G ? [IMG(1, "초록·빨강 선분: 거리 벡터 QP · 점선 화살표: 사진 기준선 AB와 사이각 θ")] : []) }]
        .concat(ANALYSIS.map(([k, l], i) => ({ no: ["②", "③", "④"][i], title: l, parts: [{ t: "fields", rows: [[l, v(a[k])]] }].concat(photo(k, "풀이 사진 · " + l)) }))),
      REFLECT.map(([k, l], i) => ({ no: ["①", "②"][i], title: l, parts: [{ t: "fields", rows: [[l, v(a[k])]] }].concat(photo(k, "풀이 사진 · " + l)) }))
        .concat([{ no: "③", title: "사용한 도구와 활용 설명", parts: [{ t: "fields", rows: [["사용한 도구", TOOLS_SH().filter(([k]) => (doc.tools || {})[k]).map(([, l]) => l).join(", ")], ["도구를 어디에, 어떻게 썼고 결과를 어떻게 확인했는지", v(a.sh_tool)]]
          .concat(filled(a.sh_url) ? [["예전에 입력한 작품 링크", v(a.sh_url)]] : []) }].concat(photo("sh_shot", "다른 도구로 만든 화면")) }])
        .concat([{ check: "제출 전 자기 점검", items: CHECKS.map(([k, t]) => [t, !!ck[k]]) },
          { no: "④", title: "참고 자료 출처", parts: [{ t: "fields", rows: [["참고 자료 출처", v(a.sh_src)]] }] }])
    ];
    const empty = { 2: "(아직 벡터가 없습니다)" };
    return { spec: { header: ["2026학년도 2학기 전문 수학 · 수행평가", "실생활 도형 디자인 보고서", "사진 위 좌표평면에서 이차곡선·벡터로 모델링 · 활동지 겸 보고서"],
      intro: "실생활 물체 사진을 좌표평면에 맞추고, 범위를 제한한 이차곡선과 벡터로 윤곽을 모델링한 뒤, 고른 꼭짓점으로 정확도를 확인하고 그 수학적 근거와 한계를 설명합니다. 다 채운 활동지가 그대로 보고서가 됩니다. AI 활용은 금지이며(적발 시 감점), 모든 곡선은 학생이 스스로 결정하고, 제출한 결과물로 인터뷰를 실시합니다.",
      standards: "", info: { sid: info.sid || acct.sid || "", name: info.name || acct.name || "", title: info.title || v(a.sh_obj) },
      stages: STAGES.map((s, si) => ({ name: `${si + 1}단계 · ${s.name}`, meta: s.time, goal: s.goal,
        blocks: stages[si].length ? stages[si] : [{ title: empty[si] || "", parts: [] }] })) }, svgs: [], pngs: planePNGs(doc, owner) };
  }
  const R0 = C => C.R;

  /* ── 로그인 뒤 과제 고르기 ── */
  // 삼각함수·미적분: 소리의 음파(사인파 두 겹) + 한 점에서의 얇은 붉은 접선(미분) + dy/dx (분수 꼴)
  const ICON_MODEL = '<path d="M4 17c2.5-9 5.5-9 8 0s5.5 9 8 0 5.5-9 8 0 5.5 9 8 0 5.5-9 8 0" stroke-width="2.6"/>'
    + '<path d="M4 17c2.5-5 5.5-5 8 0s5.5 5 8 0 5.5-5 8 0 5.5 5 8 0 5.5-5 8 0" stroke-width="1.4" opacity=".45"/>'
    + '<path d="M14 26.5 26 7.5" stroke="#FF7B7B" stroke-width="1.2"/><circle cx="20" cy="17" r="2.1" fill="#FF7B7B" stroke="none"/>'
    + '<g fill="#fff" stroke="none" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="8.5" text-anchor="middle"><text x="24" y="34.5">dy</text><text x="24" y="45">dx</text></g>'
    + '<path d="M18.5 37.2h11" stroke="#fff" stroke-width="1.1"/>';
  // 실생활 도형: 꼭짓점을 맞댄 원뿔 두 개(이중 원뿔) 안에 이차곡선(타원·포물선)
  //   원뿔은 반투명 면 + 얇은 윤곽(밑면 뒤쪽은 점선), 곡선은 원뿔 면 위에 얇은 선으로 · 곡선마다 색을 달리(타원 노랑, 포물선 장밋빛)
  //   위 원뿔: 비스듬한 평면이 자른 타원(양 끝이 원뿔 옆면에 닿음) · 아래 원뿔: 옆면과 평행한 평면이 자른 포물선(양 끝이 밑면 테두리)
  const ICON_SHAPE = '<path d="M12 7 24 24 36 7Z" fill="#fff" fill-opacity=".16" stroke="none"/><path d="M12 41 24 24 36 41Z" fill="#fff" fill-opacity=".16" stroke="none"/>'
    + '<ellipse cx="24" cy="7" rx="12" ry="3.2" fill="#fff" fill-opacity=".28" stroke-width=".8"/>'
    + '<path d="M12 41a12 3.2 0 0 1 24 0" stroke-width=".6" stroke-dasharray="1.4 1.2" opacity=".85"/><path d="M12 41a12 3.2 0 0 0 24 0" stroke-width=".8"/>'
    + '<path d="M12 7 36 41M36 7 12 41" stroke-width=".8"/>'
    + '<ellipse cx="25.9" cy="13.8" rx="7.4" ry="1.8" transform="rotate(-20.8 25.9 13.8)" stroke="#FDE047" stroke-width="1"/>'
    + '<path d="M17.6 43.6C20.5 34 26.2 28 28.9 30.8" stroke="#FF6B8B" stroke-width="1"/>'   // 앞면
    + '<path d="M28.9 30.8C30.6 32.6 31.4 36 31.6 38.4" stroke="#FF6B8B" stroke-width=".8" stroke-dasharray="1.4 1.2" opacity=".9"/>';   // 뒷면(점선)
  // 과제 안내 PDF: GitHub Pages 의 docs/ 폴더(예비 주소 /exec 에서도 열리도록 전체 주소)
  const GUIDE_BASE = "https://blis-logic.github.io/modeling-assessment/docs/";
  const GUIDES = [["model", "삼각함수·미적분 수학적 모델링 안내", "guide-modeling.pdf"], ["shape", "실생활 도형 디자인 보고서 안내", "guide-shape.pdf"]];
  const PDF_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 15h6M9 18h4"/></svg>';
  function chooserHTML(shapeOK) {
    const one = (task, title, sub, icon, dis) => `<button type="button" class="t-${task}" data-task="${task}"${dis ? " disabled" : ""}><span class="ci"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span><b>${title}</b><small>${sub}</small></button>`;
    init();
    return `<section style="margin-top:24px"><h2 style="margin:0;font-size:22px">어떤 수행평가를 하나요?</h2><p class="sub" style="margin:6px 0 0">${ME ? esc(ME.name || ME.id) + (ME.role === "teacher" ? " 선생님" : "") + " · " : ""}들어갈 과제를 고르세요. 위쪽의 [과제 바꾸기]로 언제든 다른 과제로 옮겨 갈 수 있습니다.</p>
  <div class="chooser">${one("model", "삼각함수·미적분 수학적 모델링", "자료를 모아 삼각함수 모델을 만들고, 미분·적분으로 현상을 분석합니다.", ICON_MODEL, false)}
  ${one("shape", "실생활 도형 디자인 보고서", shapeOK ? "실생활 물체 사진을 좌표평면에 올리고, 이차곡선과 벡터로 모델링해 정확도와 수학적 근거를 씁니다." : "저장 서버가 아직 이 과제를 지원하지 않습니다. 선생님께 알려 주세요.", ICON_SHAPE, !shapeOK)}</div>
  <div class="chooser-guides"><span class="sub">📖 과제 안내 자료</span>${GUIDES.map(([t, l, f]) => `<a class="btn t-${t}" href="${GUIDE_BASE}${f}" target="_blank" rel="noopener">${PDF_ICON}<span>${l} (PDF)</span></a>`).join("")}</div></section>`;
  }

  window.Shape = { blank, afterLoad, progress, summary, renderStudent: renderStudentShape, refresh, outputs, dashHTML, renderRoster, renderDetail, spec, chooserHTML,
    accuracy, conicK, conicTex, title: "실생활 도형 디자인 보고서", fileName: "도형디자인보고서" };
})();
