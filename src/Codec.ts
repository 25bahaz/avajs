import bs58 from "bs58";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EncodingType = "hex" | "utf8" | "base64" | "base58" | "cb58";

// ─── Low-level pure helpers (sync, no crypto) ─────────────────────────────────

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** Hex string → Uint8Array.  Throws on bad input. */
function hexToBytes(hex: string): Uint8Array {
  if (hex === "") return new Uint8Array(0);
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: odd length (${hex.length} chars)`);
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid hex string: contains non-hex characters`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i >> 1] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

/** Uint8Array → lowercase hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Base64 string → Uint8Array.  Works in browser and Node ≥ 16. */
function base64ToBytes(b64: string): Uint8Array {
  // atob is available globally in browser and Node 16+
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new Error(`Invalid base64 string`);
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Uint8Array → base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Constant-time byte-array equality. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

// ─── Async crypto helper ───────────────────────────────────────────────────────

/**
 * SHA-256 via Web Crypto API.
 * Available in: all modern browsers, Node.js ≥ 19 (global), Node 16-18 via
 * `--experimental-global-webcrypto`.  Works in Deno and Bun out of the box.
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const subtle =
    typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle
      ? globalThis.crypto.subtle
      : // Node 18 fallback — import webcrypto lazily
        await (async () => {
          const { webcrypto } = await import("node:crypto");
          return webcrypto.subtle;
        })();

  const hash = await subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

// ─── CB58 encode / decode ─────────────────────────────────────────────────────

/**
 * CB58 encode.
 *
 * Algorithm (Avalanche spec):
 *   checksum = SHA256(data)[-4:]   ← last 4 bytes of a SINGLE SHA256
 *   result   = Base58( data ‖ checksum )
 */
async function cb58Encode(bytes: Uint8Array): Promise<string> {
  const hash = await sha256(bytes);
  const checksum = hash.slice(-4); // last 4 bytes — NOT slice(0,4)!

  const payload = new Uint8Array(bytes.length + 4);
  payload.set(bytes);
  payload.set(checksum, bytes.length);

  return bs58.encode(payload);
}

/**
 * CB58 decode.
 *
 * Throws if the string is invalid Base58 or the checksum does not match.
 */
async function cb58Decode(str: string): Promise<Uint8Array> {
  let payload: Uint8Array;
  try {
    payload = bs58.decode(str);
  } catch {
    throw new Error(`CB58 decode failed: not a valid Base58 string`);
  }

  if (payload.length < 4) {
    throw new Error(
      `CB58 decode failed: payload too short (${payload.length} bytes, need at least 4)`
    );
  }

  const data = payload.slice(0, -4);
  const embeddedChecksum = payload.slice(-4);

  const hash = await sha256(data);
  const expectedChecksum = hash.slice(-4);

  if (!bytesEqual(embeddedChecksum, expectedChecksum)) {
    throw new Error(
      `CB58 decode failed: invalid checksum ` +
        `(got ${bytesToHex(embeddedChecksum)}, expected ${bytesToHex(expectedChecksum)})`
    );
  }

  return data;
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

/**
 * Decode any supported encoding into raw bytes.
 * When `data` is already a Uint8Array the `type` parameter is ignored and the
 * bytes are returned as-is (useful for piping raw bytes through the encoder).
 */
async function toBytes(
  data: string | Uint8Array,
  type: EncodingType
): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;

  switch (type) {
    case "hex":
      return hexToBytes(data);
    case "utf8":
      return TEXT_ENCODER.encode(data);
    case "base64":
      return base64ToBytes(data);
    case "base58":
      try {
        return bs58.decode(data);
      } catch {
        throw new Error(`Invalid Base58 string`);
      }
    case "cb58":
      return cb58Decode(data);
    default: {
      // TypeScript exhaustiveness guard
      const _never: never = type;
      throw new Error(`Unsupported encoding: ${_never}`);
    }
  }
}

/**
 * Encode raw bytes into any supported encoding string.
 */
async function fromBytes(
  bytes: Uint8Array,
  type: EncodingType
): Promise<string> {
  switch (type) {
    case "hex":
      return bytesToHex(bytes);
    case "utf8":
      return TEXT_DECODER.decode(bytes);
    case "base64":
      return bytesToBase64(bytes);
    case "base58":
      return bs58.encode(bytes);
    case "cb58":
      return cb58Encode(bytes);
    default: {
      const _never: never = type;
      throw new Error(`Unsupported encoding: ${_never}`);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fluent builder returned by `Codec.from(...)`.
 *
 * @example
 * const hex = await Codec.from("utf8").to("hex").encode("hello");
 */
export class CodecBuilder {
  private readonly fromType: EncodingType;
  private toType: EncodingType | undefined;

  constructor(from: EncodingType) {
    this.fromType = from;
  }

  to(to: EncodingType): this {
    this.toType = to;
    return this;
  }

  /**
   * Convert `data` (in `from` encoding) → string in `to` encoding.
   */
  encode(data: string | Uint8Array): Promise<string> {
    if (this.toType === undefined) {
      throw new Error(
        "Target encoding not specified — call .to(<encoding>) before .encode()"
      );
    }
    return Codec.encode(data, this.fromType, this.toType);
  }

  /**
   * Decode `data` (in `from` encoding) → raw Uint8Array bytes.
   */
  decode(data: string): Promise<Uint8Array> {
    return Codec.decode(data, this.fromType);
  }
}

/**
 * Main Codec class.
 *
 * @example
 * // Static API
 * const hex  = await Codec.encode("hello", "utf8", "hex");       // "68656c6c6f"
 * const back = await Codec.encode(hex, "hex", "utf8");            // "hello"
 * const raw  = await Codec.decode("68656c6c6f", "hex");           // Uint8Array [104, 101, ...]
 *
 * // Fluent API
 * const b64  = await Codec.from("utf8").to("base64").encode("hello"); // "aGVsbG8="
 */
export class Codec {
  /**
   * Convert `data` from `from` encoding to `to` encoding.
   * Always returns a string.
   *
   * When `data` is a `Uint8Array` the `from` parameter is ignored — the bytes
   * are used directly.
   */
  static async encode(
    data: string | Uint8Array,
    from: EncodingType,
    to: EncodingType
  ): Promise<string> {
    const bytes = await toBytes(data, from);
    return fromBytes(bytes, to);
  }

  /**
   * Decode `data` from `from` encoding into raw bytes (Uint8Array).
   */
  static async decode(
    data: string | Uint8Array,
    from: EncodingType
  ): Promise<Uint8Array> {
    return toBytes(data, from);
  }

  /**
   * Start building a conversion with a fluent API.
   *
   * @example
   * await Codec.from("hex").to("cb58").encode("deadbeef");
   */
  static from(from: EncodingType): CodecBuilder {
    return new CodecBuilder(from);
  }
}
