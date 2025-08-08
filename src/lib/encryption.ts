import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// 12-byte IV is recommended for GCM
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKeyBuffer(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
  }
  return Buffer.from(key, 'utf8');
}

export function encrypt(text: string): string {
  try {
    const keyBuf = getEncryptionKeyBuffer();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv);

    const encryptedBuffers: Buffer[] = [];
    encryptedBuffers.push(cipher.update(text, 'utf8'));
    encryptedBuffers.push(cipher.final());

    const encrypted = Buffer.concat(encryptedBuffers);
    const tag = cipher.getAuthTag();

    // Combine IV, tag, and encrypted data (hex-encoded segments)
    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(encryptedData: string): string {
  try {
    const keyBuf = getEncryptionKeyBuffer();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
    decipher.setAuthTag(tag);

    const decryptedBuffers: Buffer[] = [];
    decryptedBuffers.push(decipher.update(encrypted));
    decryptedBuffers.push(decipher.final());

    return Buffer.concat(decryptedBuffers).toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Helper function to safely encrypt API keys
export function encryptApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API key cannot be empty');
  }
  return encrypt(apiKey.trim());
}

// Helper function to safely decrypt API keys
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey || encryptedApiKey.trim() === '') {
    throw new Error('Encrypted API key cannot be empty');
  }
  return decrypt(encryptedApiKey.trim());
}