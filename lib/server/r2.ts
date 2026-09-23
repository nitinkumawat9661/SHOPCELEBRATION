import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireEnv } from "../../config/env"
import { storageConfig, type CatalogImageMimeType, type PackingVideoMimeType } from "../../config/storage"
import { isPackingVideoMimeType } from "../domain/storage"
import { validation } from "../../config/validation"
import { isSafePublicOrderId } from "../validation/identifiers"

let s3: S3Client | null = null

function client() {
  if (s3) return s3
  const accountId = requireEnv("r2AccountId")
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("r2AccessKeyId"),
      secretAccessKey: requireEnv("r2SecretAccessKey")
    }
  })
  return s3
}

function orderVideoPrefix(orderId: string) {
  if (!isSafePublicOrderId(orderId)) throw new Error("INVALID_ORDER_ID")
  return `${storageConfig.packingVideoPrefix}/${orderId}/`
}

export async function createPackingVideoUploadUrl(orderId: string, contentType: PackingVideoMimeType) {
  const ext = storageConfig.packingVideoTypes[contentType]
  const key = `${orderVideoPrefix(orderId)}${crypto.randomUUID()}.${ext}`
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: requireEnv("r2Bucket"),
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: storageConfig.uploadUrlTtlSeconds }
  )
  return { key, url }
}

export async function createPackingVideoViewUrl(key: string) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }),
    { expiresIn: storageConfig.viewUrlTtlSeconds }
  )
}

export async function verifyPackingVideoObject(key: string) {
  const head = await client().send(new HeadObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }))
  const type = head.ContentType || ""
  const length = head.ContentLength || 0
  return isPackingVideoMimeType(type) && length > 0 && length <= validation.packingVideoMaxBytes
}

export function isPackingVideoKeyForOrder(key: string, orderId: string) {
  if (!isSafePublicOrderId(orderId)) return false
  return key.startsWith(orderVideoPrefix(orderId)) && /^[A-Za-z0-9._/-]+$/.test(key) && key.length <= storageConfig.keyMaxLength
}

export function isCatalogImageMimeType(value: string): value is CatalogImageMimeType {
  return Object.prototype.hasOwnProperty.call(storageConfig.catalogImageTypes, value)
}

export function isCatalogImageKey(key: string) {
  return key.startsWith(`${storageConfig.catalogImagePrefix}/`) && /^[A-Za-z0-9._/-]+$/.test(key) && key.length <= storageConfig.keyMaxLength
}

export async function createCatalogImageUploadUrl(contentType: CatalogImageMimeType) {
  const ext = storageConfig.catalogImageTypes[contentType]
  const key = `${storageConfig.catalogImagePrefix}/${crypto.randomUUID()}.${ext}`
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: requireEnv("r2Bucket"),
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: storageConfig.uploadUrlTtlSeconds }
  )
  return { key, url }
}

export async function verifyCatalogImageObject(key: string) {
  if (!isCatalogImageKey(key)) return false
  const head = await client().send(new HeadObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }))
  const type = head.ContentType || ""
  const length = head.ContentLength || 0
  return isCatalogImageMimeType(type) && length > 0 && length <= validation.catalogImageMaxBytes
}

export async function createCatalogImageViewUrl(key: string) {
  if (!isCatalogImageKey(key)) throw new Error("INVALID_CATALOG_IMAGE_KEY")
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }),
    { expiresIn: storageConfig.viewUrlTtlSeconds }
  )
}
