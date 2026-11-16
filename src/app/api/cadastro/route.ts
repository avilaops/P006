import { NextResponse } from "next/server";
import { requireConta } from "@/lib/plataforma";
import { empresasDaConta } from "@/lib/auth";
import { CadastroErro, cadastroEmpresaSchema, cadastroIsentoPermitido, empresaDoCadastro, registrarEmpresaIsenta } from "@/lib/cadastro-inicial";
import { origemDaRequisicao } from "@/lib/auditoria";
import { consumeRateLimit } from "@/lib/rate-limit";

const resposta = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
function falha(error: unknown) {
  if (error instanceof CadastroErro) return resposta({ error: error.message }, error.status);
  console.error("Cadastro inicial: falha de persistência.");
  return resposta({ error: "Não foi possível concluir o cadastro. Tente novamente em alguns instantes." }, 500);
}

/** Pré-tenant: identidade SSO e liberação específica, nunca perfil de outra empresa. */
export async function GET() {
  const { conta, error } = await requireConta();
  if (error) return error;
  try {
    return resposta({ nome: conta.nome, email: conta.email, permitido: cadastroIsentoPermitido(conta.email),
      empresa: await empresaDoCadastro(conta.email), empresas: await empresasDaConta(conta) });
  } catch (e) { return falha(e); }
}

async function corpoLimitado(req: Request): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  let total = 0; const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 4096) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
export async function POST(req: Request) {
  const { conta, error } = await requireConta();
  if (error) return error;
  if (!cadastroIsentoPermitido(conta.email)) return resposta({ error: "O cadastro desta transportadora precisa de liberação da equipe." }, 403);
  const origin = new URL(process.env.NEXTAUTH_URL || req.url).origin;
  if (req.headers.get("origin") !== origin) return resposta({ error: "Origem do cadastro inválida. Atualize a página e tente novamente." }, 403);
  const parsed = cadastroEmpresaSchema.safeParse(await corpoLimitado(req));
  if (!parsed.success) return resposta({ error: parsed.error.issues[0]?.message ?? "Confira os dados da transportadora." }, 400);
  if (!consumeRateLimit(`cadastro:${conta.email}`, 6, 60 * 60 * 1000).allowed) return resposta({ error: "Muitas tentativas de cadastro. Tente novamente mais tarde." }, 429);
  try {
    const resultado = await registrarEmpresaIsenta(conta, parsed.data, origemDaRequisicao(req));
    return resposta(resultado, resultado.criada ? 201 : 200);
  } catch (e) { return falha(e); }
}
