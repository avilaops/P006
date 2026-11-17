import { paraEmpresa } from "@/lib/prisma";
import { downloadEvolutionMedia, extractMessageText, mediaInfo, messageType } from "@/lib/evolution-whatsapp";
import { putWhatsAppMedia } from "@/lib/whatsapp-storage";

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
type MessageRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is MessageRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Persiste mensagens recebidas por webhook ou histórico; repetição é idempotente por ID externo. */
export async function importarMensagensWhatsApp(tenantId: string, instanceName: string, items: unknown[], options: { historical?: boolean } = {}) {
  let imported = 0;
  const pendingMedia: Array<{ messageId: string; conversationId: string; item: MessageRecord; media: NonNullable<ReturnType<typeof mediaInfo>> }> = [];
  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as MessageRecord;
    const key = isRecord(item.key) ? item.key : {};
    const jid = typeof key?.remoteJid === "string" ? key.remoteJid : "";
    const externalId = typeof key?.id === "string" ? key.id : "";
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast" || !externalId) continue;
    if (await paraEmpresa(tenantId).db.whatsAppMessage.findFirst({ where: { externalId }, select: { id: true } })) continue;
    const phone = jid.split("@")[0].replace(/\D/g, "").slice(0, 30);
    if (!phone) continue;
    const text = extractMessageText(item);
    const media = mediaInfo(item);
    const timestamp = Number(item.messageTimestamp);
    const sentAt = Number.isFinite(timestamp) ? new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000) : new Date();
    const direction = key.fromMe === true ? "OUTBOUND" : "INBOUND";
    let messageId: string;
    let conversationId: string;
    try {
      const result = await paraEmpresa(tenantId).transacao(async (tx) => {
        const conversation = await tx.whatsAppConversation.upsert({
          where: { tenantId_remoteJid: { tenantId, remoteJid: jid } },
          create: { remoteJid: jid, phone, contactName: typeof item.pushName === "string" ? item.pushName.slice(0, 180) : null, lastMessageAt: sentAt, lastMessageText: text, unreadCount: direction === "INBOUND" && !options.historical ? 1 : 0 },
          update: { contactName: typeof item.pushName === "string" ? item.pushName.slice(0, 180) : undefined, phone, unreadCount: direction === "INBOUND" && !options.historical ? { increment: 1 } : undefined, status: direction === "INBOUND" && !options.historical ? "OPEN" : undefined },
          select: { id: true },
        });
        const created = await tx.whatsAppMessage.create({ data: { conversationId: conversation.id, externalId, direction, type: messageType(item), body: text, status: direction === "INBOUND" ? "received" : "sent", sentAt, mediaMimeType: media?.mimeType, mediaFileName: media?.fileName, metadata: { mediaPending: Boolean(media), source: options.historical ? "evolution-history" : "evolution" } }, select: { id: true } });
        await tx.whatsAppConversation.updateMany({ where: { id: conversation.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: sentAt } }] }, data: { lastMessageAt: sentAt, lastMessageText: text } });
        return { messageId: created.id, conversationId: conversation.id };
      });
      messageId = result.messageId;
      conversationId = result.conversationId;
      imported += 1;
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
    if (media) pendingMedia.push({ messageId, conversationId, item, media });
  }
  for (let index = 0; index < pendingMedia.length; index += 4) {
    await Promise.all(pendingMedia.slice(index, index + 4).map(async ({ messageId, conversationId, item, media }) => {
      try {
        const bytes = await downloadEvolutionMedia(instanceName, item, MAX_MEDIA_BYTES);
        const stored = await putWhatsAppMedia({ tenantId, conversationId, bytes, mimeType: media.mimeType, fileName: media.fileName });
        await paraEmpresa(tenantId).db.whatsAppMessage.update({ where: { id: messageId }, data: { mediaProvider: "r2", mediaKey: stored.key, mediaMimeType: stored.mimeType, mediaSize: stored.size, mediaSha256: stored.sha256, metadata: { mediaPending: false, source: options.historical ? "evolution-history" : "evolution" } } });
      } catch {
        await paraEmpresa(tenantId).db.whatsAppMessage.update({ where: { id: messageId }, data: { metadata: { mediaPending: false, mediaUnavailable: true, source: options.historical ? "evolution-history" : "evolution" } } });
      }
    }));
  }
  return imported;
}
