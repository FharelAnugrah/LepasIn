/**
 * Menahan tombol Enter pada elemen <input> agar form multi-kolom / modal
 * tidak tersubmit secara tidak sengaja sebelum pengguna menekan tombol Simpan.
 * Tetap mengizinkan Enter di <textarea> untuk baris baru dan di <button type="submit">.
 *
 * @param {KeyboardEvent | import('react').KeyboardEvent<HTMLFormElement>} e
 */
export function preventEnterSubmitOnInput(e) {
  if (e.key === 'Enter' && e.target?.tagName === 'INPUT') {
    e.preventDefault();
  }
}

/**
 * Menggulir viewport ke elemen form pertama yang gagal validasi (hanya jika belum terlihat
 * di area aman viewport) dan memfokuskannya tanpa memicu toast duplikat.
 *
 * @param {string[]} fieldIds
 */
export function focusFirstInvalidField(fieldIds) {
  if (typeof document === 'undefined' || !Array.isArray(fieldIds) || fieldIds.length === 0) {
    return;
  }
  requestAnimationFrame(() => {
    for (const id of fieldIds) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        const topSafeOffset = 88;
        const bottomSafeOffset = 40;
        const availableHeight = window.innerHeight - topSafeOffset - bottomSafeOffset;
        const isInViewport =
          rect.height > availableHeight
            ? rect.top <= window.innerHeight - bottomSafeOffset && rect.bottom >= topSafeOffset
            : rect.top >= topSafeOffset && rect.bottom <= window.innerHeight - bottomSafeOffset;

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (typeof el.focus === 'function') {
          el.focus({ preventScroll: true });
        }
        return;
      }
    }
  });
}
