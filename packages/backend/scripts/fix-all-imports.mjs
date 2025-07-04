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
 * Fix imports in TypeScript files
 */
async function fixImports(filePath) {
  let code = await fs.readFile(filePath, 'utf8');
  let modified = false;
  
  // Fix specific known directory imports
  const directoryImports = [
    { from: '../constants.js', to: '../constants/index.js' },
    { from: '../config.js', to: '../config/index.js' },
    { from: '../generated/prisma.js', to: '../generated/prisma/index.js' },
  ];
  
  for (const { from, to } of directoryImports) {
    if (code.includes(from)) {
      code = code.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      modified = true;
    }
  }
  
  // Also fix imports without .js extension
  const importRegex = /from\s+(['"])(\.\.?\/[^'"]+?)(?<!\.js|\.json|\.mjs|\.cjs)\1/g;
  const newCode = code.replace(importRegex, (match, quote, importPath) => {
    // Skip if it already has an extension
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    
    // Check if it's a known directory import
    const knownDirs = ['config', 'constants', 'generated/prisma', 'utils', 'services', 'middleware', 'routes'];
    const isKnownDir = knownDirs.some(dir => 
      importPath === `./${dir}` || 
      importPath === `../${dir}` || 
      importPath.endsWith(`/${dir}`)
    );
    
    if (isKnownDir) {
      return `from ${quote}${importPath}/index.js${quote}`;
    }
    
    // Otherwise just add .js
    return `from ${quote}${importPath}.js${quote}`;
  });
  
  if (newCode !== code) {
    code = newCode;
    modified = true;
  }
  
  if (modified) {
    await fs.writeFile(filePath, code, 'utf8');
    console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

(async () => {
  console.log('Fixing imports in TypeScript files...\n');
  
  const files = await walk(srcDir);
  let fixedCount = 0;
  
  for (const file of files) {
    const fixed = await fixImports(file);
    if (fixed) fixedCount++;
  }
  
  console.log(`\nFixed ${fixedCount} files.`);
})(); 