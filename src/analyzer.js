const fs = require('fs');
const path = require('path');
const { parseAst, walk } = require('./assertions');




function findFiles(dir, extensions, excludeDirs = ['node_modules', '.git', '.vibe-diagnosis', 'dist', 'build', 'backups', 'reports', 'scratch', 'uploads', 'temp_uploads', '.codex-remote-attachments']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      if (excludeDirs.includes(file)) continue;
      if (file === 'research' && fs.existsSync(path.join(dir, '.alobtc-aidl-research.quarantine'))) continue;
      results = results.concat(findFiles(filePath, extensions, excludeDirs));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}




function analyzeCss(projectDir) {
  const cssFiles = findFiles(projectDir, ['.css']);
  let totalMatches = 0;
  let dynamicMatches = 0;
  let staticPxMatches = 0;

  const dynamicRegex = /(flex|grid|rem|em|vh|vw|%|clamp|calc|repeat|auto-fit|auto-fill)/gi;
  const staticPxRegex = /\b\d+px\b/gi;

  for (const file of cssFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      const dynCount = (content.match(dynamicRegex) || []).length;
      const pxCount = (content.match(staticPxRegex) || []).length;

      dynamicMatches += dynCount;
      staticPxMatches += pxCount;
      totalMatches += (dynCount + pxCount);
    } catch (err) {

    }
  }

  const ratio = totalMatches > 0 ? (dynamicMatches / totalMatches) * 100 : 100;
  let grade = 'F';
  if (ratio >= 90) grade = 'A+';
  else if (ratio >= 80) grade = 'A';
  else if (ratio >= 65) grade = 'B';
  else if (ratio >= 50) grade = 'C';
  else if (ratio >= 35) grade = 'D';

  return {
    grade,
    dynamicFlexRatio: Math.round(ratio * 10) / 10,
    details: totalMatches > 0 
      ? `Found ${dynamicMatches} dynamic tokens vs ${staticPxMatches} static px declarations in ${cssFiles.length} CSS file(s).`
      : 'No CSS files found. Defaulting to adaptive rendering safety.'
  };
}




function analyzeAssets(projectDir) {
  const sourceFiles = findFiles(projectDir, ['.ts', '.tsx', '.js', '.jsx', '.html']);
  let externalUrlsCount = 0;
  let webAudioDetected = false;

  const urlRegex = /https?:\/\/[\w\-\.]+\.\w+[\/\w\-\.\?\=\&\#]*/gi;
  const webAudioTerms = /(AudioContext|OscillatorNode|createOscillator|GainNode|createGain|synthesizer|synth)/i;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');


      const urls = content.match(urlRegex) || [];
      const assetUrls = urls.filter(u => /\.(png|jpg|jpeg|gif|mp3|wav|ogg|aac|woff|woff2|svg)$/i.test(u));
      externalUrlsCount += assetUrls.length;


      if (webAudioTerms.test(content)) {
        webAudioDetected = true;
      }
    } catch (err) {

    }
  }

  let level = 'BRONZE';
  if (externalUrlsCount === 0 && webAudioDetected) {
    level = 'GOLD';
  } else if (externalUrlsCount === 0) {
    level = 'SILVER';
  }

  return {
    level,
    audioSynthesized: webAudioDetected,
    externalAssetsDetected: externalUrlsCount,
    details: level === 'GOLD'
      ? 'Pure Web Audio synthesis detected with zero external network asset dependencies.'
      : level === 'SILVER'
      ? 'No external network asset URLs found, but raw local files are bundling.'
      : `Dependent on ${externalUrlsCount} external CDN asset(s). Offline integrity limited.`
  };
}




function analyzeDeadCode(projectDir) {
  const sourceFiles = findFiles(projectDir, ['.ts', '.tsx', '.js', '.jsx']);
  let totalDeclarations = 0;
  let unreferencedDeclarations = 0;


  const unusedRegex = /(?:let|const|var)\s+([\w_]+)\s*=\s*/g;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      
      while ((match = unusedRegex.exec(content)) !== null) {
        const varName = match[1];
        totalDeclarations++;


        const occurrences = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
        if (occurrences === 1) {
          unreferencedDeclarations++;
        }
      }
    } catch (err) {

    }
  }

  const debtPercent = totalDeclarations > 0 ? (unreferencedDeclarations / totalDeclarations) * 100 : 0;

  return {
    deadCodeDebtPercent: Math.round(debtPercent * 10) / 10,
    totalDeclarations,
    unusedDeclarations: unreferencedDeclarations,
    details: totalDeclarations > 0
      ? `Clean code indicator: ${totalDeclarations - unreferencedDeclarations} active declarations / ${unreferencedDeclarations} unreferenced local bindings.`
      : 'Standard zero-debt quality level.'
  };
}




