export const PRODUCT_NAME_MIN_LENGTH = 3;
export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PRODUCT_MIN_PRICE = 1000;
export const PRODUCT_MAX_PRICE = 100_000_000;
export const PRODUCT_MAX_ORIGINAL_PRICE = 200_000_000;

export const ALLOWED_PRODUCT_NAME_REGEX = /^[A-Za-z0-9 .,()&+\/|-]+$/;
const ALLOWED_PRODUCT_NAME_CHAR_REGEX = /^[A-Za-z0-9 .,()&+\/|-]$/;
const HAS_ALPHANUMERIC_REGEX = /[A-Za-z0-9]/;
const CONSECUTIVE_PRODUCT_PUNCT_REGEX = /[.,\-_/|&]{2,}/;
const SPACED_PRODUCT_SEPARATOR_REGEX = /[-,\/|&]\s+[-.,\/|&]/;

const ALLOWED_CHARS_DESCRIPTION =
  'huruf (A-Z, a-z), angka (0-9), spasi, serta simbol - . , ( ) & + / |';

function isPrintableChar(ch) {
  const code = ch.codePointAt(0);
  if (code === undefined) return false;
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false;
  if ((code >= 0x200b && code <= 0x200f) || code === 0xfe0e || code === 0xfe0f) {
    return false;
  }
  return true;
}

/**
 * Merapikan spasi berlebih di awal, akhir, maupun di antara kata pada nama produk.
 * Input yang hanya berisi whitespace dinormalisasi menjadi string kosong.
 */
export function normalizeProductName(value) {
  if (typeof value !== 'string') return '';
  if (!value.trim()) return '';
  return value.replace(/[ \u00A0]+/g, ' ').replace(/^ +| +$/g, '');
}

function getDisallowedProductNameChars(value) {
  const disallowed = [];
  const seen = new Set();

  for (const ch of value) {
    if (!ALLOWED_PRODUCT_NAME_CHAR_REGEX.test(ch) && !seen.has(ch)) {
      seen.add(ch);
      disallowed.push(ch);
    }
  }

  return disallowed;
}

function formatDisallowedCharsMessage(disallowedChars) {
  const visible = disallowedChars.filter(isPrintableChar);
  if (visible.length === 0) {
    return `Nama barang mengandung karakter yang tidak diperbolehkan. Hanya boleh berisi ${ALLOWED_CHARS_DESCRIPTION}.`;
  }
  const preview =
    visible.length > 3 ? `${visible.slice(0, 3).join(', ')}, ...` : visible.join(', ');
  return `Karakter tidak diperbolehkan (${preview}). Nama barang hanya boleh berisi ${ALLOWED_CHARS_DESCRIPTION}.`;
}

/**
 * Memvalidasi nama produk sesuai aturan karakter, huruf/angka wajib,
 * panjang minimal 3 karakter, dan normalisasi spasi berlebih.
 */
export function validateProductName(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return {
      valid: false,
      code: 'REQUIRED',
      error: 'Nama barang wajib diisi (minimal 3 karakter).',
      normalizedName: '',
    };
  }

  if (typeof rawValue !== 'string') {
    return {
      valid: false,
      code: 'INVALID_TYPE',
      error: 'Nama barang harus berupa teks.',
      normalizedName: '',
    };
  }

  const normalizedName = normalizeProductName(rawValue);

  if (!normalizedName) {
    return {
      valid: false,
      code: 'REQUIRED',
      error: 'Nama barang wajib diisi (minimal 3 karakter).',
      normalizedName: '',
    };
  }

  if (!ALLOWED_PRODUCT_NAME_REGEX.test(normalizedName)) {
    const disallowedChars = getDisallowedProductNameChars(normalizedName);
    return {
      valid: false,
      code: 'DISALLOWED_CHARS',
      error: formatDisallowedCharsMessage(disallowedChars),
      normalizedName,
    };
  }

  if (!HAS_ALPHANUMERIC_REGEX.test(normalizedName)) {
    return {
      valid: false,
      code: 'NO_ALPHANUMERIC',
      error: 'Nama barang wajib diisi (minimal 3 karakter).',
      normalizedName,
    };
  }

  if (normalizedName.length < PRODUCT_NAME_MIN_LENGTH) {
    return {
      valid: false,
      code: 'TOO_SHORT',
      error: 'Nama barang wajib diisi (minimal 3 karakter).',
      normalizedName,
    };
  }

  if (normalizedName.length > PRODUCT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      code: 'TOO_LONG',
      error: `Nama barang maksimal ${PRODUCT_NAME_MAX_LENGTH} karakter.`,
      normalizedName,
    };
  }

  const alphaCount = (normalizedName.match(/[A-Za-z]/g) || []).length;
  const alnumCount = (normalizedName.match(/[A-Za-z0-9]/g) || []).length;
  if (alphaCount < 2 || alnumCount < 3) {
    return {
      valid: false,
      code: 'MEANINGLESS_NAME',
      error: 'Nama barang harus jelas (minimal memuat 2 huruf alfabet dan 3 huruf/angka).',
      normalizedName,
    };
  }

  if (
    CONSECUTIVE_PRODUCT_PUNCT_REGEX.test(normalizedName) ||
    SPACED_PRODUCT_SEPARATOR_REGEX.test(normalizedName) ||
    /^[.,\-_/|&)]/.test(normalizedName) ||
    /[-.,\/|&(]$/.test(normalizedName)
  ) {
    return {
      valid: false,
      code: 'INVALID_PUNCTUATION',
      error: 'Nama barang tidak boleh memakai tanda baca berulang atau diawali/diakhiri simbol pemisah.',
      normalizedName,
    };
  }

  return {
    valid: true,
    code: null,
    error: null,
    normalizedName,
  };
}

