// index.html + config.js + mathtool.js 를 하나로 합쳐 apps-script/app.html 을 만듭니다.
// 구글 서버(/exec)가 이 파일을 화면으로 보여 주므로, github.io 가 막힌 학교망에서도 같은 주소로 쓸 수 있습니다.
// index.html · config.js · mathtool.js 를 고친 뒤에는 clasp push 전에 한 번 실행합니다:  node tools/build-gas.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const inline = f => {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) throw new Error(`index.html 에 ${tag} 가 없습니다`);
  const js = read(f);
  if (/<\/script/i.test(js)) throw new Error(`${f} 안에 </script 가 있어 인라인할 수 없습니다`);
  html = html.replace(tag, () => `<script>\n${js}\n</script>`);
};
inline('config.js');
inline('mathtool.js');
html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- 자동 생성: node tools/build-gas.js (직접 고치지 마세요) -->');
fs.writeFileSync(path.join(root, 'apps-script', 'app.html'), html);
console.log('apps-script/app.html 생성 (' + html.length + '자)');
