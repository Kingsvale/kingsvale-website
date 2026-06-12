import type { SiteContent } from "./contentTypes";

const authSalt = "zweQygjqyG4kOe3BYP5J9A==";
const authHash = "lR3HrY2knKZGbn4/WcZSH59P8pEJG43zabPbrIxfCoc=";
const iterations = 250_000;
const sessionKey = "kingsvale-studio-session-v1";
const encryptedSnapshotKey = "kingsvale-editor-encrypted-snapshot-v1";

type StudioSession = {
  expiresAt: number;
  token: string;
};

type EncryptedSnapshot = {
  algorithm: "AES-GCM";
  createdAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export async function verifyStudioPassphrase(passphrase: string) {
  if (!passphrase || !supportsWebCrypto()) {
    return false;
  }

  const derived = await deriveBits(passphrase, authSalt, iterations);
  return timingSafeEqual(derived, base64ToBytes(authHash));
}

export function createStudioSession() {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(24)));
  const session: StudioSession = {
    token,
    expiresAt: Date.now() + 1000 * 60 * 45
  };
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

export function hasStudioSession() {
  try {
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) {
      return false;
    }

    const session = JSON.parse(raw) as StudioSession;
    if (session.expiresAt <= Date.now()) {
      clearStudioSession();
      return false;
    }

    return Boolean(session.token);
  } catch {
    clearStudioSession();
    return false;
  }
}

export function clearStudioSession() {
  sessionStorage.removeItem(sessionKey);
}

export async function saveEncryptedEditorSnapshot(content: SiteContent, passphrase: string) {
  if (!passphrase || !supportsWebCrypto()) {
    return;
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, bytesToBase64(salt));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const snapshot: EncryptedSnapshot = {
    algorithm: "AES-GCM",
    createdAt: new Date().toISOString(),
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };

  localStorage.setItem(encryptedSnapshotKey, JSON.stringify(snapshot));
}

export function getEncryptedSnapshotSummary() {
  try {
    const raw = localStorage.getItem(encryptedSnapshotKey);
    if (!raw) {
      return "No encrypted editor snapshot yet.";
    }

    const snapshot = JSON.parse(raw) as EncryptedSnapshot;
    return `Encrypted ${new Date(snapshot.createdAt).toLocaleString()}`;
  } catch {
    return "Encrypted snapshot metadata is unreadable.";
  }
}

async function deriveBits(passphrase: string, saltBase64: string, iterationCount: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(saltBase64),
      iterations: iterationCount
    },
    key,
    256
  );

  return new Uint8Array(bits);
}

async function deriveAesKey(passphrase: string, saltBase64: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(saltBase64),
      iterations
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }

  return difference === 0;
}

function supportsWebCrypto() {
  return Boolean(globalThis.crypto?.subtle && globalThis.crypto.getRandomValues);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}
