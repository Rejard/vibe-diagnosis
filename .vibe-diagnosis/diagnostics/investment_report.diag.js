const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'investment_report',
  name: 'Investment Report HTML Validation',
  layer: 'TASK',

  async run(ctx) {
    const filePath = path.join(ctx.projectDir, 'investment_comparison.html');

    if (!fs.existsSync(filePath)) {
      return {
        status: 'FAIL',
        details: 'investment_comparison.html 파일이 존재하지 않습니다.'
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    const requiredTerms = [
      'oh-my-openagent',
      'vibe-diagnosis',
      'Investment Thesis',
      'Datadog',
      'Sentry',
      'Reliability'
    ];

    const missingTerms = requiredTerms.filter(term => !content.includes(term));

    if (missingTerms.length > 0) {
      return {
        status: 'FAIL',
        details: `HTML 리포트에 필수 단어가 누락되었습니다: ${missingTerms.join(', ')}`
      };
    }

    if (!content.includes('<!DOCTYPE html>') || !content.includes('</html>')) {
      return {
        status: 'FAIL',
        details: '올바른 HTML5 문서 형식이 아닙니다.'
      };
    }

    return {
      status: 'OK',
      details: '투자 가능성 비교 HTML 리포트가 성공적으로 검증되었습니다.'
    };
  }
};
