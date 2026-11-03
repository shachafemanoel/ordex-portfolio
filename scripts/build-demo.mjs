// Inlines the Vite build into demo/index.html so the demo opens from disk with a double-click.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) =>
    `<style>\n${readFileSync(join(dist, file), 'utf8')}\n</style>`);

html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) =>
    `<script type="module">\n${readFileSync(join(dist, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error('Some build assets were not inlined');

mkdirSync(join(root, 'demo'), { recursive: true });
writeFileSync(join(root, 'demo', 'index.html'), html);
console.log(`demo/index.html written (${Math.round(html.length / 1024)} KB)`);
