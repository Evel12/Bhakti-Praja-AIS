const ASSESSMENT_CSS_PATH_RE = /assessment-module[\\/](?:styles|motion)[\\/][^?]+\.css(?:\?.*)?$/;
const TOKENS_CSS_RE = /assessment-module[\\/]motion[\\/]tokens\.css(?:\?.*)?$/;
const SKIP_ATRULES = new Set(['keyframes', '-webkit-keyframes', '-moz-keyframes', 'font-face', 'property']);

function hasSkippedParent(rule) {
  let current = rule.parent;
  while (current) {
    if (current.type === 'atrule' && SKIP_ATRULES.has(String(current.name || '').toLowerCase())) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isMotionTokensOnlyRule(rule) {
  let hasDecl = false;
  let allMotionVars = true;
  rule.walkDecls((decl) => {
    hasDecl = true;
    if (!/^--(?:motion|ease)-/.test(decl.prop)) {
      allMotionVars = false;
    }
  });
  return hasDecl && allMotionVars;
}

function scopeSingleSelector(selector, { keepRoot }) {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;

  if (trimmed.includes('::view-transition')) {
    return trimmed;
  }

  if (trimmed === ':root') {
    return keepRoot ? ':root' : '.assessment-root';
  }

  if (/^(?:html|body)$/i.test(trimmed)) {
    return '.assessment-root';
  }

  if (/^body(?=[.:#[\s>+~]|$)/i.test(trimmed)) {
    return trimmed.replace(/^body/i, '.assessment-root');
  }

  if (/^html(?=[.:#[\s>+~]|$)/i.test(trimmed)) {
    return trimmed.replace(/^html/i, '.assessment-root');
  }

  if (trimmed === '.assessment-root' || /^\.assessment-root(?=[.:#[\s>+~])/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed === '*') {
    return '.assessment-root, .assessment-root *';
  }

  return `.assessment-root ${trimmed}`;
}

export function scopeAssessmentCssPlugin() {
  return {
    postcssPlugin: 'scope-assessment-css',
    Once(root, { result }) {
      const from = String(result?.opts?.from || '');
      if (!ASSESSMENT_CSS_PATH_RE.test(from)) return;

      const entryIsTokens = TOKENS_CSS_RE.test(from);

      root.walkRules((rule) => {
        if (hasSkippedParent(rule)) return;
        if (!Array.isArray(rule.selectors) || !rule.selectors.length) return;

        const sourceFile = String(rule.source?.input?.file || from);
        const keepRoot = entryIsTokens || TOKENS_CSS_RE.test(sourceFile) || isMotionTokensOnlyRule(rule);

        rule.selectors = rule.selectors.map((sel) => scopeSingleSelector(sel, { keepRoot }));
      });
    },
  };
}
scopeAssessmentCssPlugin.postcss = true;
