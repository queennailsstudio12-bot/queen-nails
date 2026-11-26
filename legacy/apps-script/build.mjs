import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.dirname(root);
const html = await readFile(path.join(workspace, 'public/index.html'), 'utf8');
const css = await readFile(path.join(workspace, 'public/styles.css'), 'utf8');
const js = await readFile(path.join(root, 'Client.js'), 'utf8');
const logo = (await readFile(path.join(workspace, 'logo/logo.jpeg'))).toString('base64');
const output = html
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>${css}</style>`)
  .replace('<script src="/app.js" defer></script>', '')
  .replaceAll('src="/logo.jpeg"', 'data-logo')
  .replace('</body>', `<script>document.querySelectorAll('img[data-logo]').forEach(img => { img.src = 'data:image/jpeg;base64,${logo}'; });</script>\n<script>${js}</script>\n</body>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/Index.html'), output);
await copyFile(path.join(root, 'Code.gs'), path.join(root, 'dist/Code.gs'));
await copyFile(path.join(root, 'appsscript.json'), path.join(root, 'dist/appsscript.json'));
console.log('Apps Script listo en apps-script/dist');
