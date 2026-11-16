// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { montar, desmontarTudo, clicar, porTexto, ate } from "./tela";
const mocks = vi.hoisted(() => ({ update: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ update: mocks.update }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/lib/sair", () => ({ sair: vi.fn() }));
import Cadastro from "@/app/cadastro/CadastroEmpresa";
const fetchMock = vi.fn();
const empresa = { name: "Transportadora Exemplo", slug: "transportadora-exemplo" };
let permitido = true;
beforeEach(() => {
  permitido = true; mocks.update.mockReset(); mocks.replace.mockReset(); mocks.refresh.mockReset();
  fetchMock.mockImplementation(async (_url, init) => Response.json(init?.method === "POST" ? { empresa, criada: true } : { permitido, nome: "Administrador", email: "cadastro@exemplo.test", empresas: [], empresa: null }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await desmontarTudo(); vi.unstubAllGlobals(); });
async function preencher(tela: HTMLElement, nome: string, value: string) {
  const input = tela.querySelector<HTMLInputElement>(`input[name="${nome}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("interface de cadastro da transportadora", () => {
  it("mostra a identidade confirmada sem permitir editar e-mail ou escolher isenção", async () => {
    const tela = await montar(<Cadastro />);
    await ate(() => expect(tela.textContent).toContain("cadastro@exemplo.test"));
    expect(tela.querySelector('input[type="email"]')).toBeNull();
    expect(tela.querySelector('input[name="role"]')).toBeNull();
    expect(tela.textContent).toContain("Nenhuma cobrança será gerada nesta etapa");
  });
  it("envia somente dados empresariais e oferece entrar após criar", async () => {
    const tela = await montar(<Cadastro />);
    await ate(() => expect(tela.querySelector("form")).not.toBeNull());
    await preencher(tela, "name", empresa.name); await preencher(tela, "slug", empresa.slug); await preencher(tela, "cnpj", "11222333000181");
    await act(async () => { tela.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({ ...empresa, cnpj: "11222333000181" });
    await ate(() => expect(tela.textContent).toContain("Transportadora cadastrada"));
    mocks.update.mockResolvedValueOnce(null);
    await clicar(porTexto(tela, "button", "Entrar no TMS")[0]);
    expect(tela.textContent).toContain("Tente entrar novamente");
    mocks.update.mockResolvedValueOnce({ user: { tenantId: "empresa-propria", situacao: "dentro" } });
    await clicar(porTexto(tela, "button", "Entrar no TMS")[0]);
    expect(mocks.update).toHaveBeenLastCalledWith({ empresa: empresa.slug });
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("outras contas recebem contato e escolha de empresa, sem formulário de criação", async () => {
    permitido = false;
    const tela = await montar(<Cadastro />);
    await ate(() => expect(tela.textContent).toContain("Falar com a equipe"));
    expect(tela.querySelector("form")).toBeNull();
    expect(tela.querySelector('a[href="/empresa"]')).not.toBeNull();
  });
  it("falha de rede não aparenta cadastro concluído e permite recarregar", async () => {
    fetchMock.mockRejectedValue(new Error("rede indisponível"));
    const tela = await montar(<Cadastro />);
    await ate(() => expect(tela.querySelector('[role="alert"]')).not.toBeNull());
    expect(tela.textContent).not.toContain("Transportadora cadastrada");
    expect(porTexto(tela, "button", "Tentar novamente")).toHaveLength(1);
  });
});