/**
 * Membuat schema Zod untuk validasi dan normalisasi nama produk di API backend.
 */
export function createProductNameSchema(z) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? 'Nama barang wajib diisi (minimal 3 karakter).'
          : 'Nama barang harus berupa teks.',
    })
    .transform((val) => normalizeProductName(val))
    .superRefine((normalized, ctx) => {
      const result = validateProductName(normalized);
      if (!result.valid) {
        ctx.addIssue({
          code: 'custom',
          message: result.error,
        });
      }
    });
}

export const PRODUCT_IMAGE_INVALID_ERROR =
  'Format URL gambar tidak valid. Gambar harus diunggah melalui endpoint berkas.';

/**
 * Memeriksa apakah URL gambar produk memenuhi ketentuan:
 * - String non-kosong
 * - Tidak mengandung data:image/ (Base64 ditolak)
 * - Berupa path lokal /uploads/products/ atau URL HTTPS publik
 */
export function isValidProductImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return false;
  return trimmed.startsWith('/uploads/products/') || /^https:\/\/[^\s]+$/i.test(trimmed);
}

/**
 * Memvalidasi string URL gambar produk dengan error message yang spesifik dan solutif.
 */
export function validateProductImageUrl(url) {
  if (url === undefined || url === null) {
    return {
      valid: false,
      code: 'REQUIRED',
      error: 'Wajib mengunggah minimal 1 foto produk yang jelas.',
      url: '',
    };
  }

  if (typeof url !== 'string') {
    return {
      valid: false,
      code: 'INVALID_TYPE',
      error: PRODUCT_IMAGE_INVALID_ERROR,
      url: '',
    };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return {
      valid: false,
      code: 'REQUIRED',
      error: 'Wajib mengunggah minimal 1 foto produk yang jelas.',
      url: '',
    };
  }

  if (trimmed.startsWith('data:image/')) {
    return {
      valid: false,
      code: 'BASE64_NOT_ALLOWED',
      error: PRODUCT_IMAGE_INVALID_ERROR,
      url: trimmed,
    };
  }

  if (!trimmed.startsWith('/uploads/products/') && !/^https:\/\/[^\s]+$/i.test(trimmed)) {
    return {
      valid: false,
      code: 'INVALID_FORMAT',
      error: PRODUCT_IMAGE_INVALID_ERROR,
      url: trimmed,
    };
  }

  return {
    valid: true,
    code: null,
    error: null,
    url: trimmed,
  };
}

/**
 * Membuat schema Zod untuk memvalidasi setiap elemen URL gambar produk di backend.
 */
export function createProductImageUrlSchema(z) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? 'Wajib mengunggah minimal 1 foto produk yang jelas.'
          : PRODUCT_IMAGE_INVALID_ERROR,
    })
    .trim()
    .superRefine((val, ctx) => {
      const result = validateProductImageUrl(val);
      if (!result.valid) {
        ctx.addIssue({
          code: 'custom',
          message: result.error,
        });
      }
    });
}

