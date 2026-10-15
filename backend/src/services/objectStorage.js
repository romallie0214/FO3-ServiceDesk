const axios = require('axios');
const FormData = require('form-data');

const FILE_SIGNATURES = {
  'image/jpeg': (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF])),
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
  'image/gif': (buffer) => buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a',
  'image/webp': (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'video/mp4': (buffer) => buffer.subarray(4, 8).toString('ascii') === 'ftyp',
  'video/quicktime': (buffer) => buffer.subarray(4, 8).toString('ascii') === 'ftyp' && buffer.subarray(8, 12).toString('ascii') === 'qt  ',
  'video/webm': (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3])),
  'application/msword': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buffer) => (
    buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]))
    && buffer.includes(Buffer.from('[Content_Types].xml'))
    && buffer.includes(Buffer.from('word/document.xml'))
    && !buffer.includes(Buffer.from('vbaProject.bin'))
  ),
};

function assertValidTicketAttachment(file) {
  const buffer = file?.buffer;
  const mimeType = file?.mimetype;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('An attachment is empty or invalid.');
    error.code = 'INVALID_ATTACHMENT_CONTENT';
    throw error;
  }

  if (mimeType === 'application/pdf') {
    // A PDF header may be preceded by up to 1,024 bytes of binary comment data.
    if (buffer.subarray(0, 1024).indexOf(Buffer.from('%PDF-')) === -1) {
      const error = new Error(`"${file.originalname}" is not a valid PDF file.`);
      error.code = 'INVALID_ATTACHMENT_CONTENT';
      throw error;
    }
    return;
  }

  if (mimeType === 'text/plain') {
    if (buffer.subarray(0, 8192).includes(0)) {
      const error = new Error(`"${file.originalname}" is not a plain-text file.`);
      error.code = 'INVALID_ATTACHMENT_CONTENT';
      throw error;
    }
    return;
  }

  const matchesSignature = FILE_SIGNATURES[mimeType];
  if (!matchesSignature || !matchesSignature(buffer)) {
    const error = new Error(`"${file.originalname}" does not match its declared file type.`);
    error.code = 'INVALID_ATTACHMENT_CONTENT';
    throw error;
  }
}

async function uploadTicketAttachment(file, ticketNumber) {
  const uploadUrl = process.env.OBJECT_STORAGE_UPLOAD_URL;
  const apiKey = process.env.OBJECT_STORAGE_API_KEY;
  const bucket = process.env.OBJECT_STORAGE_BUCKET || 'servicedesk-staging';
  if (!uploadUrl || !apiKey) {
    const error = new Error('Object storage is not configured. Add OBJECT_STORAGE_API_KEY to backend/.env and restart the backend.');
    error.code = 'OBJECT_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  const originalName = String(file.originalname || 'attachment').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_');
  const storageFilename = `${ticketNumber}_${originalName}`;
  const form = new FormData();
  form.append('file', file.buffer, { filename: storageFilename, contentType: file.mimetype });
  form.append('bucket', bucket);
  // The storage API adds the current YYYY/MM path itself. Sending just the
  // base folder avoids duplicated paths such as tickets/2026/10/2026/10/.
  form.append('folder', 'tickets');
  form.append('return_url', 'true');
  form.append('url_expires_in', String(process.env.OBJECT_STORAGE_URL_EXPIRES_IN || 300));
  const response = await axios.post(uploadUrl, form, {
    headers: { ...form.getHeaders(), 'X-API-Key': apiKey }, maxBodyLength: Infinity, timeout: 60000,
  });
  const uploaded = response.data?.data || response.data;
  if (!uploaded?.key) throw new Error('Object storage did not return an object key.');
  return { ...uploaded, original_filename: storageFilename };
}

function isObjectStorageConfigured() {
  return Boolean(process.env.OBJECT_STORAGE_UPLOAD_URL && process.env.OBJECT_STORAGE_API_KEY);
}

async function getPresignedDownloadUrl(bucket, key) {
  const endpoint = process.env.OBJECT_STORAGE_PRESIGNED_URL_ENDPOINT;
  const apiKey = process.env.OBJECT_STORAGE_API_KEY;
  if (!endpoint || !apiKey) throw new Error('Object-storage download links are not configured.');
  const response = await axios.get(endpoint, {
    params: { bucket, key, expires_in: Number(process.env.OBJECT_STORAGE_URL_EXPIRES_IN || 300) },
    headers: { 'X-API-Key': apiKey }, timeout: 30000,
  });
  const result = response.data?.data || response.data;
  const url = result?.download_url || result?.url || result?.presigned_url;
  if (!url) throw new Error('Object storage did not return a presigned download URL.');
  return url;
}

module.exports = { uploadTicketAttachment, isObjectStorageConfigured, getPresignedDownloadUrl, assertValidTicketAttachment };
