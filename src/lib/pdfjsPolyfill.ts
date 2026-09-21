/**
 * Compatibility polyfills for very new TypedArray base-16 / base-64 APIs that
 * pdfjs-dist 6.x relies on but many still-common browsers lack (e.g. Chromium 130).
 *
 * Affected APIs:
 *   - TypedArray base-16/base-64 (TC39 "Uint8Array to/from hex & base64", Chrome 140+):
 *       Uint8Array.prototype.toHex() / Uint8Array.fromHex()
 *       Uint8Array.prototype.toBase64() / Uint8Array.fromBase64()
 *   - Map upsert (TC39 upsert proposal, Chrome 140+):
 *       Map.prototype.getOrInsert() / Map.prototype.getOrInsertComputed()
 *
 * Without these, the pdf.js worker throws "TypeError: n.toHex is not a function"
 * while computing document fingerprints, so getDocument() never resolves and the
 * editor shows an endless "Preparing your document..." skeleton (blank viewer);
 * page.render() similarly crashes on a missing Map.prototype.getOrInsertComputed.
 *
 * This module must be imported BEFORE 'pdfjs-dist' anywhere pdf.js is used.
 */

const HEX_CHARS = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
);

function uint8ArrayToHex(this: Uint8Array): string {
  let out = '';
  const chunk = 0x1000;
  for (let i = 0; i < this.length; i += chunk) {
    const sub = this.subarray(i, i + chunk);
    for (let j = 0; j < sub.length; j++) out += HEX_CHARS[sub[j]];
  }
  return out;
}

function uint8ArrayFromHex(input: string): Uint8Array {
  const cleaned = String(input).trim();
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new SyntaxError('Uint8Array.fromHex: invalid hex string');
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  }
  return out;
}

function uint8ArrayToBase64(this: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < this.length; i += chunk) {
    const sub = this.subarray(i, i + chunk);
    // String.fromCharCode.apply on chunks avoids stack overflow for big buffers
    const binary = String.fromCharCode.apply(
      null,
      Array.from(sub) as unknown as number[]
    );
    out += btoa(binary);
  }
  return out;
}

function uint8ArrayFromBase64(input: string): Uint8Array {
  const cleaned = String(input).replace(/[\s]+/g, '');
  const binary = atob(cleaned);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const proto = Uint8Array.prototype as unknown as Record<string, unknown>;
const ctor = Uint8Array as unknown as Record<string, unknown>;

if (typeof proto.toHex !== 'function') {
  Object.defineProperty(proto, 'toHex', {
    value: uint8ArrayToHex,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
if (typeof ctor.fromHex !== 'function') {
  Object.defineProperty(ctor, 'fromHex', {
    value: uint8ArrayFromHex,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
if (typeof proto.toBase64 !== 'function') {
  Object.defineProperty(proto, 'toBase64', {
    value: uint8ArrayToBase64,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
if (typeof ctor.fromBase64 !== 'function') {
  Object.defineProperty(ctor, 'fromBase64', {
    value: uint8ArrayFromBase64,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

// --- Map.prototype upsert methods (used by pdf.js caches) -------------------
const mapProto = Map.prototype as unknown as Record<string, unknown>;

function normalizeMapKey(key: unknown): unknown {
  return key === 0 ? +key : key; // normalize -0 to +0
}

function mapGetOrInsert(this: Map<unknown, unknown>, key: unknown, value: unknown): unknown {
  const k = normalizeMapKey(key);
  if (this.has(k)) return this.get(k);
  this.set(k, value);
  return value;
}

function mapGetOrInsertComputed(
  this: Map<unknown, unknown>,
  key: unknown,
  callbackfn: (key: unknown) => unknown
): unknown {
  const k = normalizeMapKey(key);
  if (this.has(k)) return this.get(k);
  const value = callbackfn(k);
  this.set(k, value);
  return value;
}

if (typeof mapProto.getOrInsert !== 'function') {
  Object.defineProperty(mapProto, 'getOrInsert', {
    value: mapGetOrInsert,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
if (typeof mapProto.getOrInsertComputed !== 'function') {
  Object.defineProperty(mapProto, 'getOrInsertComputed', {
    value: mapGetOrInsertComputed,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

export {};
