import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from "node:crypto"
import { requireEnv, requireSecret } from "../../config/env"
import { signValue, verifySignedValue } from "./tokens"

export const ADMIN_PASSKEY_CHALLENGE_COOKIE = "celebration_admin_passkey_challenge"
const CHALLENGE_TTL_SECONDS = 300

type CborValue = number | string | Uint8Array | boolean | null | CborValue[] | Map<CborValue, CborValue>
type RegistrationInput = {
  id?: unknown
  rawId?: unknown
  type?: unknown
  response?: {
    clientDataJSON?: unknown
    attestationObject?: unknown
    transports?: unknown
  }
}
type AuthenticationInput = {
  id?: unknown
  rawId?: unknown
  type?: unknown
  response?: {
    clientDataJSON?: unknown
    authenticatorData?: unknown
    signature?: unknown
    userHandle?: unknown
  }
}

function b64url(value: Uint8Array | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function fromB64url(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 8192) throw new Error(code)
  try {
    const buffer = Buffer.from(value, "base64url")
    if (!buffer.length) throw new Error(code)
    return buffer
  } catch {
    throw new Error(code)
  }
}

function safeEqual(a: Uint8Array | Buffer, b: Uint8Array | Buffer) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function relyingParty() {
  const url = new URL(requireEnv("appBaseUrl"))
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("PASSKEY_HTTPS_REQUIRED")
  return { origin: url.origin, rpId: url.hostname, name: "Celebration Admin" }
}

function hash(value: Uint8Array | Buffer | string) {
  return createHash("sha256").update(value).digest()
}

function readLength(bytes: Uint8Array, offset: number, additional: number) {
  if (additional < 24) return { value: additional, offset }
  if (additional === 24) {
    if (offset + 1 > bytes.length) throw new Error("INVALID_CBOR")
    return { value: bytes[offset], offset: offset + 1 }
  }
  if (additional === 25) {
    if (offset + 2 > bytes.length) throw new Error("INVALID_CBOR")
    return { value: (bytes[offset] << 8) | bytes[offset + 1], offset: offset + 2 }
  }
  if (additional === 26) {
    if (offset + 4 > bytes.length) throw new Error("INVALID_CBOR")
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4)
    return { value: view.getUint32(0, false), offset: offset + 4 }
  }
  if (additional === 27) {
    if (offset + 8 > bytes.length) throw new Error("INVALID_CBOR")
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8)
    const value = view.getBigUint64(0, false)
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("INVALID_CBOR")
    return { value: Number(value), offset: offset + 8 }
  }
  throw new Error("INVALID_CBOR")
}

function decodeCbor(bytes: Uint8Array, start = 0): { value: CborValue; offset: number } {
  if (start >= bytes.length) throw new Error("INVALID_CBOR")
  const first = bytes[start]
  const major = first >> 5
  const additional = first & 31
  let offset = start + 1

  if (major === 7) {
    if (additional === 20) return { value: false, offset }
    if (additional === 21) return { value: true, offset }
    if (additional === 22) return { value: null, offset }
    throw new Error("INVALID_CBOR")
  }

  const length = readLength(bytes, offset, additional)
  offset = length.offset

  if (major === 0) return { value: length.value, offset }
  if (major === 1) return { value: -1 - length.value, offset }
  if (major === 2) {
    const end = offset + length.value
    if (end > bytes.length) throw new Error("INVALID_CBOR")
    return { value: bytes.slice(offset, end), offset: end }
  }
  if (major === 3) {
    const end = offset + length.value
    if (end > bytes.length) throw new Error("INVALID_CBOR")
    return { value: new TextDecoder().decode(bytes.slice(offset, end)), offset: end }
  }
  if (major === 4) {
    const values: CborValue[] = []
    for (let i = 0; i < length.value; i += 1) {
      const decoded = decodeCbor(bytes, offset)
      values.push(decoded.value)
      offset = decoded.offset
    }
    return { value: values, offset }
  }
  if (major === 5) {
    const map = new Map<CborValue, CborValue>()
    for (let i = 0; i < length.value; i += 1) {
      const key = decodeCbor(bytes, offset)
      offset = key.offset
      const value = decodeCbor(bytes, offset)
      offset = value.offset
      map.set(key.value, value.value)
    }
    return { value: map, offset }
  }
  if (major === 6) {
    return decodeCbor(bytes, offset)
  }
  throw new Error("INVALID_CBOR")
}

