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
 * Check if a path is a directory in the dist folder
 */
async function isDirectory(basePath, relativePath) {
  try {
    const fullPath = path.resolve(path.dirname(basePath), relativePath);
    const stats = await fs.stat(fullPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Fix imports in JavaScript files
 */
async function patchImports(filePath) {
  let code = await fs.readFile(filePath, 'utf8');
  
  // First, fix specific known directory imports
  const directoryImports = [
    { from: '../constants.js', to: '../constants/index.js' },
    { from: './constants.js', to: './constants/index.js' },
    { from: '../config.js', to: '../config/index.js' },
    { from: './config.js', to: './config/index.js' },
    { from: '../generated/prisma.js', to: '../generated/prisma/index.js' },
    { from: './generated/prisma.js', to: './generated/prisma/index.js' },
  ];
  
  for (const { from, to } of directoryImports) {
    if (code.includes(from)) {
      code = code.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    }
  }
  
  // Then handle other imports
  const importRegex = /from\s+(["'])(\.\.?\/[^"']+?)(?<!\.m?js|\.c?js)\1/g;
  const matches = [...code.matchAll(importRegex)];
  
  for (const match of matches) {
    const [fullMatch, quote, importPath] = match;
    
    // Check if this might be a directory
    const isDir = await isDirectory(filePath, importPath);
    
    if (isDir) {
      // It's a directory, add /index.js
      const replacement = `from ${quote}${importPath}/index.js${quote}`;
      code = code.replace(fullMatch, replacement);
    } else {
      // It's a file, just add .js
      const replacement = `from ${quote}${importPath}.js${quote}`;
      code = code.replace(fullMatch, replacement);
    }
  }
  
  return code;
}

(async () => {
  const files = await walk(distDir);
  let patchedCount = 0;
  
  for (const file of files) {
    const originalCode = await fs.readFile(file, 'utf8');
    const patchedCode = await patchImports(file);
    
    if (patchedCode !== originalCode) {
      await fs.writeFile(file, patchedCode, 'utf8');
      patchedCount++;
    }
  }
  
  console.log(`Patched ${patchedCount} JS files to add .js extensions where needed.`);
})(); 