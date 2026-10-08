type RegistrationOptions = {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: { type: "public-key"; alg: number }[]
  timeout?: number
  attestation?: AttestationConveyancePreference
  authenticatorSelection?: AuthenticatorSelectionCriteria
  excludeCredentials?: { type: "public-key"; id: string; transports?: string[] }[]
}

type AuthenticationOptions = {
  challenge: string
  rpId: string
  timeout?: number
  userVerification?: UserVerificationRequirement
}

function fromBase64url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

function toBase64url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function assertWebAuthn() {
  if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("PASSKEY_NOT_SUPPORTED")
}

export async function createAdminPasskey(options: RegistrationOptions) {
  assertWebAuthn()
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromBase64url(options.challenge),
      user: { ...options.user, id: fromBase64url(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((item) => ({
        type: "public-key",
        id: fromBase64url(item.id),
        transports: item.transports as AuthenticatorTransport[] | undefined
      }))
    }
  })
  if (!(credential instanceof PublicKeyCredential)) throw new Error("PASSKEY_REGISTRATION_CANCELLED")
  const response = credential.response
  if (!(response instanceof AuthenticatorAttestationResponse)) throw new Error("INVALID_PASSKEY_RESPONSE")
  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      attestationObject: toBase64url(response.attestationObject),
      transports: typeof response.getTransports === "function" ? response.getTransports() : []
    }
  }
}

export async function authenticateAdminPasskey(options: AuthenticationOptions) {
  assertWebAuthn()
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromBase64url(options.challenge)
    }
  })
  if (!(credential instanceof PublicKeyCredential)) throw new Error("PASSKEY_LOGIN_CANCELLED")
  const response = credential.response
  if (!(response instanceof AuthenticatorAssertionResponse)) throw new Error("INVALID_PASSKEY_RESPONSE")
  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      authenticatorData: toBase64url(response.authenticatorData),
      signature: toBase64url(response.signature),
      userHandle: response.userHandle ? toBase64url(response.userHandle) : null
    }
  }
}
