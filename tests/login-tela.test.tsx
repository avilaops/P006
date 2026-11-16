// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montar, desmontarTudo, porTexto } from "./tela";
const signIn = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/lib/sair", () => ({ sair: vi.fn() }));
import Login from "@/app/login/page";

afterEach(async () => { await desmontarTudo(); signIn.mockClear(); });
describe("retorno do primeiro cadastro no login", () => {
  it("preserva o destino local do cadastro", async () => {
    window.history.replaceState({}, "", "/login?callbackUrl=%2Fcadastro");
    await montar(<Login />);
    expect(signIn).toHaveBeenCalledWith("avilaops", { callbackUrl: "/cadastro" });
  });
  it.each(["https://evil.test", "//evil.test", "/login", "/api/auth/signout", "/cadastro%0a"])("recusa retorno %s", async destino => {
    window.history.replaceState({}, "", "/login?callbackUrl=" + encodeURIComponent(destino));
    await montar(<Login />);
    expect(signIn).toHaveBeenCalledWith("avilaops", { callbackUrl: "/" });
  });
  it("após sair não abre sessão automaticamente e oferece criar conta", async () => {
    window.history.replaceState({}, "", "/login?saiu=1&callbackUrl=%2Fcadastro");
    const tela = await montar(<Login />);
    expect(signIn).not.toHaveBeenCalled();
    expect(tela.textContent).toContain("Você saiu do sistema.");
    expect(porTexto(tela, "a", "Criar conta")[0]?.getAttribute("href")).toBe("/criar-conta");
  });
});
