// Aturan upload foto produk dari perangkat operator.
//
// Akar masalahnya: `imageUrl` selama ini hanya bisa diisi URL yang diketik manual,
// sehingga foto yang adanya di laptop/HP operator tidak pernah bisa masuk katalog.
// Endpoint `POST /products/:id/image` menutup celah itu: file diterima, divalidasi,
// disimpan di disk server cabang, dan `imageUrl` diisi URL http(s) yang bisa
// dimuat browser LAN — format yang sudah diterima validator `IsHttpImageUrl`.
//
// File ini hanya berisi fungsi murni agar bisa diuji tanpa database:
// `tests/product-image-upload.test.mjs` menjalankannya lewat import-ts helper.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/** Batas 5 MiB: cukup untuk foto katalog HP, terlalu kecil untuk disalahgunakan sebagai file store. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export function imageStorageRoot(): string {
  return resolve(process.env.PRODUCT_IMAGE_DIR ?? 'uploads/product-images');
}

/** Root kategori terpisah supaya lifecycle file-nya tidak tercampur dengan produk. */
export function categoryImageStorageRoot(): string {
  return resolve(process.env.CATEGORY_IMAGE_DIR ?? 'uploads/category-images');
}

/** Segmen path yang aman: UUID dan id internal lolos apa adanya, sisanya dinetralkan. */
export function safeImageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

function fail(message: string): never {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  throw error;
}

/** Validasi isi file, bukan sekadar klaim `Content-Type` dari client. */
export function validateImageBytes(buffer: Buffer, mimetype: string): { extension: string } {
  if (!buffer || buffer.length === 0) fail('File gambar kosong.');
  if (buffer.length > MAX_IMAGE_BYTES) fail('Ukuran foto produk maksimum 5 MiB.');
  const normalized = (mimetype ?? '').toLowerCase();
  const extension = ALLOWED_IMAGE_MIME.get(normalized);
  if (!extension) fail('Tipe foto harus JPEG, PNG, atau WEBP.');
  const signatureValid =
    normalized === 'image/jpeg'
      ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : normalized === 'image/png'
        ? buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : buffer.length >= 12 &&
          buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!signatureValid) fail('Isi file tidak sesuai dengan tipe gambar yang dikirim.');
  return { extension };
}

/** Nama file acak per upload: tidak bisa ditebak, tidak bisa ditimpa dari luar. */
export function buildImageStorageKey(companyId: string, productId: string, extension: string): string {
  return [safeImageSegment(companyId), safeImageSegment(productId), `${randomUUID()}${extension}`].join('/');
}

/**
 * URL publik yang dimuat browser. Host diambil dari request yang masuk (bukan
 * config build-time), sehingga satu server cabang di LAN menjawab dengan alamat
 * LAN-nya sendiri dan hasil `http://...` lolos validator IsHttpImageUrl.
 */
export function buildPublicImageUrl(protocol: string, host: string, storageKey: string, prefix = '/media/product-images/'): string {
  const proto = protocol === 'https' ? 'https' : 'http';
  const cleanHost = (host ?? '').split(',')[0].trim();
  if (!cleanHost || /[\s<>"]/.test(cleanHost)) fail('Host request tidak valid untuk URL foto.');
  return `${proto}://${cleanHost}${prefix}${storageKey}`;
}
