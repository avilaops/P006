import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import prisma from "@/lib/prisma";
import { empresaAtual } from "@/lib/prisma";
import { createWebhookToken, evolutionRequest, hashWebhookToken, instanceForTenant, publicWebhookUrl, EvolutionError } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  try {
    const tenantId = await empresaAtual();
    const connection = await prisma.whatsAppConnection.findUnique({ where: { tenantId }, select: { status: true, phone: true, connectedAt: true, updatedAt: true, historyPage: true, historyImported: true, historyComplete: true } });
    if (!connection) return NextResponse.json({ configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY), canManage: user.role === "ADMIN", status: "DISCONNECTED", phone: null, historyPage: 0, historyImported: 0, historyComplete: false });
    const instanceName = instanceForTenant(tenantId);
    const state = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`).catch(() => null);
    const current = (state as { instance?: { state?: string } } | null)?.instance?.state;
    const status = current === "open" ? "CONNECTED" : current === "connecting" ? "CONNECTING" : "DISCONNECTED";
    if (status !== connection.status) await prisma.whatsAppConnection.update({ where: { tenantId }, data: { status } });
    return NextResponse.json({ configured: true, canManage: user.role === "ADMIN", status, phone: connection.phone, connectedAt: connection.connectedAt, updatedAt: connection.updatedAt, historyPage: connection.historyPage, historyImported: connection.historyImported, historyComplete: connection.historyComplete });
  } catch (cause) {
    const status = cause instanceof EvolutionError ? cause.status : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao consultar WhatsApp." }, { status });
  }
}

export async function POST() {
  const { error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  try {
    const tenantId = await empresaAtual();
    const instanceName = instanceForTenant(tenantId);
    const token = createWebhookToken();
    const callback = publicWebhookUrl(tenantId, token);

    try {
      await evolutionRequest(`/instance/create`, { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true, syncFullHistory: true, groupsIgnore: true });
    } catch (cause) {
      // Instâncias existentes são reutilizadas; os demais erros continuam visíveis.
      const existing = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`).catch(() => null);
      if (!existing && !(cause instanceof EvolutionError && cause.status === 409)) throw cause;
    }

    await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      enabled: true,
      url: callback,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    });
    await prisma.whatsAppConnection.upsert({
      where: { tenantId },
      create: { tenantId, instanceName, status: "CONNECTING", webhookTokenHash: hashWebhookToken(token) },
      update: { instanceName, status: "CONNECTING", webhookTokenHash: hashWebhookToken(token) },
    });
    const qr = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`);
    const result = qr as { base64?: unknown; qrcode?: { base64?: unknown } };
    const qrCode = result.base64 ?? result.qrcode?.base64;
    return NextResponse.json({ status: "CONNECTING", qrCode: typeof qrCode === "string" && /^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(qrCode) && qrCode.length < 500_000 ? qrCode : null });
  } catch (cause) {
    const status = cause instanceof EvolutionError ? cause.status : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao iniciar conexão." }, { status });
  }
}
