import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createTransport, type Transporter } from "nodemailer";
import { decifrar } from "@/lib/cifra";
import { sistema } from "@/lib/prisma";

type Settings = {
  mode: string;
  enabled: boolean;
  fromName: string | null;
  fromEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPasswordCiphertext: string | null;
};

type Config = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

const env = (key: string) => process.env[key]?.trim() || "";
const emailValido = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const smtpCentralConfigurado = () => Boolean(
  env("TMS_SMTP_HOST") && env("TMS_SMTP_USER") && env("TMS_SMTP_PASSWORD") && emailValido(env("TMS_SMTP_FROM_EMAIL")),
);

function ipPublico(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized !== "::" && normalized !== "::1" && !normalized.startsWith("fe80:") && !normalized.startsWith("fc") && !normalized.startsWith("fd") && !normalized.startsWith("::ffff:") && !normalized.startsWith("2001:db8:");
  }
  return false;
}

async function transporte(config: Config): Promise<Transporter> {
  const host = config.host.replace(/^\[|\]$/g, "").toLowerCase();
  const address = isIP(host) ? host : (await lookup(host)).address;
  if (!ipPublico(address)) throw new Error("O servidor SMTP precisa usar um endereço público.");
  return createTransport({
    host: address,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { servername: isIP(host) ? undefined : host, minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function configEmailTenant(tenantId: string, settings?: Settings | null): Promise<{ transporter: Transporter; from: string }> {
  const config = settings === undefined
    ? await sistema.tenantEmailSettings.findUnique({ where: { tenantId } })
    : settings;
  if (!config) throw new Error("Configure o envio de e-mail da transportadora.");

  let smtp: Config;
  if (config.mode === "TMS") {
    if (!smtpCentralConfigurado()) throw new Error("O envio central do TMS ainda não está provisionado.");
    smtp = {
      host: env("TMS_SMTP_HOST"), port: Number(env("TMS_SMTP_PORT") || 587),
      secure: env("TMS_SMTP_SECURE") === "true" || env("TMS_SMTP_PORT") === "465",
      user: env("TMS_SMTP_USER"), pass: env("TMS_SMTP_PASSWORD"),
      from: `${config.fromName || env("TMS_SMTP_FROM_NAME") || "TMS Ávila Ops"} <${env("TMS_SMTP_FROM_EMAIL")}>`,
    };
  } else {
    if (!config.smtpHost || !config.smtpPort || !config.smtpUsername || !config.smtpPasswordCiphertext || !config.fromEmail) {
      throw new Error("Complete os dados do SMTP próprio e salve a senha.");
    }
    smtp = {
      host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
      user: config.smtpUsername,
      pass: decifrar(config.smtpPasswordCiphertext, `tenant-email:${tenantId}:smtpPassword`),
      from: `${config.fromName || "Transportadora"} <${config.fromEmail}>`,
    };
  }
  if (!Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535 || !emailValido(config.mode === "TMS" ? smtp.from.match(/<([^>]+)>/)?.[1] ?? "" : config.fromEmail || "")) {
    throw new Error("Configuração SMTP incompleta ou inválida.");
  }
  return { transporter: await transporte(smtp), from: smtp.from };
}

export async function enviarEmailTenant(input: {
  tenantId: string;
  settings?: Settings | null;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  deliveryId?: string;
}) {
  const { transporter, from } = await configEmailTenant(input.tenantId, input.settings);
  const result = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
    ...(input.deliveryId ? { headers: { "X-TMS-Delivery-ID": input.deliveryId } } : {}),
  });
  return { messageId: result.messageId };
}

export async function testarEmailTenant(tenantId: string, settings: Settings, to: string) {
  const { transporter, from } = await configEmailTenant(tenantId, settings);
  await transporter.verify();
  return transporter.sendMail({
    from, to,
    subject: "Teste de envio • TMS Ávila Ops",
    text: "O servidor SMTP da transportadora aceitou a mensagem de teste.",
    html: "<p>O servidor SMTP da transportadora aceitou a mensagem de teste.</p>",
  });
}

export function erroEmailSeguro(error: unknown): string {
  if (!(error instanceof Error)) return "Falha no envio SMTP.";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return code ? `Falha no envio SMTP (${code}).` : "Falha no envio SMTP; confira host, porta, TLS e credenciais.";
}
