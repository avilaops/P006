import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { empresaAtual } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";
import { EvolutionError, evolutionRequest, instanceForTenant } from "@/lib/evolution-whatsapp";
import { importarMensagensWhatsApp } from "@/lib/whatsapp-ingest";

export const dynamic = "force-dynamic";

export async function POST() {
  const { error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  try {
    const tenantId = await empresaAtual();
    const connection = await prisma.whatsAppConnection.findUnique({ where: { tenantId }, select: { historyPage: true, historyImported: true, historyComplete: true, status: true } });
    if (!connection) return NextResponse.json({ error: "Conecte primeiro o WhatsApp." }, { status: 409 });
    if (connection.status !== "CONNECTED") return NextResponse.json({ error: "O WhatsApp precisa estar conectado para importar o histórico." }, { status: 409 });
    if (connection.historyComplete) return NextResponse.json({ complete: true, imported: connection.historyImported, page: connection.historyPage });

    const page = connection.historyPage + 1;
    const raw = await evolutionRequest(`/chat/findMessages/${encodeURIComponent(instanceForTenant(tenantId))}`, { where: {}, page, offset: 20 });
    const body = raw as { messages?: { records?: unknown[]; pages?: number; total?: number } | unknown[] };
    const records = Array.isArray(body.messages) ? body.messages : body.messages?.records;
    if (!Array.isArray(records)) throw new EvolutionError("A Evolution retornou um formato de histórico inválido.");
    const imported = await importarMensagensWhatsApp(tenantId, instanceForTenant(tenantId), records, { historical: true });
    const pages = Array.isArray(body.messages) ? undefined : body.messages?.pages;
    const complete = typeof pages === "number" ? page >= pages : records.length < 20;
    const saved = await prisma.whatsAppConnection.update({
      where: { tenantId },
      data: { historyPage: page, historyImported: { increment: imported }, historyComplete: complete },
      select: { historyPage: true, historyImported: true, historyComplete: true },
    });
    return NextResponse.json({ page: saved.historyPage, imported: saved.historyImported, complete: saved.historyComplete, pageImported: imported });
  } catch (cause) {
    const status = cause instanceof EvolutionError ? cause.status : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao importar o histórico." }, { status });
  }
}
