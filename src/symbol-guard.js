const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveWithin } = require('./path-policy');

function extractSymbols(content) {
  if (!content || typeof content !== 'string') return [];

  const symbols = new Set();

  const jsxCardRegex = /<(?:[A-Z]\w*)?(?:Card|Section|Block|Tab|Panel|View|Tile)\b[^>]*>/gi;
  let match;
  while ((match = jsxCardRegex.exec(content)) !== null) {
    symbols.add(match[0].trim());
  }

  const exportRegex = /\bexport\s+(?:const|function|class|default)\s+([A-Za-z0-9_]+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    symbols.add(`export:${match[1]}`);
  }

  const fnRegex = /\b(?:const|function)\s+(calculate[A-Za-z0-9_]*|compute[A-Za-z0-9_]*|handle[A-Za-z0-9_]*)\b/g;
  while ((match = fnRegex.exec(content)) !== null) {
    symbols.add(`fn:${match[1]}`);
  }

  return Array.from(symbols);
}

function analyzeSymbolDiff(projectDir, relativeFilePath, oldContentInput, newContentInput) {
  let oldContent = oldContentInput;
  let newContent = newContentInput;

  const targetPath = resolveWithin(projectDir, relativeFilePath || '');

  if (oldContent === undefined || newContent === undefined) {
    if (fs.existsSync(targetPath)) {
      newContent = fs.readFileSync(targetPath, 'utf-8');

      const backupPath = targetPath + '.bak';
      if (fs.existsSync(backupPath)) {
        oldContent = fs.readFileSync(backupPath, 'utf-8');
      } else {
        try {
          const gitDiff = execFileSync('git', ['show', `HEAD:${path.relative(projectDir, targetPath).replace(/\\/g, '/')}`], {
            cwd: projectDir,
            encoding: 'utf-8',
            windowsHide: true
          });
          oldContent = gitDiff;
        } catch {
          oldContent = newContent;
        }
      }
    } else {
      return {
        omissionDetected: false,
        deletedSymbols: [],
        deletedCount: 0,
        details: `File not found: ${relativeFilePath}`
      };
    }
  }

  const oldSyms = extractSymbols(oldContent);
  const newSyms = extractSymbols(newContent);

  const deletedSymbols = oldSyms.filter(sym => !newSyms.includes(sym));
  const omissionDetected = deletedSymbols.length > 0;

  return {
    omissionDetected,
    deletedSymbols,
    deletedCount: deletedSymbols.length,
    details: omissionDetected
      ? `⚠️ ${deletedSymbols.length} UI/function symbols lost during modification: ${deletedSymbols.slice(0, 5).join(', ')}`
      : 'No UI or function symbol omissions detected.'
  };
}

module.exports = {
  extractSymbols,
  analyzeSymbolDiff
};