function clientData(encoded: unknown, expectedType: "webauthn.create" | "webauthn.get", expectedChallenge: string) {
  const bytes = fromB64url(encoded, "INVALID_PASSKEY_CLIENT_DATA")
  let parsed: { type?: unknown; challenge?: unknown; origin?: unknown; crossOrigin?: unknown }
  try {
    parsed = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new Error("INVALID_PASSKEY_CLIENT_DATA")
  }
  const rp = relyingParty()
  if (parsed.type !== expectedType) throw new Error("INVALID_PASSKEY_TYPE")
  if (parsed.challenge !== expectedChallenge) throw new Error("INVALID_PASSKEY_CHALLENGE")
  if (parsed.origin !== rp.origin) throw new Error("INVALID_PASSKEY_ORIGIN")
  if (parsed.crossOrigin === true) throw new Error("INVALID_PASSKEY_ORIGIN")
  return { bytes, rp }
}

function authenticatorBase(authData: Uint8Array) {
  if (authData.length < 37) throw new Error("INVALID_AUTHENTICATOR_DATA")
  const rpIdHash = authData.slice(0, 32)
  const flags = authData[32]
  const signCount = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false)
  const userPresent = Boolean(flags & 0x01)
  const userVerified = Boolean(flags & 0x04)
  const backupEligible = Boolean(flags & 0x08)
  const backupState = Boolean(flags & 0x10)
  if (!userPresent || !userVerified) throw new Error("PASSKEY_USER_VERIFICATION_REQUIRED")
  if (!backupEligible && backupState) throw new Error("INVALID_AUTHENTICATOR_FLAGS")
  return { rpIdHash, flags, signCount, backupEligible, backupState }
}

function assertRpHash(actual: Uint8Array, rpId: string) {
  if (!safeEqual(actual, hash(rpId))) throw new Error("INVALID_PASSKEY_RP")
}

function asMap(value: CborValue, code: string) {
  if (!(value instanceof Map)) throw new Error(code)
  return value
}

function asBytes(value: CborValue | undefined, code: string) {
  if (!(value instanceof Uint8Array)) throw new Error(code)
  return value
}

function cosePublicKey(value: CborValue) {
  const map = asMap(value, "INVALID_PASSKEY_PUBLIC_KEY")
  if (map.get(1) !== 2 || map.get(3) !== -7 || map.get(-1) !== 1) throw new Error("UNSUPPORTED_PASSKEY_ALGORITHM")
  const x = asBytes(map.get(-2), "INVALID_PASSKEY_PUBLIC_KEY")
  const y = asBytes(map.get(-3), "INVALID_PASSKEY_PUBLIC_KEY")
  if (x.length !== 32 || y.length !== 32) throw new Error("INVALID_PASSKEY_PUBLIC_KEY")
  return {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    ext: true,
    x: b64url(x),
    y: b64url(y)
  } satisfies JsonWebKey
}

export function createPasskeyChallenge(purpose: "register" | "authenticate") {
  const challenge = b64url(randomBytes(32))
  const payload = {
    challenge,
    purpose,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return {
    challenge,
    token: signValue(encoded, requireSecret("adminSessionSecret")),
    maxAge: CHALLENGE_TTL_SECONDS
  }
}

export function verifyPasskeyChallenge(token: string | undefined, purpose: "register" | "authenticate") {
  if (!token) throw new Error("PASSKEY_CHALLENGE_REQUIRED")
  const encoded = verifySignedValue(token, requireSecret("adminSessionSecret"))
  if (!encoded) throw new Error("INVALID_PASSKEY_CHALLENGE")
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { challenge?: unknown; purpose?: unknown; exp?: unknown }
    if (payload.purpose !== purpose || typeof payload.challenge !== "string" || typeof payload.exp !== "number") throw new Error("INVALID_PASSKEY_CHALLENGE")
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("PASSKEY_CHALLENGE_EXPIRED")
    return payload.challenge
  } catch (error) {
    if (error instanceof Error && error.message === "PASSKEY_CHALLENGE_EXPIRED") throw error
    throw new Error("INVALID_PASSKEY_CHALLENGE")
  }
}

export function registrationOptions(input: {
  challenge: string
  userHandle: string
  excludeCredentials: { id: string; transports: string[] }[]
}) {
  const rp = relyingParty()
  return {
    challenge: input.challenge,
    rp: { id: rp.rpId, name: rp.name },
    user: {
      id: input.userHandle,
      name: "celebration-admin",
      displayName: "Celebration Admin"
    },
    pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }],
    timeout: 120000,
    attestation: "none" as const,
    authenticatorSelection: {
      residentKey: "required" as const,
      requireResidentKey: true,
      userVerification: "required" as const
    },
    excludeCredentials: input.excludeCredentials.map((credential) => ({
      type: "public-key" as const,
      id: credential.id,
      transports: credential.transports
    }))
  }
}

export function authenticationOptions(challenge: string) {
  const rp = relyingParty()
  return {
    challenge,
    rpId: rp.rpId,
    timeout: 120000,
    userVerification: "required" as const
  }
}

