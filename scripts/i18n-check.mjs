import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const problems = [];
const keys = new Set();
const translations = ts.createSourceFile('ui.ts', fs.readFileSync(path.join(root, 'lib/i18n/domains/ui.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}
visit(translations, (node) => {
  if (!ts.isVariableDeclaration(node) || node.name.getText(translations) !== 'UI_TRANSLATIONS' || !node.initializer || !ts.isObjectLiteralExpression(node.initializer)) return;
  for (const entry of node.initializer.properties) {
    if (!ts.isPropertyAssignment(entry) || !ts.isStringLiteral(entry.name)) continue;
    const key = entry.name.text;
    if (keys.has(key)) problems.push(`Duplicate UI key: ${key}`);
    keys.add(key);
    if (!ts.isObjectLiteralExpression(entry.initializer)) continue;
    for (const locale of ['he', 'en']) {
      const value = entry.initializer.properties.find((property) => property.name?.getText(translations) === locale);
      if (!value || !ts.isPropertyAssignment(value) || !ts.isStringLiteralLike(value.initializer) || !value.initializer.text.trim()) problems.push(`Missing ${locale}: ${key}`);
    }
  }
});
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const usesUIHook = /useUITranslation\s*\(/.test(text);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    visit(source, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      if (node.expression.text !== 'tUI' && !(usesUIHook && node.expression.text === 't')) return;
      const key = node.arguments[0];
      if (!key || !ts.isStringLiteralLike(key) || keys.has(key.text)) return;
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      problems.push(`${path.relative(root, file)}:${line}: unknown UI key ${key.text}`);
    });
  }
}
for (const directory of ['app', 'components', 'hooks', 'lib', 'src']) scan(path.join(root, directory));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Validated ${keys.size} bilingual UI keys and literal UI translation calls. Dynamic keys and visual RTL still require review.`);
