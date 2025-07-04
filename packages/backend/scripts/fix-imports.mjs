import { promises as fs } from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');

/**
 * Recursively walk a directory and return JS file paths.
 */
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && full.endsWith('.js')) return [full];
    return [];
  }));
  return files.flat();
}

/**
 * Append .js to bare relative import specifiers (./ or ../ and no extension).
 */
function patchImports(code) {
  return code.replace(/from\s+(["'])(\.\.?\/[^"']+?)(?<!\.m?js|\.c?js)\1/g, (_match, quote, spec) => {
    return `from ${quote}${spec}.js${quote}`;
  });
}

(async () => {
  const files = await walk(distDir);
  await Promise.all(files.map(async (file) => {
    const code = await fs.readFile(file, 'utf8');
    const patched = patchImports(code);
    if (patched !== code) {
      await fs.writeFile(file, patched, 'utf8');
    }
  }));
  console.log(`Patched ${files.length} JS files to add .js extensions where needed.`);
})(); 