export function verifyRegistration(input: RegistrationInput, expectedChallenge: string, expectedUserHandle: string) {
  if (!input || input.type !== "public-key") throw new Error("INVALID_PASSKEY_RESPONSE")
  const rawId = fromB64url(input.rawId, "INVALID_PASSKEY_ID")
  if (typeof input.id !== "string" || input.id !== b64url(rawId)) throw new Error("INVALID_PASSKEY_ID")
  const response = input.response
  if (!response || typeof response !== "object") throw new Error("INVALID_PASSKEY_RESPONSE")
  const client = clientData(response.clientDataJSON, "webauthn.create", expectedChallenge)
  const attestationBytes = fromB64url(response.attestationObject, "INVALID_ATTESTATION_OBJECT")
  const decoded = decodeCbor(attestationBytes)
  const attestation = asMap(decoded.value, "INVALID_ATTESTATION_OBJECT")
  if (attestation.get("fmt") !== "none") throw new Error("UNSUPPORTED_ATTESTATION_FORMAT")
  const attStmt = asMap(attestation.get("attStmt") as CborValue, "INVALID_ATTESTATION_OBJECT")
  if (attStmt.size !== 0) throw new Error("INVALID_ATTESTATION_OBJECT")
  const authData = asBytes(attestation.get("authData") as CborValue, "INVALID_AUTHENTICATOR_DATA")
  const base = authenticatorBase(authData)
  assertRpHash(base.rpIdHash, client.rp.rpId)
  if (!(base.flags & 0x40)) throw new Error("INVALID_AUTHENTICATOR_DATA")

  let offset = 37
  if (offset + 18 > authData.length) throw new Error("INVALID_AUTHENTICATOR_DATA")
  offset += 16
  const credentialIdLength = new DataView(authData.buffer, authData.byteOffset + offset, 2).getUint16(0, false)
  offset += 2
  const credentialId = authData.slice(offset, offset + credentialIdLength)
  offset += credentialIdLength
  if (!credentialIdLength || offset > authData.length || !safeEqual(credentialId, rawId)) throw new Error("INVALID_PASSKEY_ID")

  const publicKeyDecoded = decodeCbor(authData, offset)
  const publicKeyJwk = cosePublicKey(publicKeyDecoded.value)
  const transports = Array.isArray(response.transports)
    ? response.transports.filter((value): value is string => typeof value === "string" && ["ble", "hybrid", "internal", "nfc", "usb"].includes(value))
    : []

  return {
    credentialId: b64url(credentialId),
    userHandle: expectedUserHandle,
    publicKeyJwk,
    signCount: base.signCount,
    transports,
    backupEligible: base.backupEligible,
    backupState: base.backupState
  }
}

export function verifyAuthentication(input: AuthenticationInput, expectedChallenge: string, stored: {
  credentialId: string
  userHandle: string
  publicKeyJwk: Record<string, unknown>
  signCount: number
}) {
  if (!input || input.type !== "public-key") throw new Error("INVALID_PASSKEY_RESPONSE")
  const rawId = fromB64url(input.rawId, "INVALID_PASSKEY_ID")
  if (typeof input.id !== "string" || input.id !== b64url(rawId) || input.id !== stored.credentialId) throw new Error("INVALID_PASSKEY_ID")
  const response = input.response
  if (!response || typeof response !== "object") throw new Error("INVALID_PASSKEY_RESPONSE")
  const client = clientData(response.clientDataJSON, "webauthn.get", expectedChallenge)
  const authData = fromB64url(response.authenticatorData, "INVALID_AUTHENTICATOR_DATA")
  const signature = fromB64url(response.signature, "INVALID_PASSKEY_SIGNATURE")
  const base = authenticatorBase(authData)
  assertRpHash(base.rpIdHash, client.rp.rpId)

  if (response.userHandle != null) {
    const handle = fromB64url(response.userHandle, "INVALID_PASSKEY_USER")
    if (!safeEqual(handle, fromB64url(stored.userHandle, "INVALID_PASSKEY_USER"))) throw new Error("INVALID_PASSKEY_USER")
  }

  const signed = Buffer.concat([authData, hash(client.bytes)])
  let key
  try {
    key = createPublicKey({ key: stored.publicKeyJwk as JsonWebKey, format: "jwk" })
  } catch {
    throw new Error("INVALID_PASSKEY_PUBLIC_KEY")
  }
  if (!verify("sha256", signed, key, signature)) throw new Error("INVALID_PASSKEY_SIGNATURE")
  if (stored.signCount > 0 && base.signCount > 0 && base.signCount <= stored.signCount) throw new Error("PASSKEY_COUNTER_REPLAY")

  return {
    signCount: base.signCount,
    backupEligible: base.backupEligible,
    backupState: base.backupState
  }
}
