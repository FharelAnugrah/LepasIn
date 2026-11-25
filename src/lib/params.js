/**
 * Parse query param ID menjadi bilangan bulat positif, atau null jika kosong / 'all' / tidak valid.
 * @param {string|string[]|null|undefined} value
 * @returns {number|null}
 */
export function parsePositiveInt(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = String(raw).trim();
  if (!normalized || normalized.toLowerCase() === 'all') {
    return null;
  }
  const num = Number(normalized);
  return Number.isInteger(num) && num > 0 ? num : null;
}

/**
 * Parse query param angka non-negatif (mis. filter harga), atau null jika kosong / tidak valid.
 * @param {string|string[]|null|undefined} value
 * @returns {number|null}
 */
export function parseNonNegativeInt(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = String(raw).trim();
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  return Number.isInteger(num) && num >= 0 ? num : null;
}

/**
 * Escape karakter wildcard LIKE/ILIKE (%, _, \) agar diperlakukan sebagai karakter literal
 * bersama klausa SQL `ESCAPE '\'`.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function escapeLikePattern(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\\%_]/g, '\\$&');
}

/**
 * Konversi kata kunci pencarian menjadi pola ILIKE `%...%` yang aman dari wildcard,
 * atau null jika kosong / hanya spasi.
 * @param {string|string[]|null|undefined} value
 * @returns {string|null}
 */
export function toIlikeSearchPattern(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return `%${escapeLikePattern(trimmed)}%`;
}

/**
 * Validasi path tujuan kembali (returnUrl) agar tetap berada di origin yang sama
 * dan mencegah loop ke halaman /chat, /login, /register, atau /pending-seller.
 * @param {string|string[]|null|undefined} value
 * @returns {string|null}
 */
export function getSafeReturnUrl(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (
    !trimmed ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /[\r\n\t\0\\]/.test(trimmed)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return null;

    const p = parsed.pathname;
    if (
      p === '/chat' ||
      p.startsWith('/chat/') ||
      p === '/login' ||
      p.startsWith('/login/') ||
      p === '/register' ||
      p.startsWith('/register/') ||
      p === '/pending-seller' ||
      p.startsWith('/pending-seller/')
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
