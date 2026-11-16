import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMPRESA_PADRAO } from "./empresas-de-teste";
const suite = process.env.DATABASE_URL ? describe : describe.skip;
suite("cadastro inicial com PostgreSQL real", () => {
  let banco: typeof import("@/lib/prisma");
  let cadastro: typeof import("@/lib/cadastro-inicial");
  const email = "teste-cadastro-inicial@exemplo.test";
  const conta = { email, nome: "Primeiro administrador", papel: "CLIENTE" };
  const dados = { name: "Teste cadastro inicial", slug: "teste-cadastro-inicial", cnpj: "11222333000181" };
  async function limpar() {
    const filtro = { tenant: { selfSignupEmail: email } };
    await banco.sistema.auditLog.deleteMany({ where: filtro });
    await banco.sistema.user.deleteMany({ where: filtro });
    await banco.sistema.tenant.deleteMany({ where: { selfSignupEmail: email } });
  }
  beforeAll(async () => {
    vi.stubEnv("TMS_CADASTRO_ISENTO_EMAIL", email);
    banco = await import("@/lib/prisma");
    cadastro = await import("@/lib/cadastro-inicial");
    await limpar();
    // O arquivo de schema do runner já contém as colunas. O SQL continua reaplicável.
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("prisma/sql/045-cadastro-inicial.sql", "utf8");
    for (let i = 0; i < 2; i++) for (const command of sql.split(";").filter(s => s.trim())) await banco.sistema.$executeRawUnsafe(command);
  });
  afterAll(async () => { if (banco) await limpar(); vi.unstubAllEnvs(); });

  it("concorrência cria um único tenant/ADMIN local e uma linha de auditoria", async () => {
    const results = await Promise.all([1, 2, 3].map(() => cadastro.registrarEmpresaIsenta(conta, dados, { ip: null, dispositivo: null })));
    expect(new Set(results.map(r => r.empresa.slug))).toEqual(new Set([dados.slug]));
    expect(results.filter(r => r.criada)).toHaveLength(1);
    const tenant = await banco.sistema.tenant.findUniqueOrThrow({ where: { selfSignupEmail: email } });
    expect(tenant.selfSignupExempt).toBe(true);
    const users = await banco.sistema.user.findMany({ where: { tenantId: tenant.id } });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email, name: conta.nome, role: "ADMIN" });
    expect(await banco.sistema.auditLog.count({ where: { tenantId: tenant.id, action: "empresa.criar" } })).toBe(1);
    expect(await banco.paraEmpresa(EMPRESA_PADRAO.id).db.user.findUnique({ where: { id: users[0].id } })).toBeNull();
    expect(await banco.paraEmpresa(tenant.id).db.tenant.findUnique({ where: { id: EMPRESA_PADRAO.id } })).toBeNull();
  });
  it("não reativa empresa, não muda dados ao repetir e não libera outra identidade", async () => {
    const original = await banco.sistema.tenant.findUniqueOrThrow({ where: { selfSignupEmail: email } });
    const res = await cadastro.registrarEmpresaIsenta(conta, { ...dados, name: "Nome forjado", slug: "outro-slug" }, { ip: null, dispositivo: null });
    expect(res.empresa.name).toBe(dados.name);
    expect(res.criada).toBe(false);
    await expect(cadastro.registrarEmpresaIsenta({ ...conta, email: "outro@exemplo.test" }, dados, { ip: null, dispositivo: null })).rejects.toMatchObject({ status: 403 });
    await banco.sistema.tenant.update({ where: { id: original.id }, data: { active: false } });
    await expect(cadastro.registrarEmpresaIsenta(conta, dados, { ip: null, dispositivo: null })).rejects.toMatchObject({ status: 403 });
    expect(await banco.sistema.tenant.count({ where: { selfSignupEmail: email } })).toBe(1);
  });
});
