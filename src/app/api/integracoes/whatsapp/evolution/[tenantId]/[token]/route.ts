import { NextResponse } from "next/server";
import { paraEmpresa, sistema } from "@/lib/prisma";
import { instanceForTenant, matchesWebhookToken } from "@/lib/evolution-whatsapp";
import { importarMensagensWhatsApp } from "@/lib/whatsapp-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string; token: string }> }) {
  const { tenantId, token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !/^[a-zA-Z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const connection = await sistema.whatsAppConnection.findUnique({ where: { tenantId }, select: { webhookTokenHash: true, instanceName: true } });
  if (!connection || connection.instanceName !== instanceForTenant(tenantId) || !matchesWebhookToken(token, connection.webhookTokenHash)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const event = await request.json().catch(() => null);
  if (!isRecord(event)) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  if (typeof event.instance === "string" && event.instance !== connection.instanceName) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  if (String(event.event).toUpperCase().replaceAll("-", "_") === "CONNECTION_UPDATE") {
    const data = isRecord(event.data) ? event.data : {};
    const instance = isRecord(data.instance) ? data.instance : {};
    const state = String(data.state ?? instance.state ?? "").toLowerCase();
    const status = state === "open" ? "CONNECTED" : state === "connecting" ? "CONNECTING" : "DISCONNECTED";
    const phoneRaw = data.owner ?? instance.owner;
    await paraEmpresa(tenantId).db.whatsAppConnection.update({ where: { tenantId }, data: { status, phone: typeof phoneRaw === "string" ? phoneRaw.split("@")[0].replace(/\D/g, "") : undefined, connectedAt: status === "CONNECTED" ? new Date() : undefined } });
    return NextResponse.json({ received: true });
  }
  if (String(event.event).toUpperCase().replaceAll("-", "_") !== "MESSAGES_UPSERT") return NextResponse.json({ received: true, ignored: true });

  const incoming = Array.isArray(event.data) ? event.data : [event.data];
  const imported = await importarMensagensWhatsApp(tenantId, connection.instanceName, incoming);
  return NextResponse.json({ received: true, imported });
}
