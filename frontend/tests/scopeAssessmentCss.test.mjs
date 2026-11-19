import test from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { scopeAssessmentCssPlugin } from '../scripts/scopeAssessmentCss.mjs';

test('scopes design-system rules under .assessment-root while keeping motion tokens on :root', async () => {
  const designResult = await postcss([scopeAssessmentCssPlugin()]).process(
    ':root { --ink: #172033; } body { margin: 0; } button { border: 0; } .panel { padding: 16px; }',
    { from: 'D:/repo/frontend/src/assessment-module/styles/design-system.css' },
  );
  assert.match(designResult.css, /^\.assessment-root \{ --ink: #172033; \}/);
  assert.match(designResult.css, /\.assessment-root \{ margin: 0; \}/);
  assert.match(designResult.css, /\.assessment-root button \{ border: 0; \}/);
  assert.match(designResult.css, /\.assessment-root \.panel \{ padding: 16px; \}/);
  assert.doesNotMatch(designResult.css, /^:root\b/m);

  const tokensResult = await postcss([scopeAssessmentCssPlugin()]).process(
    ':root { --ease-liquid: cubic-bezier(0.34, 1.56, 0.64, 1); --motion-duration-fast: 160ms; }',
    { from: 'D:/repo/frontend/src/assessment-module/motion/tokens.css' },
  );
  assert.match(tokensResult.css, /^:root \{/);

  const aisResult = await postcss([scopeAssessmentCssPlugin()]).process(
    'body { margin: 0; }',
    { from: 'D:/repo/frontend/src/index.css' },
  );
  assert.equal(aisResult.css, 'body { margin: 0; }');
});
