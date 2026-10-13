import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createReadStream } from "node:fs"
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

export async function uploadPackingVideoFile(
  orderId: string,
  contentType: PackingVideoMimeType,
  filePath: string,
  contentLength: number
) {
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > validation.packingVideoMaxBytes) {
    throw new Error("INVALID_PACKING_VIDEO_SIZE")
  }
  const ext = storageConfig.packingVideoTypes[contentType]
  const key = `${orderVideoPrefix(orderId)}${crypto.randomUUID()}.${ext}`
  await client().send(new PutObjectCommand({
    Bucket: requireEnv("r2Bucket"),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    Body: createReadStream(filePath)
  }))
  return { key }
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

export async function uploadCatalogImageFile(
  contentType: CatalogImageMimeType,
  filePath: string,
  contentLength: number
) {
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > validation.catalogImageMaxBytes) {
    throw new Error("INVALID_CATALOG_IMAGE_SIZE")
  }
  const ext = storageConfig.catalogImageTypes[contentType]
  const key = `${storageConfig.catalogImagePrefix}/${crypto.randomUUID()}.${ext}`
  await client().send(new PutObjectCommand({
    Bucket: requireEnv("r2Bucket"),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    Body: createReadStream(filePath)
  }))
  return { key }
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

/** Customer review photos are private until their genuine-purchase review is approved. */
export function isReviewPhotoKey(key: string) {
  return /^reviews\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(key)
}

export async function uploadReviewPhoto(key: string, content: Buffer) {
  if (!isReviewPhotoKey(key) || content.length < 1 || content.length > 3 * 1024 * 1024) throw new Error("INVALID_REVIEW_PHOTO")
  await client().send(new PutObjectCommand({
    Bucket: requireEnv("r2Bucket"), Key: key, Body: content,
    ContentType: "image/webp", ContentLength: content.length, CacheControl: "private, no-store"
  }))
}
export async function deleteReviewPhoto(key: string) {
  if (!isReviewPhotoKey(key)) return
  await client().send(new DeleteObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }))
}
export async function readReviewPhoto(key: string) {
  if (!isReviewPhotoKey(key)) throw new Error("INVALID_REVIEW_PHOTO")
  const file = await client().send(new GetObjectCommand({ Bucket: requireEnv("r2Bucket"), Key: key }))
  if (file.ContentType !== "image/webp" || !file.Body) throw new Error("REVIEW_PHOTO_UNAVAILABLE")
  return Buffer.from(await file.Body.transformToByteArray())
}

// Self-Build PERSONAL photos are PRIVATE, never part of catalog/media/CDN.
// Always strip metadata upstream (sharp) and never expose object keys in URLs.
export function isSelfBuildPrivatePhotoKey(key:string){
  return /^self-build\/private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(key)
}
export async function uploadSelfBuildPrivatePhoto(key:string,body:Buffer){
  if(!isSelfBuildPrivatePhotoKey(key)||body.length<1||body.length>3*1024*1024)
    throw new Error("INVALID_SELF_BUILD_PHOTO")
  await client().send(new PutObjectCommand({
    Bucket:requireEnv("r2Bucket"),Key:key,Body:body,ContentLength:body.length,
    ContentType:"image/webp",CacheControl:"private, no-store"
  }))
}
export async function readSelfBuildPrivatePhoto(key:string){
  if(!isSelfBuildPrivatePhotoKey(key))throw new Error("INVALID_SELF_BUILD_PHOTO")
  const result=await client().send(new GetObjectCommand({
    Bucket:requireEnv("r2Bucket"),Key:key
  }))
  if(result.ContentType!=="image/webp"||!result.Body)throw new Error("SELF_BUILD_PHOTO_MISSING")
  const content=Buffer.from(await result.Body.transformToByteArray())
  if(content.length<1||content.length>3*1024*1024)throw new Error("INVALID_SELF_BUILD_PHOTO")
  return content
}
export async function deleteSelfBuildPrivatePhoto(key:string){
  if(!isSelfBuildPrivatePhotoKey(key))throw new Error("INVALID_SELF_BUILD_PHOTO")
  await client().send(new DeleteObjectCommand({
    Bucket:requireEnv("r2Bucket"),Key:key
  }))
}
