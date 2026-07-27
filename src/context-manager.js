const fs = require('fs');
const path = require('path');

function getContextFilePath(projectDir) {
  return path.join(projectDir, '.vibe-diagnosis', 'active_context.json');
}

function saveAiContext(projectDir, contextData = {}) {
  const filePath = getContextFilePath(projectDir);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing = {};
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      existing = {};
    }
  }

  const updated = {
    ...existing,
    ...contextData,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');

  return {
    saved: true,
    filePath,
    context: updated
  };
}

function readAiContext(projectDir) {
  const filePath = getContextFilePath(projectDir);

  if (!fs.existsSync(filePath)) {
    return {
      currentGoal: 'Not specified',
      lastTask: null,
      updatedAt: null,
      diagnosticSummary: null
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data;
  } catch {
    return {
      currentGoal: 'Corrupted context file',
      lastTask: null,
      updatedAt: null
    };
  }
}

module.exports = {
  saveAiContext,
  readAiContext
};
