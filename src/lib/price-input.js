/**
 * Membersihkan input nominal harga sehingga hanya menyisakan digit angka bulat.
 *
 * @param {string|number|null|undefined} value
 * @param {number} [maxDigits=12]
 * @returns {string}
 */
export function sanitizePriceDigits(value, maxDigits = 12) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxDigits);
}

/**
 * Memformat string digit angka menjadi pemisah ribuan titik khas Indonesia (mis. "50000" -> "50.000").
 * Menggunakan grouping regex agar string kosong maupun digit saat mengetik tetap konsisten.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatThousandDots(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Menghasilkan ringkasan skala nominal yang mudah dibaca (ribu / juta / miliar)
 * agar pengguna langsung yakin tidak kelebihan atau kekurangan angka nol.
 *
 * @param {string|number|null|undefined} rawValue
 * @returns {string}
 */
export function formatRupiahScaleHint(rawValue) {
  const str = String(rawValue ?? '').trim();
  if (!str || /^0\d+/.test(str) || !/^\d+$/.test(str)) {
    return '';
  }

  const amount = Number(str);
  if (!Number.isFinite(amount) || amount < 1000) {
    return '';
  }

  const formatUnit = (val, maxFractionDigits) =>
    val.toLocaleString('id-ID', { maximumFractionDigits: maxFractionDigits });

  if (amount >= 1_000_000_000) {
    const isExact = amount % 10_000_000 === 0;
    return `${isExact ? 'Senilai' : 'Sekitar'} Rp ${formatUnit(amount / 1_000_000_000, 2)} miliar`;
  }

  if (amount >= 1_000_000) {
    const isExact = amount % 1_000 === 0;
    return `${isExact ? 'Senilai' : 'Sekitar'} Rp ${formatUnit(amount / 1_000_000, isExact ? 3 : 2)} juta`;
  }

  const isExact = amount % 10 === 0;
  return `${isExact ? 'Senilai' : 'Sekitar'} Rp ${formatUnit(amount / 1_000, isExact ? 2 : 1)} ribu`;
}

/**
 * Menghitung persentase hemat antara harga lepas dan harga asli baru (jika valid dan lebih besar).
 *
 * @param {string|number|null|undefined} priceRaw
 * @param {string|number|null|undefined} originalPriceRaw
 * @returns {number|null}
 */
export function getDiscountPercent(priceRaw, originalPriceRaw) {
  const priceStr = String(priceRaw ?? '').trim();
  const origStr = String(originalPriceRaw ?? '').trim();
  if (
    !/^\d+$/.test(priceStr) ||
    !/^\d+$/.test(origStr) ||
    /^0\d+/.test(priceStr) ||
    /^0\d+/.test(origStr)
  ) {
    return null;
  }

  const price = Number(priceStr);
  const orig = Number(origStr);
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(orig) ||
    price < 1000 ||
    orig <= price ||
    orig > 100_000_000
  ) {
    return null;
  }

  const pct = Math.round(((orig - price) / orig) * 100);
  return pct > 0 ? pct : null;
}

/**
 * Menghitung jumlah karakter digit [0-9] di sebelah kiri indeks kursor.
 *
 * @param {string} text
 * @param {number} [cursorIndex]
 * @returns {number}
 */
export function countDigitsBeforeCursor(text, cursorIndex) {
  const limit = Math.max(0, Math.min(cursorIndex ?? text.length, text.length));
  let count = 0;
  for (let i = 0; i < limit; i++) {
    if (text[i] >= '0' && text[i] <= '9') {
      count += 1;
    }
  }
  return count;
}

/**
 * Menemukan indeks kursor pada string terformat setelah melewati `targetDigitCount` digit.
 *
 * @param {string} formattedText
 * @param {number} targetDigitCount
 * @returns {number}
 */
export function findCursorPosForDigitCount(formattedText, targetDigitCount) {
  if (targetDigitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formattedText.length; i++) {
    if (formattedText[i] >= '0' && formattedText[i] <= '9') {
      seen += 1;
      if (seen === targetDigitCount) {
        return i + 1;
      }
    }
  }
  return formattedText.length;
}

/**
 * Menghapus satu digit pada indeks 0-based tertentu dari string digit murni.
 *
 * @param {string} digits
 * @param {number} zeroBasedDigitIndex
 * @returns {string}
 */
export function removeDigitAtOccurrence(digits, zeroBasedDigitIndex) {
  if (zeroBasedDigitIndex < 0 || zeroBasedDigitIndex >= digits.length) {
    return digits;
  }
  return digits.slice(0, zeroBasedDigitIndex) + digits.slice(zeroBasedDigitIndex + 1);
}
