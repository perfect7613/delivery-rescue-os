import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const encode = (value: Buffer): string => value.toString("base64url")

export const encryptSecret = (plain: string, keyBase64: string): string => {
  const key = Buffer.from(keyBase64, "base64")
  if (key.length !== 32) throw new Error("CREDENTIALS_KEY must be 32 bytes of base64")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`
}

export const decryptSecret = (payload: string, keyBase64: string): string => {
  const key = Buffer.from(keyBase64, "base64")
  const [iv, tag, ciphertext] = payload.split(".")
  if (!iv || !tag || !ciphertext) throw new Error("ciphertext is malformed")
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
}
