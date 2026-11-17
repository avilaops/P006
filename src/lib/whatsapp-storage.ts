import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "video/mp4": "mp4", "application/pdf": "pdf", "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function client() {
  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = process.env;
  if (![accountId, accessKeyId, secretAccessKey, bucket].every((value) => value?.trim())) {
    throw new Error("Armazenamento R2 incompleto: configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET.");
  }
  return {
    bucket: bucket!.trim(),
    s3: new S3Client({ region: "auto", endpoint: `https://${accountId!.trim()}.r2.cloudflarestorage.com`, credentials: { accessKeyId: accessKeyId!.trim(), secretAccessKey: secretAccessKey!.trim() } }),
  };
}

function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Identificador inválido para mídia.");
}

export async function putWhatsAppMedia(input: { tenantId: string; conversationId: string; bytes: Buffer; mimeType: string; fileName: string | null }) {
  uuid(input.tenantId);
  uuid(input.conversationId);
  if (!input.bytes.length || input.bytes.length > MAX_MEDIA_BYTES) throw new Error("Anexo acima do limite de 10 MiB.");
  const mimeType = input.mimeType.split(";")[0].trim().toLowerCase();
  if (!Object.hasOwn(TYPES, mimeType)) throw new Error("Tipo de anexo não permitido para armazenamento.");
  const hash = createHash("sha256").update(input.bytes).digest("hex");
  const key = `tenants/${input.tenantId}/conversations/${input.conversationId}/${randomUUID()}.${TYPES[mimeType]}`;
  const { bucket, s3 } = client();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: input.bytes, ContentType: mimeType, Metadata: { sha256: hash } }));
  return { key, sha256: hash, size: input.bytes.length, mimeType };
}

export async function getWhatsAppMedia(key: string) {
  if (!/^tenants\/[0-9a-f-]{36}\/conversations\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i.test(key)) {
    throw new Error("Chave inválida para mídia.");
  }
  const { bucket, s3 } = client();
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error("Anexo sem conteúdo.");
  return { body: object.Body, contentType: object.ContentType ?? "application/octet-stream", size: object.ContentLength ?? null };
}
