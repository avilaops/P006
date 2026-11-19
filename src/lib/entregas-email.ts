import { Prisma } from "@prisma/client";
import { sistema } from "@/lib/prisma";
import { TENTATIVAS } from "@/lib/mensageria";
import { enviarEmailTenant, erroEmailSeguro } from "@/lib/email-transporte";
import { respostaDoDacte } from "@/lib/fiscal-mcp";
import type { Documento } from "@/lib/roteamento-documentos";

type Evento = { id: string; tenantId: string; type: string; payload: Prisma.JsonValue; attempts: number; createdAt: Date };
type Destinatario = { email: string; categoria: string; documentosSolicitados: Documento[] };
type LinhaFila = { id: string; tenantId: string; clientId: string; eventId: string; documentType: Documento; recipientEmail: string; attempts: number };
type ClientRef = { id?: string };
type Item = {
  id?: string; status?: string; destinatario?: string; destino?: string; rastreio?: { codigo?: string };
  numero?: number; serie?: number; chave?: string; situacao?: string; carga?: { id?: string; cliente?: ClientRef };
  cliente?: ClientRef; total?: number; vencimento?: string | null; cargas?: number; descricao?: string;
  valor?: number; diasDeAtraso?: number; cobranca?: { boleto?: { link?: string | null; linhaDigitavel?: string | null }; pix?: { link?: string | null; copiaECola?: string | null } };
  fatura?: { numero?: number };
  pixCopiaECola?: string;
};
type EventData = { coleta?: Item | null; cte?: Item | null; fatura?: Item | null; titulo?: Item | null };

const base = () => (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const bytesDataUrl = (value: string) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match ? { content: Buffer.from(match[2], "base64"), contentType: `image/${match[1] === "jpeg" ? "jpeg" : match[1]}` } : null;
};

function objetoEvento(data: EventData): Item {
  return data.coleta ?? data.cte ?? data.fatura ?? data.titulo ?? {};
}

/** Cria um item independente para cada documento e destinatário, sem duplicar reentregas do webhook. */
export async function enfileirarDocumentosEmail(evento: Evento, destinatarios: Destinatario[], data: EventData) {
  if (!destinatarios.length) return 0;
  const objeto = objetoEvento(data);
  const cliente = objeto.cliente ?? objeto.carga?.cliente;
  if (!cliente?.id) return 0;
  const linhas = destinatarios.flatMap((destinatario) => destinatario.documentosSolicitados.map((documentType) => ({
    tenantId: evento.tenantId,
    clientId: cliente.id as string,
    eventId: evento.id,
    documentType,
    recipientEmail: destinatario.email,
  })));
  if (!linhas.length) return 0;
  const created = await sistema.documentDelivery.createMany({ data: linhas, skipDuplicates: true });
  return created.count;
}

