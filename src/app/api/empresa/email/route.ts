import { NextResponse } from "next/server";
import { z } from "zod";
import { cifrar, cifraLigada } from "@/lib/cifra";
import prisma, { empresaAtual } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";
import { origemDaRequisicao, registrarAuditoriaDepois } from "@/lib/auditoria";
import { smtpCentralConfigurado } from "@/lib/email-transporte";

const schema = z.object({
  mode: z.enum(["TMS", "PROPRIO"]),
  enabled: z.boolean(),
  fromName: z.string().trim().max(120).nullable(),
  fromEmail: z.email().max(254).nullable(),
  smtpHost: z.string().trim().max(253).nullable(),
  smtpPort: z.number().int().min(1).max(65535).nullable(),
  smtpSecure: z.boolean(),
  smtpUsername: z.string().trim().max(254).nullable(),
  smtpPassword: z.string().max(500).optional(),
}).strict();

const safeSelect = {
  mode: true, enabled: true, fromName: true, fromEmail: true, smtpHost: true,
  smtpPort: true, smtpSecure: true, smtpUsername: true,
  smtpPasswordCiphertext: true, updatedAt: true,
} as const;

export async function GET() {
  const { error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  try {
    const tenantId = await empresaAtual();
    const config = await prisma.tenantEmailSettings.findUnique({ where: { tenantId }, select: safeSelect });
    const entregas = await prisma.documentDelivery.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, documentType: true, recipientEmail: true, status: true, attempts: true, errorMessage: true, createdAt: true, sentAt: true },
    });
    return NextResponse.json({
      mode: config?.mode ?? "TMS",
      enabled: config?.enabled ?? false,
      fromName: config?.fromName ?? "",
      fromEmail: config?.fromEmail ?? "",
      smtpHost: config?.smtpHost ?? "",
      smtpPort: config?.smtpPort ?? 587,
      smtpSecure: config?.smtpSecure ?? false,
      smtpUsername: config?.smtpUsername ?? "",
      passwordConfigured: Boolean(config?.smtpPasswordCiphertext),
      centralAvailable: smtpCentralConfigurado(),
      encryptionAvailable: cifraLigada(),
      updatedAt: config?.updatedAt ?? null,
      entregas,
    });
  } catch (error) {
    console.error("Erro ao ler configuração de e-mail:", error);
    return NextResponse.json({ error: "Não foi possível carregar a configuração de e-mail." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await requireStaff({ pode: "empresa" });
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const tenantId = await empresaAtual();
  const data = parsed.data;
  if (data.enabled && data.mode === "TMS" && !smtpCentralConfigurado()) {
    return NextResponse.json({ error: "O SMTP central ainda não está configurado no serviço do TMS." }, { status: 409 });
  }
  if (data.mode === "PROPRIO" && data.enabled && (!data.smtpHost || !data.smtpPort || !data.smtpUsername || !data.fromEmail)) {
    return NextResponse.json({ error: "Preencha host, porta, usuário e e-mail do remetente." }, { status: 400 });
  }
  if (data.mode === "PROPRIO" && data.enabled && !data.smtpPassword && !(await prisma.tenantEmailSettings.findUnique({ where: { tenantId }, select: { smtpPasswordCiphertext: true } }))?.smtpPasswordCiphertext) {
    return NextResponse.json({ error: "Informe a senha SMTP para ativar o envio próprio." }, { status: 400 });
  }
  if (data.mode === "PROPRIO" && data.smtpPassword && !cifraLigada()) {
    return NextResponse.json({ error: "O serviço não está pronto para armazenar credenciais SMTP com segurança." }, { status: 503 });
  }

  try {
    const anterior = await prisma.tenantEmailSettings.findUnique({ where: { tenantId }, select: safeSelect });
    const smtpPasswordCiphertext = data.smtpPassword
      ? cifrar(data.smtpPassword, `tenant-email:${tenantId}:smtpPassword`)
      : anterior?.smtpPasswordCiphertext ?? null;
    const configuracao = await prisma.tenantEmailSettings.upsert({
      where: { tenantId },
      create: {
        tenantId, mode: data.mode, enabled: data.enabled, fromName: data.fromName,
        fromEmail: data.fromEmail, smtpHost: data.smtpHost, smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure, smtpUsername: data.smtpUsername,
        smtpPasswordCiphertext,
      },
      update: {
        mode: data.mode, enabled: data.enabled, fromName: data.fromName,
        fromEmail: data.fromEmail, smtpHost: data.smtpHost, smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure, smtpUsername: data.smtpUsername,
        smtpPasswordCiphertext: data.mode === "PROPRIO" ? smtpPasswordCiphertext : null,
      },
      select: { id: true, mode: true, enabled: true, fromEmail: true, smtpHost: true },
    });
    await registrarAuditoriaDepois(prisma, {
      ator: user,
      origem: origemDaRequisicao(request),
      acao: "integracao.alterar",
      entidade: "integracao",
      entidadeId: configuracao.id,
      resumo: `Envio de e-mail ${data.enabled ? "ativado" : "desativado"} • ${data.mode === "TMS" ? "serviço TMS" : "SMTP próprio"}`,
      antes: anterior ? { mode: anterior.mode, enabled: anterior.enabled, fromEmail: anterior.fromEmail, smtpHost: anterior.smtpHost } : null,
      depois: { mode: configuracao.mode, enabled: configuracao.enabled, fromEmail: configuracao.fromEmail, smtpHost: configuracao.smtpHost },
    });
    return NextResponse.json({ saved: true, passwordConfigured: Boolean(smtpPasswordCiphertext) });
  } catch (error) {
    console.error("Erro ao salvar configuração de e-mail:", error);
    return NextResponse.json({ error: "Não foi possível salvar a configuração de e-mail." }, { status: 500 });
  }
}
