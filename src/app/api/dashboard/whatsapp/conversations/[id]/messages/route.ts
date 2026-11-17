import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";
import { empresaAtual } from "@/lib/prisma";
import { EvolutionError, evolutionRequest, instanceForTenant } from "@/lib/evolution-whatsapp";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 4000) return NextResponse.json({ error: "Escreva uma mensagem com até 4.000 caracteres." }, { status: 400 });
  try {
    const conversation = await prisma.whatsAppConversation.findUnique({ where: { id }, select: { id: true, phone: true, remoteJid: true } });
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    const tenantId = await empresaAtual();
    const instanceName = instanceForTenant(tenantId);
    const sent = await evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, { number: conversation.remoteJid, text });
    const externalId = (sent as { key?: { id?: unknown } }).key?.id;
    if (typeof externalId !== "string" || !externalId) throw new EvolutionError("A Evolution não confirmou o envio.");
    const message = await prisma.whatsAppMessage.create({ data: { conversationId: id, externalId, direction: "OUTBOUND", type: "text", body: text, status: "sent", sentAt: new Date(), metadata: { sentBy: "tms" } }, select: { id: true, direction: true, body: true, status: true, sentAt: true } });
    await prisma.whatsAppConversation.update({ where: { id }, data: { lastMessageAt: message.sentAt, lastMessageText: text, status: "WAITING" } });
    return NextResponse.json(message, { status: 201 });
  } catch (cause) {
    const status = cause instanceof EvolutionError ? cause.status : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao enviar." }, { status });
  }
}
