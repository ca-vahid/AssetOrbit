import { promises as fs } from 'fs';
import path from 'path';

const srcDir = path.resolve(process.cwd(), 'src');

/**
 * Recursively walk a directory and return TS file paths.
 */
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && full.endsWith('.ts')) return [full];
    return [];
  }));
  return files.flat();
}

/**
 * Append .js to bare relative import specifiers (./ or ../ and no extension).
 * Also handles directory imports by adding /index.js
 */
function patchImports(code) {
  // Fix relative imports without extensions
  code = code.replace(/from\s+(["'])(\.\.?\/[^"']+?)(?<!\.m?js|\.c?js|\.json)\1/g, (match, quote, spec) => {
    // Check if it's likely a directory import (no file extension)
    if (!spec.includes('.')) {
      return `from ${quote}${spec}/index.js${quote}`;
    }
    return `from ${quote}${spec}.js${quote}`;
  });
  
  // Fix import statements
  code = code.replace(/import\s+(.*?)\s+from\s+(["'])(\.\.?\/[^"']+?)(?<!\.m?js|\.c?js|\.json)\2/g, (match, imports, quote, spec) => {
    if (!spec.includes('.')) {
      return `import ${imports} from ${quote}${spec}/index.js${quote}`;
    }
    return `import ${imports} from ${quote}${spec}.js${quote}`;
  });
  
  return code;
}

(async () => {
  const files = await walk(srcDir);
  let patchedCount = 0;
  
  await Promise.all(files.map(async (file) => {
    const code = await fs.readFile(file, 'utf8');
    const patched = patchImports(code);
    if (patched !== code) {
      await fs.writeFile(file, patched, 'utf8');
      patchedCount++;
      console.log(`Patched: ${path.relative(process.cwd(), file)}`);
    }
  }));
  
  console.log(`\nPatched ${patchedCount} TypeScript files to add .js extensions.`);
})(); 