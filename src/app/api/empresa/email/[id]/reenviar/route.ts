import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  try {
    const { id } = await params;
    const enabled = await prisma.tenantEmailSettings.findFirst({ where: { enabled: true }, select: { id: true } });
    if (!enabled) return NextResponse.json({ error: "Ative e salve o envio de e-mail antes de tentar novamente." }, { status: 409 });
    const updated = await prisma.documentDelivery.updateMany({
      where: { id, status: "FAILED" },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastAttemptAt: null, errorMessage: null },
    });
    if (!updated.count) return NextResponse.json({ error: "Esse envio não está disponível para nova tentativa." }, { status: 404 });
    return NextResponse.json({ queued: true }, { status: 202 });
  } catch (error) {
    console.error("Erro ao reenfileirar e-mail documental:", error);
    return NextResponse.json({ error: "Não foi possível reenfileirar o e-mail." }, { status: 500 });
  }
}
