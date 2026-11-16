import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ conta: vi.fn(), encontrar: vi.fn(), transacao: vi.fn(), empresas: vi.fn() }));
vi.mock("@/lib/plataforma", () => ({ requireConta: mocks.conta }));
vi.mock("@/lib/auth", () => ({ empresasDaConta: mocks.empresas }));
vi.mock("@/lib/prisma", () => ({ sistema: { tenant: { findUnique: mocks.encontrar }, $transaction: mocks.transacao } }));
import { GET, POST } from "@/app/api/cadastro/route";
import { cadastroEmpresaSchema, cadastroIsentoPermitido } from "@/lib/cadastro-inicial";

const email = "cadastro@exemplo.test";
const corpo = { name: "Transportadora Exemplo", slug: "transportadora-exemplo", cnpj: "11222333000181" };
const req = (data: unknown = corpo, origin: string | null = "https://tms.exemplo.test") => new Request("https://tms.exemplo.test/api/cadastro", {
  method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(data),
});
beforeEach(() => {
  vi.stubEnv("TMS_CADASTRO_ISENTO_EMAIL", email);
  vi.stubEnv("NEXTAUTH_URL", "https://tms.exemplo.test");
  mocks.conta.mockResolvedValue({ conta: { email, nome: "Administrador", papel: "CLIENTE" }, equipe: false, error: null });
  mocks.encontrar.mockResolvedValue(null);
  mocks.empresas.mockResolvedValue([]);
  mocks.transacao.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("cadastro da própria empresa", () => {
  it("fecha a liberação sem configuração e compara o e-mail completo", () => {
    expect(cadastroIsentoPermitido(" CADASTRO@EXEMPLO.TEST ")).toBe(true);
    expect(cadastroIsentoPermitido("cadastro@exemplo.test.evil")).toBe(false);
    vi.stubEnv("TMS_CADASTRO_ISENTO_EMAIL", "");
    expect(cadastroIsentoPermitido(email)).toBe(false);
  });
  it("rejeita tentativa de escolher administrador, perfil, tenant ou isenção", () => {
    for (const extra of [{ adminEmail: "outra@exemplo.test" }, { role: "ADMIN" }, { tenantId: "alheio" }, { selfSignupExempt: true }]) {
      expect(cadastroEmpresaSchema.safeParse({ ...corpo, ...extra }).success).toBe(false);
    }
    expect(cadastroEmpresaSchema.safeParse({ ...corpo, cnpj: "00000000000000" }).success).toBe(false);
    expect(cadastroEmpresaSchema.parse({ ...corpo, cnpj: "11.222.333/0001-81" }).cnpj).toBe(corpo.cnpj);
  });
  it("sem sessão responde 401 e não consulta o banco", async () => {
    mocks.conta.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    expect((await POST(req())).status).toBe(401);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
  it("nega a conta não liberada mesmo que ela declare isenção", async () => {
    vi.stubEnv("TMS_CADASTRO_ISENTO_EMAIL", "outra@exemplo.test");
    expect((await POST(req())).status).toBe(403);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
  it.each([null, "https://outro.exemplo.test"])("origem %s não cria cadastro", async origin => {
    expect((await POST(req(corpo, origin))).status).toBe(403);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
  it("limita o corpo real mesmo sem Content-Length", async () => {
    expect((await POST(req({ ...corpo, name: "x".repeat(5000) }))).status).toBe(400);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
  it("GET informa liberação e empresas somente da identidade da sessão, sem cache", async () => {
    const res = await GET();
    expect(await res.json()).toMatchObject({ permitido: true, email, empresas: [] });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mocks.empresas).toHaveBeenCalledWith(expect.objectContaining({ email }));
  });
  it("cria o primeiro administrador com a identidade da sessão e retorna 201", async () => {
    const tx = {
      tenant: { create: vi.fn().mockResolvedValue({ id: "empresa-nova", slug: corpo.slug, name: corpo.name }) },
      user: { create: vi.fn().mockResolvedValue({ id: "admin-local", name: "Administrador", role: "ADMIN" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "auditoria" }) },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    mocks.transacao.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx));
    const res = await POST(req());
    expect(res.status).toBe(201);
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: "empresa-nova", email, name: "Administrador", role: "ADMIN" }) });
    expect(tx.tenant.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ selfSignupEmail: email, selfSignupExempt: true }) }));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ empresa: { name: corpo.name, slug: corpo.slug }, criada: true });
  });
  it("repete o cadastro sem duplicar empresa nem reativar empresa inativa", async () => {
    mocks.encontrar.mockResolvedValue({ slug: corpo.slug, name: corpo.name, active: true });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ empresa: { slug: corpo.slug }, criada: false });
    expect(mocks.transacao).not.toHaveBeenCalled();
    mocks.encontrar.mockResolvedValue({ slug: corpo.slug, active: false });
    expect((await POST(req())).status).toBe(403);
  });
});
