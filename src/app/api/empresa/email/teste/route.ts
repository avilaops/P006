import { NextResponse } from "next/server";
import prisma, { empresaAtual } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";
import { testarEmailTenant } from "@/lib/email-transporte";

export async function POST() {
  const { user, error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  if (!user.email) return NextResponse.json({ error: "A conta não tem e-mail para receber o teste." }, { status: 400 });
  try {
    const tenantId = await empresaAtual();
    const settings = await prisma.tenantEmailSettings.findUnique({ where: { tenantId } });
    if (!settings) return NextResponse.json({ error: "Salve a configuração antes de testar." }, { status: 409 });
    await testarEmailTenant(tenantId, settings, user.email);
    return NextResponse.json({ accepted: true, to: user.email });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha no envio SMTP.";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