function detalhesDoEvento(evento: Evento, data: EventData, documentType: Documento) {
  const item = objetoEvento(data);
  let subject = "Atualização da sua transportadora";
  let title = "Atualização operacional";
  let link: string | null = null;
  let linhas: string[] = [];

  if (documentType === "comprovantePdf" || evento.type === "comprovante.aprovado") {
    subject = `Comprovante de entrega aprovado • ${item.destinatario || "sua carga"}`;
    title = "Comprovante de entrega disponível";
    link = item.id ? `${base()}/portal/coletas/${encodeURIComponent(item.id)}` : null;
    linhas = [`Destinatário: ${item.destinatario || "—"}`, `Destino: ${item.destino || "—"}`, `Rastreamento: ${item.rastreio?.codigo || "—"}`];
  } else if (documentType === "cteXml" || documentType === "dactePdf" || evento.type.startsWith("cte.")) {
    subject = `CT-e ${item.numero ? `nº ${item.numero}` : "autorizado"}`;
    title = "CT-e autorizado pela SEFAZ";
    link = item.carga?.id ? `${base()}/portal/coletas/${encodeURIComponent(item.carga.id)}` : null;
    linhas = [`Número: ${item.numero ?? "—"}`, `Série: ${item.serie ?? "—"}`, `Chave: ${item.chave ?? "—"}`, `Status: ${item.situacao ?? "—"}`];
  } else if (documentType === "boletoPdf") {
    subject = `Boleto disponível • fatura nº ${item.numero ?? ""}`.trim();
    title = "Boleto de pagamento disponível";
    link = item.cobranca?.boleto?.link ?? `${base()}/portal/faturas`;
    linhas = [`Fatura: ${item.numero ?? "—"}`, `Valor: ${formatarMoeda(item.total)}`, `Vencimento: ${item.vencimento ?? "—"}`];
    if (item.cobranca?.boleto?.link) linhas.push(`Boleto: ${item.cobranca.boleto.link}`);
    if (item.cobranca?.boleto?.linhaDigitavel) linhas.push(`Linha digitável: ${item.cobranca.boleto.linhaDigitavel}`);
  } else if (documentType === "faturaPdf" || evento.type.startsWith("fatura.")) {
    subject = `Fatura ${item.numero ? `nº ${item.numero}` : "atualizada"}`;
    title = "Fatura de transporte";
    link = `${base()}/portal/faturas`;
    linhas = [`Valor: ${formatarMoeda(item.total)}`, `Vencimento: ${item.vencimento ?? "—"}`, `Cargas: ${item.cargas ?? "—"}`, `Situação: ${item.status ?? "—"}`];
  } else {
    subject = `Cobrança vencida • ${item.fatura?.numero ? `fatura nº ${item.fatura.numero}` : item.descricao || "título"}`;
    title = "Aviso de cobrança";
    link = `${base()}/portal/faturas`;
    linhas = [`Descrição: ${item.descricao || "—"}`, `Valor: ${formatarMoeda(item.valor)}`, `Vencimento: ${item.vencimento ?? "—"}`, `Dias em atraso: ${item.diasDeAtraso ?? "—"}`];
  }

  if (item.cobranca?.boleto?.link) linhas.push(`Boleto: ${item.cobranca.boleto.link}`);
  if (item.cobranca?.pix?.link) linhas.push(`Pix: ${item.cobranca.pix.link}`);
  const pixCopiaECola = item.cobranca?.pix?.copiaECola || item.pixCopiaECola;
  if (pixCopiaECola) linhas.push(`Pix Copia e Cola: ${pixCopiaECola}`);
  const text = `${title}\n\n${linhas.join("\n")}${link ? `\n\nAcesse o portal: ${link}` : ""}\n\nMensagem automática do TMS.`;
  const html = `<main style="font-family:Arial,sans-serif;color:#172033;max-width:620px;margin:auto"><h1 style="font-size:22px">${esc(title)}</h1><p>Olá,</p><p>Há uma atualização nos documentos da sua operação.</p><table style="border-collapse:collapse;width:100%">${linhas.map((line) => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(line)}</td></tr>`).join("")}</table>${link ? `<p style="margin:24px 0"><a href="${esc(link)}" style="background:#155eef;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir no portal</a></p>` : ""}<p style="font-size:12px;color:#667085">Mensagem automática enviada pela transportadora pelo TMS.</p></main>`;
  return { subject, text, html, link };
}

function formatarMoeda(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

async function anexosDocumento(linha: LinhaFila, evento: Evento) {
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  if (linha.documentType === "cteXml" || linha.documentType === "dactePdf") {
    const cteIdValue = (evento.payload as { cteId?: unknown })?.cteId;
    const cteId = typeof cteIdValue === "string" ? cteIdValue : null;
    const cte = cteId ? await sistema.cte.findFirst({
      where: { id: cteId, tenantId: linha.tenantId, status: "AUTHORIZED", environment: "PRODUCAO" },
      select: { xmlReturn: true, accessKey: true, number: true },
    }) : null;
    if (!cte?.xmlReturn) throw new Error("O CT-e não está mais autorizado em produção.");
    if (linha.documentType === "cteXml") {
      attachments.push({ filename: `${cte.accessKey}.xml`, content: Buffer.from(cte.xmlReturn, "utf8"), contentType: "application/xml" });
    } else {
      const response = await respostaDoDacte(cte.accessKey, cte.xmlReturn, false);
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Não foi possível gerar o DACTE agora.");
      const content = Buffer.from(await response.arrayBuffer());
      if (content.byteLength > 8_000_000) throw new Error("O DACTE excede o limite de anexo de e-mail.");
      attachments.push({ filename: `${cte.accessKey}-dacte.pdf`, content, contentType: "application/pdf" });
    }
  }
  if (linha.documentType === "comprovantePdf") {
    const collectionIdValue = (evento.payload as { collectionId?: unknown })?.collectionId;
    const collectionId = typeof collectionIdValue === "string" ? collectionIdValue : null;
    const proof = collectionId ? await sistema.proofOfDelivery.findFirst({
      where: { tenantId: linha.tenantId, collectionId, status: "APPROVED" },
      select: { photoBase64: true, signatureBase64: true, photos: { where: { replacedAt: null, kind: { in: ["ENTREGA", "CANHOTO"] } }, select: { kind: true, dataUrl: true }, orderBy: { createdAt: "asc" } } },
    }) : null;
    if (!proof) throw new Error("O comprovante ainda não foi aprovado ou não está disponível.");
    const photos = proof.photos.map((photo) => ({ kind: photo.kind, image: bytesDataUrl(photo.dataUrl) })).filter((photo) => photo.image);
    if (!photos.length && proof.photoBase64) {
      const image = bytesDataUrl(proof.photoBase64.startsWith("data:") ? proof.photoBase64 : `data:image/jpeg;base64,${proof.photoBase64}`);
      if (image) photos.push({ kind: "ENTREGA", image });
    }
    for (const [index, photo] of photos.entries()) {
      if (!photo.image) continue;
      attachments.push({ filename: `comprovante-${photo.kind.toLowerCase()}-${index + 1}.${photo.image.contentType.split("/")[1] === "jpeg" ? "jpg" : photo.image.contentType.split("/")[1]}`, content: photo.image.content, contentType: photo.image.contentType });
    }
    const signature = proof.signatureBase64 ? bytesDataUrl(proof.signatureBase64) : null;
    if (signature) attachments.push({ filename: "assinatura-recebimento.png", content: signature.content, contentType: signature.contentType });
  }
  const total = attachments.reduce((sum, attachment) => sum + attachment.content.byteLength, 0);
  if (total > 8_000_000) throw new Error("Os anexos excedem o limite de 8 MB por e-mail.");
  return attachments;
}

async function enviarLinha(linha: LinhaFila) {
  const [config, evento] = await Promise.all([
    sistema.tenantEmailSettings.findUnique({ where: { tenantId: linha.tenantId } }),
    sistema.outboxEvent.findFirst({ where: { id: linha.eventId, tenantId: linha.tenantId }, select: { id: true, tenantId: true, type: true, payload: true, attempts: true, createdAt: true } }),
  ]);
  if (!config?.enabled) throw new Error("Envio automático por e-mail está desativado.");
  if (!evento) throw new Error("Evento original não encontrado.");
  const { dadosDoEvento } = await import("@/lib/eventos");
  const data = await dadosDoEvento(evento);
  const eventData = data as EventData;
  const mail = detalhesDoEvento(evento, eventData, linha.documentType);
  const attachments = await anexosDocumento(linha, evento);
  const result = await enviarEmailTenant({
    tenantId: linha.tenantId, settings: config, to: linha.recipientEmail,
    subject: mail.subject, text: mail.text, html: mail.html, attachments, deliveryId: linha.id,
  });
  await sistema.documentDelivery.update({
    where: { id: linha.id },
    data: { status: "SENT", sentAt: new Date(), providerId: result.messageId, errorMessage: null },
  });
}

/** Reivindica um lote com SKIP LOCKED; SMTP falho volta à fila com recuo exponencial. */
export async function processarEmailsPendentes(): Promise<{ enviados: number; falhas: number }> {
  const lote = await sistema.$queryRaw<LinhaFila[]>(Prisma.sql`
    UPDATE "DocumentDelivery" d
       SET status = 'QUEUED', attempts = d.attempts + 1,
           "lastAttemptAt" = now(),
           "nextAttemptAt" = now() + make_interval(mins => (2 ^ d.attempts)::int)
     WHERE d.id IN (
       SELECT id FROM "DocumentDelivery"
        WHERE attempts < ${TENTATIVAS} AND "nextAttemptAt" <= now()
          AND (status IN ('PENDING','FAILED') OR (status = 'QUEUED' AND "lastAttemptAt" < now() - interval '5 minutes'))
        ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED
     )
    RETURNING d.id,d."tenantId",d."clientId",d."eventId",d."documentType",d."recipientEmail",d.attempts`);
  let enviados = 0;
  let falhas = 0;
  for (const linha of lote) {
    try {
      await enviarLinha(linha);
      enviados += 1;
    } catch (error) {
      await sistema.documentDelivery.update({ where: { id: linha.id }, data: { status: "FAILED", errorMessage: erroEmailSeguro(error) } });
      falhas += 1;
    }
  }
  return { enviados, falhas };
}
