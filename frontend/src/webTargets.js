export const ASSESSMENT_URL_STORAGE_KEY = 'ais_assessment_target_url';
export const DEFAULT_ASSESSMENT_URL = 'http://127.0.0.1/';

function readEnvAssessmentUrl() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env
      ? String(import.meta.env.VITE_ASSESSMENT_URL || '').trim()
      : '';
  } catch {
    return '';
  }
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function normalizeWebTargetUrl(rawUrl) {
  const cleaned = String(rawUrl ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

  if (!cleaned) {
    return { valid: false, error: 'Alamat web tujuan tidak boleh kosong.' };
  }

  if (
    /^(javascript|data|vbscript|file):/i.test(cleaned) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\/\/|\d+(?:[/?#]|$))/.test(cleaned)
  ) {
    return { valid: false, error: 'Skema URL tidak diizinkan. Gunakan http:// atau https://.' };
  }

  if (cleaned.startsWith('/') && !cleaned.startsWith('//')) {
    return { valid: true, url: cleaned };
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)
    ? cleaned
    : `http://${cleaned}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Gunakan protokol http:// atau https:// yang valid.' };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'Host pada URL tujuan tidak valid.' };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, error: 'Format URL tidak valid. Contoh: http://127.0.0.1/' };
  }
}

export function getDefaultAssessmentUrl({ envUrl } = {}) {
  const configured = String(envUrl ?? readEnvAssessmentUrl()).trim();
  if (configured) {
    const normalized = normalizeWebTargetUrl(configured);
    if (normalized.valid) return normalized.url;
  }

  return DEFAULT_ASSESSMENT_URL;
}

export function getStoredAssessmentUrl({ storage, envUrl } = {}) {
  const fallbackUrl = getDefaultAssessmentUrl({ envUrl });
  const targetStorage = resolveStorage(storage);

  try {
    const saved = targetStorage?.getItem?.(ASSESSMENT_URL_STORAGE_KEY);
    if (saved) {
      const normalized = normalizeWebTargetUrl(saved);
      if (normalized.valid) {
        return { url: normalized.url, isCustom: normalized.url !== fallbackUrl };
      }
    }
  } catch {
    // Abaikan jika penyimpanan browser diblokir.
  }

  return { url: fallbackUrl, isCustom: false };
}

export function saveStoredAssessmentUrl(rawUrl, { storage } = {}) {
  const normalized = normalizeWebTargetUrl(rawUrl);
  if (!normalized.valid) return normalized;

  const targetStorage = resolveStorage(storage);
  try {
    targetStorage?.setItem?.(ASSESSMENT_URL_STORAGE_KEY, normalized.url);
  } catch {
    // Abaikan kegagalan penyimpanan jika mode privat aktif.
  }

  return normalized;
}

export function clearStoredAssessmentUrl({ storage, envUrl } = {}) {
  const targetStorage = resolveStorage(storage);
  try {
    targetStorage?.removeItem?.(ASSESSMENT_URL_STORAGE_KEY);
  } catch {
    // Abaikan kegagalan penyimpanan.
  }

  return getDefaultAssessmentUrl({ envUrl });
}

export function getInitialTargetWeb(search = '') {
  const query = search || (typeof window !== 'undefined' ? window.location.search : '');
  try {
    const params = new URLSearchParams(query);
    const target = params.get('target') || params.get('portal');
    return target === 'assessment' ? 'assessment' : 'ais';
  } catch {
    return 'ais';
  }
}
