const fs = require('fs');
const path = require('path');

function generateCartridgeBlueprint(projectDir, relativeFilePath) {
  const absPath = path.resolve(projectDir, relativeFilePath);
  if (!fs.existsSync(absPath)) {
    return {
      targetFile: relativeFilePath,
      lineCount: 0,
      suggestedCartridges: [],
      assemblyCodeSnippet: '',
      summary: `File not found: ${relativeFilePath}`
    };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;

  const cardTagRegex = /<((?:[A-Z]\w*)?(?:Card|Section|Block|Tab|Panel|View|Tile))\b([^>]*)\/?>/gi;
  const matches = [];
  let match;

  while ((match = cardTagRegex.exec(content)) !== null) {
    const rawTag = match[0];
    const rawName = match[1];

    let cartridgeName = rawName;
    if (!cartridgeName.endsWith('Card') && !cartridgeName.endsWith('Section')) {
      cartridgeName += 'Cartridge';
    }

    matches.push({
      cartridgeName,
      targetPath: `src/components/cartridges/${cartridgeName}.jsx`,
      extractedCode: rawTag
    });
  }

  const suggestedCartridges = matches.slice(0, 10);

  const imports = suggestedCartridges.map(c => `import { ${c.cartridgeName} } from './components/cartridges/${c.cartridgeName}';`).join('\n');
  const assemblySnippet = `${imports}\n\n// Assembly Component Layer\nexport function ${path.basename(relativeFilePath, path.extname(relativeFilePath))}Assembly() {\n  return (\n    <div>\n${suggestedCartridges.map(c => `      <${c.cartridgeName} />`).join('\n')}\n    </div>\n  );\n}`;

  return {
    targetFile: relativeFilePath,
    lineCount,
    suggestedCartridges,
    assemblyCodeSnippet: assemblySnippet,
    summary: suggestedCartridges.length > 0
      ? `Generated ${suggestedCartridges.length} cartridge splitting blueprint(s) for ${relativeFilePath}`
      : `No discrete UI card/section tags detected in ${relativeFilePath}`
  };
}

module.exports = {
  generateCartridgeBlueprint
};
