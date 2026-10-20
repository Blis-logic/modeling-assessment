// index.html + config.js + mathtool.js 를 하나로 합쳐 apps-script/app.html 을 만듭니다.
// 구글 서버(/exec)가 이 파일을 화면으로 보여 주므로, github.io 가 막힌 학교망에서도 같은 주소로 쓸 수 있습니다.
// index.html · config.js · mathtool.js 를 고친 뒤에는 clasp push 전에 한 번 실행합니다:  node tools/build-gas.js
// 화면 파일이 바뀌면 버전 번호(APP_VER, 한국 시각 YYYYMMDDHHMM)를 새로 매겨 index.html 의 config.js?v= · mathtool.js?v= 와
// apps-script/Version.gs 에 적습니다. 서버가 이 번호를 돌려주므로, 업데이트 전에 열어 둔 옛 화면은 새로고침 안내를 띄웁니다.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const STAMP = /const APP_VER="(\d+)"; \/\/ build:(\w+)/, QV = /(config|mathtool)\.js\?v=\d+/g;
const m = html.match(STAMP);
if (!m) throw new Error('index.html 에 const APP_VER="…"; // build:… 줄이 없습니다');
const norm = html.replace(STAMP, 'const APP_VER="0"; // build:0').replace(QV, (x, f) => f + '.js?v=0');
const hash = crypto.createHash('sha1').update(norm + read('config.js') + read('mathtool.js')).digest('hex').slice(0, 8);
let ver = m[1];
if (m[2] !== hash) {  // 내용이 바뀐 경우에만 새 번호
  const k = new Date(Date.now() + 9 * 3600e3).toISOString();
  ver = k.slice(0, 4) + k.slice(5, 7) + k.slice(8, 10) + k.slice(11, 13) + k.slice(14, 16);
  html = html.replace(STAMP, () => `const APP_VER="${ver}"; // build:${hash}`).replace(QV, (x, f) => f + '.js?v=' + ver);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log('index.html 버전 ' + ver);
}
fs.writeFileSync(path.join(root, 'apps-script', 'Version.gs'), `// 자동 생성: node tools/build-gas.js (직접 고치지 마세요). 화면(index.html) 버전 — 옛 화면에 새로고침 안내\nconst APP_VER = '${ver}';\n`);
const inline = f => {
  const tag = new RegExp(`<script src="${f.replace('.', '\\.')}(\\?v=\\d+)?"></script>`);
  if (!tag.test(html)) throw new Error(`index.html 에 <script src="${f}"> 가 없습니다`);
  const js = read(f);
  if (/<\/script/i.test(js)) throw new Error(`${f} 안에 </script 가 있어 인라인할 수 없습니다`);
  html = html.replace(tag, () => `<script>\n${js}\n</script>`);
};
inline('config.js');
inline('mathtool.js');
html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- 자동 생성: node tools/build-gas.js (직접 고치지 마세요) -->');
fs.writeFileSync(path.join(root, 'apps-script', 'app.html'), html);
console.log('apps-script/app.html 생성 (' + html.length + '자)');
