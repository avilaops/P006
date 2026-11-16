import { z } from "zod";
import type { ContaAvilaOps } from "@/lib/auth";
import { sistema } from "@/lib/prisma";
import { cnpjValido } from "@/lib/cte";
import { senhaSemUso } from "@/lib/acessos";
import { registrarAuditoria, type Origem } from "@/lib/auditoria";

export const cadastroEmpresaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da transportadora.").max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "Use de 1 a 40 letras minúsculas, números ou hífen no identificador."),
  cnpj: z.string().trim().transform(v => v.replace(/[.\-\/\s]/g, "").toUpperCase()).refine(cnpjValido, "Informe um CNPJ válido."),
}).strict();
export type CadastroEmpresa = z.infer<typeof cadastroEmpresaSchema>;
export type EmpresaCadastro = { slug: string; name: string };
export class CadastroErro extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}

/** Nenhuma liberação de teste é embutida no código ou enviada pelo cliente. */
export function cadastroIsentoPermitido(email: string): boolean {
  const liberado = process.env.TMS_CADASTRO_ISENTO_EMAIL?.trim().toLowerCase();
  return !!liberado && z.email().safeParse(liberado).success && email.trim().toLowerCase() === liberado;
}
const SELECT = { slug: true, name: true, active: true } as const;
function existente(empresa: { slug: string; name: string; active: boolean }) {
  if (!empresa.active) throw new CadastroErro(403, "Esta empresa está inativa. Fale com a equipe para continuar.");
  return { empresa: { slug: empresa.slug, name: empresa.name }, criada: false };
}
export async function empresaDoCadastro(email: string) {
  const empresa = await sistema.tenant.findUnique({ where: { selfSignupEmail: email.trim().toLowerCase() }, select: SELECT });
  return empresa ? existente(empresa).empresa : null;
}

export async function registrarEmpresaIsenta(conta: ContaAvilaOps, dados: CadastroEmpresa, origem: Origem) {
  if (!cadastroIsentoPermitido(conta.email)) throw new CadastroErro(403, "O cadastro desta transportadora precisa de liberação da equipe.");
  const email = conta.email.trim().toLowerCase();
  const anterior = await sistema.tenant.findUnique({ where: { selfSignupEmail: email }, select: SELECT });
  if (anterior) return existente(anterior);
  try {
    return await sistema.$transaction(async tx => {
      const empresa = await tx.tenant.create({
        data: { ...dados, selfSignupEmail: email, selfSignupExempt: true }, select: { id: true, slug: true, name: true },
      });
      const user = await tx.user.create({ data: { tenantId: empresa.id, name: conta.nome, email, role: "ADMIN", password: senhaSemUso() } });
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${empresa.id}, true)`;
      await registrarAuditoria(tx, {
        ator: { id: user.id, name: user.name, role: user.role }, origem,
        acao: "empresa.criar", entidade: "empresa", entidadeId: empresa.id,
        resumo: "Transportadora cadastrada pelo primeiro administrador",
        depois: { name: empresa.name, slug: empresa.slug, cnpj: dados.cnpj, selfSignupExempt: true },
      });
      return { empresa: { slug: empresa.slug, name: empresa.name }, criada: true };
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      // A transação perdedora não deixou tenant, usuário ou auditoria parciais.
      const repetida = await sistema.tenant.findUnique({ where: { selfSignupEmail: email }, select: SELECT });
      if (repetida) return existente(repetida);
      throw new CadastroErro(409, "Não foi possível usar este identificador ou CNPJ. Confira os dados ou fale com a equipe.");
    }
    throw error;
  }
}
