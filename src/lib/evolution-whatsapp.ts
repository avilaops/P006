import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export class EvolutionError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = "EvolutionError";
  }
}

function configuration() {
  const rawUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!rawUrl || !apiKey) throw new EvolutionError("Evolution API não configurada neste servidor.", 503);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EvolutionError("Endereço da Evolution API inválido.", 503);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new EvolutionError("Endereço da Evolution API inválido.", 503);
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), apiKey };
}

export function instanceForTenant(tenantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new EvolutionError("Empresa inválida.", 400);
  return `tms_${tenantId.replaceAll("-", "")}`;
}

export function createWebhookToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWebhookToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function matchesWebhookToken(token: string, expectedHash: string) {
  if (!/^[a-zA-Z0-9_-]{40,60}$/.test(token)) return false;
  const received = Buffer.from(hashWebhookToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function publicWebhookUrl(tenantId: string, token: string) {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new EvolutionError("NEXTAUTH_URL não está configurada.", 503);
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new EvolutionError("NEXTAUTH_URL inválida.", 503);
  }
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new EvolutionError("O webhook precisa usar HTTPS em produção.", 503);
  }
  return new URL(`/api/integracoes/whatsapp/evolution/${tenantId}/${token}`, origin).toString();
}

export async function evolutionRequest<T extends Json | Json[] = Json>(path: string, body?: unknown): Promise<T> {
  const { baseUrl, apiKey } = configuration();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { apikey: apiKey, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw new EvolutionError(`Evolution API respondeu HTTP ${response.status}.`, response.status === 404 ? 404 : 502);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new EvolutionError("Resposta inválida da Evolution API.");
    return data as T;
  } catch (error) {
    if (error instanceof EvolutionError) throw error;
    throw new EvolutionError("Não foi possível comunicar com a Evolution API.");
  }
}

export function extractMessageText(message: Json): string | null {
  const content = isRecord(message.message) ? message.message : {};
  const extended = isRecord(content.extendedTextMessage) ? content.extendedTextMessage : {};
  const image = isRecord(content.imageMessage) ? content.imageMessage : {};
  const video = isRecord(content.videoMessage) ? content.videoMessage : {};
  const document = isRecord(content.documentMessage) ? content.documentMessage : {};
  const buttons = isRecord(content.buttonsResponseMessage) ? content.buttonsResponseMessage : {};
  const list = isRecord(content.listResponseMessage) ? content.listResponseMessage : {};
  const text = content.conversation ?? extended.text ?? image.caption ?? video.caption ?? document.caption ?? buttons.selectedDisplayText ?? list.title;
  return typeof text === "string" ? text.slice(0, 20_000) : null;
}

export function messageType(message: Json): string {
  const content = isRecord(message.message) ? message.message : {};
  const key = Object.keys(content).find((item) => item.endsWith("Message"));
  return key ? key.replace(/Message$/, "").toLowerCase() : "text";
}

export function mediaInfo(message: Json) {
  const content = isRecord(message.message) ? message.message : {};
  const key = Object.keys(content).find((item) => item.endsWith("Message") && isRecord(content[item]) && content[item].mimetype);
  if (!key) return null;
  const media = content[key] as Json;
  const mimeType = typeof media.mimetype === "string" ? media.mimetype.split(";")[0].toLowerCase() : "application/octet-stream";
  const fileName = typeof media.fileName === "string" ? media.fileName.slice(0, 255) : null;
  return { mimeType, fileName };
}

export async function downloadEvolutionMedia(instanceName: string, message: Json, maxBytes: number) {
  const encoded = await evolutionRequest<Json>(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, {
    message: { key: message.key }, convertToMp4: false,
  });
  const base64 = typeof encoded.base64 === "string" ? encoded.base64.replace(/^data:[^;]+;base64,/, "") : "";
  if (!base64 || base64.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^[a-zA-Z0-9+/=\r\n]+$/.test(base64)) {
    throw new EvolutionError("Anexo indisponível ou acima do limite.", 413);
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new EvolutionError("Anexo acima do limite permitido.", 413);
  return bytes;
}
