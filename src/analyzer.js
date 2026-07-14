const fs = require('fs');
const path = require('path');

/**
 * Recursively find all files with specific extensions in a directory
 */
function findFiles(dir, extensions, excludeDirs = ['node_modules', '.git', '.vibe-diagnosis', 'dist', 'build']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (excludeDirs.includes(file)) continue;
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

/**
 * 1. Analyze CSS Layout Integrity (Responsive flex/grid ratio vs static px)
 */
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
      // Ignore read errors
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

/**
 * 2. Analyze Sound & Asset Independence (Local/WebAudio vs external CDNs)
 */
function analyzeAssets(projectDir) {
  const sourceFiles = findFiles(projectDir, ['.ts', '.tsx', '.js', '.jsx', '.html']);
  let externalUrlsCount = 0;
  let webAudioDetected = false;

  const urlRegex = /https?:\/\/[\w\-\.]+\.\w+[\/\w\-\.\?\=\&\#]*/gi;
  const webAudioTerms = /(AudioContext|OscillatorNode|createOscillator|GainNode|createGain|synthesizer|synth)/i;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check external asset URLs
      const urls = content.match(urlRegex) || [];
      const assetUrls = urls.filter(u => /\.(png|jpg|jpeg|gif|mp3|wav|ogg|aac|woff|woff2|svg)$/i.test(u));
      externalUrlsCount += assetUrls.length;

      // Check Web Audio API hooks
      if (webAudioTerms.test(content)) {
        webAudioDetected = true;
      }
    } catch (err) {
      // Ignore read errors
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

/**
 * 3. Dead Code & Debt Index
 */
function analyzeDeadCode(projectDir) {
  const sourceFiles = findFiles(projectDir, ['.ts', '.tsx', '.js', '.jsx']);
  let totalDeclarations = 0;
  let unreferencedDeclarations = 0;

  // Simple heuristic regex patterns for unreferenced variables (unexported let/const)
  const unusedRegex = /(?:let|const|var)\s+([\w_]+)\s*=\s*/g;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      
      while ((match = unusedRegex.exec(content)) !== null) {
        const varName = match[1];
        totalDeclarations++;

        // Simple check: if the variable name only appears once (the declaration itself), it is unused.
        const occurrences = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
        if (occurrences === 1) {
          unreferencedDeclarations++;
        }
      }
    } catch (err) {
      // Ignore
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

/**
 * Synthesize All Metrics & Calculate Build Predictor Score
 */
function runHeuristicMetrics(projectDir, totalDiags = 0, passedDiags = 0) {
  const css = analyzeCss(projectDir);
  const assets = analyzeAssets(projectDir);
  const debt = analyzeDeadCode(projectDir);

  // Configuration check heuristics
  const hasTsConfig = fs.existsSync(path.join(projectDir, 'tsconfig.json'));
  const hasPackageJson = fs.existsSync(path.join(projectDir, 'package.json'));

  const passRate = totalDiags > 0 ? passedDiags / totalDiags : 1.0;

  // Predictor formula weights:
  // - 65% on Diagnostic Pass Rate
  // - 15% on UI Integrity (A+ -> 100, A -> 90, B -> 70, C -> 50, etc.)
  // - 10% on Code Debt Cleanness (100 - debtPercent)
  // - 10% on Config File Existence (5% tsconfig, 5% package.json)
  let uiWeight = 100;
  if (css.grade === 'A') uiWeight = 90;
  else if (css.grade === 'B') uiWeight = 70;
  else if (css.grade === 'C') uiWeight = 50;
  else if (css.grade === 'D') uiWeight = 30;
  else if (css.grade === 'F') uiWeight = 10;

  const configWeight = (hasTsConfig ? 50 : 0) + (hasPackageJson ? 50 : 0); // 0 to 100
  const codeCleanness = 100 - debt.deadCodeDebtPercent;

  let predictorScore = (0.65 * passRate * 100) + 
                       (0.15 * uiWeight) + 
                       (0.10 * codeCleanness) + 
                       (0.10 * configWeight);

  // Cap it nicely
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

module.exports = {
  analyzeCss,
  analyzeAssets,
  analyzeDeadCode,
  runHeuristicMetrics
};
