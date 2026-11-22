export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Validasi magic bytes file gambar asli
 */
export function isValidImageMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === 'image/webp') {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  return false;
}

/**
 * Memproses dan memvalidasi input gambar:
 * - Objek File / Blob langsung ditolak (harus diunggah via /api/upload)
 * - String URL / path dikembalikan untuk divalidasi ketat oleh schema produk
 * @param {File|Blob|string} item
 * @returns {Promise<string>} Path atau URL gambar
 */
export async function processImageInput(item) {
  if (!item) return null;

  // Jika berupa objek File / Blob langsung pada payload produk (harus lewat /api/upload)
  if (typeof item === 'object' && typeof item.arrayBuffer === 'function') {
    throw new Error(
      'Format URL gambar tidak valid. Gambar harus diunggah melalui endpoint berkas.'
    );
  }

  // Jika berupa string (path atau URL gambar)
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return trimmed;
  }

  return null;
}

/**
 * Ekstrak dan konversi seluruh gambar dari FormData atau JSON payload
 * @param {FormData|object} container
 * @returns {Promise<string[]>} Daftar URL/Data URL gambar
 */
export async function extractAndProcessImages(container) {
  const rawList = [];

  if (typeof container.getAll === 'function') {
    // Berasal dari FormData
    const entries = [
      ...container.getAll('images'),
      ...container.getAll('files'),
      ...container.getAll('image_urls'),
      ...container.getAll('image_urls[]'),
    ];

    for (const entry of entries) {
      if (!entry) continue;

      // Jika ada JSON string array di dalam FormData
      if (typeof entry === 'string' && entry.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(entry);
          if (Array.isArray(parsed)) {
            rawList.push(...parsed);
            continue;
          }
        } catch {
          // Lanjutkan sebagai string biasa
        }
      }

      rawList.push(entry);
    }
  } else if (container && Array.isArray(container.image_urls)) {
    rawList.push(...container.image_urls);
  }

  const results = [];
  for (const item of rawList) {
    const processed = await processImageInput(item);
    if (processed) {
      results.push(processed);
    }
  }

  return results;
}
