const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'advanced-omission-guard-feature',
  name: '3 Advanced Omission Protection Modules Verification',
  layer: 'SYSTEM',
  linkedTask: 'Advanced Omission Guard',

  async run({ projectDir }) {
    const symbolGuardPath = path.join(projectDir, 'src', 'symbol-guard.js');
    if (!fs.existsSync(symbolGuardPath)) {
      return { status: 'ERROR', details: 'src/symbol-guard.js missing' };
    }

    delete require.cache[require.resolve(symbolGuardPath)];
    const symbolGuard = require(symbolGuardPath);
    if (typeof symbolGuard.analyzeSymbolDiff !== 'function') {
      return { status: 'ERROR', details: 'analyzeSymbolDiff function missing in src/symbol-guard.js' };
    }

    const splitterPath = path.join(projectDir, 'src', 'cartridge-splitter.js');
    if (!fs.existsSync(splitterPath)) {
      return { status: 'ERROR', details: 'src/cartridge-splitter.js missing' };
    }

    delete require.cache[require.resolve(splitterPath)];
    const splitter = require(splitterPath);
    if (typeof splitter.generateCartridgeBlueprint !== 'function') {
      return { status: 'ERROR', details: 'generateCartridgeBlueprint function missing in src/cartridge-splitter.js' };
    }

    const repairerPath = path.join(projectDir, 'src', 'repairer.js');
    delete require.cache[require.resolve(repairerPath)];
    const repairer = require(repairerPath);
    if (typeof repairer.autoRevertOrRepairOmission !== 'function') {
      return { status: 'ERROR', details: 'autoRevertOrRepairOmission function missing in src/repairer.js' };
    }

    const testDir = path.join(projectDir, '.vibe-diagnosis', 'scratch_test_guard');
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
      fs.mkdirSync(testDir, { recursive: true });

      const mockFile = path.join(testDir, 'SampleMonolithic.jsx');
      const mockCode = `
import React from 'react';

export function SampleMonolithic() {
  return (
    <div>
      <HeaderCard title="Header" />
      <AssetOverviewCard data={123} />
      <TransactionHistoryCard list={[]} />
      <SettingsPanelCard active={true} />
    </div>
  );
}
`;
      fs.writeFileSync(mockFile, mockCode, 'utf-8');

      const blueprint = splitter.generateCartridgeBlueprint(testDir, 'SampleMonolithic.jsx');
      if (!blueprint || !blueprint.suggestedCartridges || blueprint.suggestedCartridges.length === 0) {
        return { status: 'ERROR', details: 'generateCartridgeBlueprint failed to detect UI cards in SampleMonolithic.jsx' };
      }

      const diffResult = symbolGuard.analyzeSymbolDiff(testDir, 'SampleMonolithic.jsx', mockCode, '<div>Minimal</div>');
      if (!diffResult.omissionDetected || diffResult.deletedSymbols.length === 0) {
        return { status: 'ERROR', details: 'analyzeSymbolDiff failed to detect missing cards when content changed to Minimal' };
      }
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }

    return {
      status: 'OK',
      details: 'All 3 advanced omission protection modules verified successfully.'
    };
  }
};