function runHeuristicMetrics(projectDir, totalDiags = 0, passedDiags = 0) {
  const css = analyzeCss(projectDir);
  const assets = analyzeAssets(projectDir);
  const debt = analyzeDeadCode(projectDir);


  const hasTsConfig = fs.existsSync(path.join(projectDir, 'tsconfig.json'));
  const hasPackageJson = fs.existsSync(path.join(projectDir, 'package.json'));

  const passRate = totalDiags > 0 ? passedDiags / totalDiags : 1.0;






  let uiWeight = 100;
  if (css.grade === 'A') uiWeight = 90;
  else if (css.grade === 'B') uiWeight = 70;
  else if (css.grade === 'C') uiWeight = 50;
  else if (css.grade === 'D') uiWeight = 30;
  else if (css.grade === 'F') uiWeight = 10;

  const configWeight = (hasTsConfig ? 50 : 0) + (hasPackageJson ? 50 : 0);
  const codeCleanness = 100 - debt.deadCodeDebtPercent;

  let predictorScore = (0.65 * passRate * 100) + 
                       (0.15 * uiWeight) + 
                       (0.10 * codeCleanness) + 
                       (0.10 * configWeight);


  if (predictorScore > 100) predictorScore = 100;
  if (predictorScore < 0) predictorScore = 0;

  return {
    buildPredictorScore: Math.round(predictorScore * 10) / 10,
    deadCodeDebtPercent: debt.deadCodeDebtPercent,
    uiIntegrity: css,
    assetIndependence: assets,
    config: {
      hasTsConfig,
      hasPackageJson
    }
  };
}

function loadConfig(projectDir) {
  try {
    const cfgPath = path.join(projectDir, '.vibe-diagnosis', 'config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    }
  } catch {}
  return {};
}

function analyzeMonolithicUiFiles(projectDir, customConfig) {
  const config = customConfig || loadConfig(projectDir);
  const uiThreshold = config.uiThresholdLines || 300;
  const logicThreshold = config.logicThresholdLines || 600;

  const uiFiles = findFiles(projectDir, ['.jsx', '.tsx', '.vue', '.svelte', '.html']);
  const logicFiles = findFiles(projectDir, ['.js', '.ts', '.py', '.go', '.java', '.cs']);

  const warnings = [];
  const blockRegex = /(?:<(?:[A-Z]\w*)?(?:Card|Section|Block|Tab|Panel|View|Tile)\b|class(?:Name)?=["'][^"']*\b(?:card|section|block|tab-pane|panel)\b|<section\b|<article\b)/gi;


  for (const file of uiFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      const blockMatches = content.match(blockRegex) || [];
      const blockCount = blockMatches.length;

      const relPath = path.relative(projectDir, file);

      if (lines >= uiThreshold) {
        warnings.push(
          `⚠️ \`${relPath}\` (${lines} lines, ${blockCount} UI block elements): UI component exceeds adaptive threshold (${uiThreshold} lines). High risk of UI block omission during AI vibe coding. Recommending modularization into cartridge components under components/cartridges/.`
        );
      }
    } catch {}
  }


  for (const file of logicFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      const relPath = path.relative(projectDir, file);

      if (lines >= logicThreshold) {
        warnings.push(
          `⚠️ \`${relPath}\` (${lines} lines): Backend/Logic file exceeds adaptive threshold (${logicThreshold} lines). High risk of logic regression during AI edits. Consider splitting into modular cartridges.`
        );
      }
    } catch {}
  }

  return {
    warnings,
    scannedFilesCount: uiFiles.length + logicFiles.length
  };
}

function analyzeCartridgeIntegrity(projectDir, customConfig) {
  const config = customConfig || loadConfig(projectDir);
  const errors = [];

  const cartridgeDir = path.join(projectDir, 'src', 'components', 'cartridges');
  const altCartridgeDir = path.join(projectDir, 'components', 'cartridges');

  const requiredCartridges = config.requiredCartridges || [];
  const requiredSymbols = config.requiredSymbols || [];

  for (const req of requiredCartridges) {
    const found = [cartridgeDir, altCartridgeDir].some(dir => {
      if (!fs.existsSync(dir)) return false;
      const files = fs.readdirSync(dir);
      const expected = req.toLowerCase().replace(/\.(?:jsx?|tsx?|vue|svelte)$/i, '');
      return files.some(file => path.basename(file, path.extname(file)).toLowerCase() === expected);
    });

    if (!found) {
      errors.push(`🚨 Required cartridge component "${req}" is missing or deleted from components/cartridges/`);
    }
  }

  const allSourceFiles = findFiles(projectDir, ['.jsx', '.tsx', '.js', '.ts']);
  for (const sym of requiredSymbols) {
    let symFound = false;
    for (const file of allSourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const expected = String(sym).replace(/^<|\/?\s*>$/g, '').trim();
        let found = false;
        if (/^[A-Za-z_$][\w$]*$/.test(expected)) {
          try {
            const ast = parseAst(content);
            walk(ast, node => {
              if (node.type === 'Identifier' && node.name === expected) found = true;
            });
          } catch {
            const jsxTag = new RegExp(`<\\/?\\s*${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|/?>)`);
            found = jsxTag.test(content);
          }
        }
        if (found) {
          symFound = true;
          break;
        }
      } catch {}
    }

    if (!symFound) {
      errors.push(`🚨 Required symbol or JSX tag "${sym}" is missing across project source files`);
    }
  }

  return {
    errors,
    details: errors.length === 0
      ? 'All cartridge components and required symbols verified.'
      : `Detected ${errors.length} integrity violations.`
  };
}

module.exports = {
  analyzeCss,
  analyzeAssets,
  analyzeDeadCode,
  runHeuristicMetrics,
  analyzeMonolithicUiFiles,
  analyzeCartridgeIntegrity
};

