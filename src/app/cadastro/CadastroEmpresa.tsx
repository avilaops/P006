"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, Loader2, Truck } from "lucide-react";
import { sair } from "@/lib/sair";
import type { EmpresaCadastro } from "@/lib/cadastro-inicial";
import "./cadastro.css";

type Dados = { nome: string; email: string; permitido: boolean; empresa: EmpresaCadastro | null; empresas: EmpresaCadastro[] };

export default function CadastroEmpresa() {
  const { update } = useSession();
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");

  const carregar = useCallback((signal?: AbortSignal) => {
    return fetch("/api/cadastro", { cache: "no-store", signal }).then(async res => {
      if (res.status === 401) { router.replace("/login?callbackUrl=%2Fcadastro"); return null; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar seu cadastro.");
      return data as Dados;
    }).then(data => {
      if (data && !signal?.aborted) setDados(data);
    }).catch(e => {
      if (!signal?.aborted) setErro(e instanceof Error ? e.message : "Não foi possível carregar seu cadastro.");
    }).finally(() => { if (!signal?.aborted) setCarregando(false); });
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    void carregar(controller.signal);
    return () => controller.abort();
  }, [carregar]);

  async function cadastrar(event: FormEvent) {
    event.preventDefault();
    if (salvando || !dados?.permitido) return;
    setSalvando(true); setErro("");
    try {
      const res = await fetch("/api/cadastro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, cnpj }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível concluir o cadastro.");
      setDados(atual => atual ? { ...atual, empresa: data.empresa } : atual);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir o cadastro."); }
    finally { setSalvando(false); }
  }
  async function entrar(empresa: EmpresaCadastro) {
    if (entrando) return;
    setEntrando(true); setErro("");
    try {
      const session = await update({ empresa: empresa.slug });
      if (!session?.user?.tenantId || session.user.situacao !== "dentro") throw new Error();
      router.replace("/"); router.refresh();
    } catch { setErro("Sua transportadora está cadastrada. Tente entrar novamente ou escolha a empresa pelo menu."); setEntrando(false); }
  }

  return <main className="tms-onboarding">
    <div className="onboarding-wrap">
      <Link className="onboarding-brand" href="/"><Truck size={28} aria-hidden="true" /> TMS <span>• Avila Ops</span></Link>
      <ol className="onboarding-steps" aria-label="Etapas do cadastro"><li>1 • Sua conta</li><li aria-current="step">2 • Transportadora</li><li>3 • Primeiro acesso</li></ol>
      <section className="onboarding-card" aria-labelledby="cadastro-titulo">
        <span className="onboarding-eyebrow">SEU PRIMEIRO ACESSO</span>
        <h1 id="cadastro-titulo">Sua transportadora no TMS.</h1>
        {carregando && <p role="status"><Loader2 className="onboarding-spinner" size={18} /> Carregando seu cadastro…</p>}
        {erro && <p role="alert" className="onboarding-error">{erro}</p>}
        {!carregando && !dados && <button className="onboarding-button" onClick={() => { setCarregando(true); setErro(""); void carregar(); }}>Tentar novamente</button>}
        {!carregando && dados && <>
          <p className="onboarding-identity"><CheckCircle2 size={18} aria-hidden="true" /><span>Conta confirmada • {dados.nome}<small>{dados.email}</small></span></p>
          {dados.empresa ? <div className="onboarding-complete">
            <Building2 size={30} aria-hidden="true" /><h2>Transportadora cadastrada</h2>
            <p>{dados.empresa.name}</p><p>Você administra esta empresa com a sua conta. A equipe e as configurações ficam disponíveis no painel.</p>
            <button className="onboarding-button" disabled={entrando} onClick={() => void entrar(dados.empresa!)}>{entrando ? "Entrando…" : "Entrar no TMS"}</button>
          </div> : dados.permitido ? <>
            <p>Informe os dados da sua empresa. Você será o primeiro administrador desta transportadora.</p>
            <p className="onboarding-notice">Cadastro liberado para esta conta. Nenhuma cobrança será gerada nesta etapa.</p>
            <form onSubmit={cadastrar}>
              <fieldset disabled={salvando}>
                <label>Nome da transportadora<input name="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={160} autoComplete="organization" /></label>
                <label>Identificador da empresa<input name="slug" value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} required pattern="[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?" maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="identificador-ajuda" /></label>
                <p id="identificador-ajuda" className="onboarding-help">Escolha um identificador, como minha-transportadora. Use letras minúsculas, números ou hífen.</p>
                <label>CNPJ<input name="cnpj" value={cnpj} onChange={e => setCnpj(e.target.value)} required maxLength={18} autoCapitalize="characters" spellCheck={false} /></label>
                <button type="submit" className="onboarding-button">{salvando ? "Cadastrando…" : "Cadastrar transportadora"}</button>
              </fieldset>
            </form>
          </> : <div className="onboarding-assisted"><h2>Vamos preparar sua entrada.</h2><p>Para cadastrar sua transportadora e confirmar as condições de contratação, fale com a equipe. Se você trabalha em uma empresa que já usa o TMS, peça o acesso a quem a administra.</p><a className="onboarding-button" href="https://avilaops.com/contato/">Falar com a equipe</a></div>}
          {dados.empresas.length > 0 && <p className="onboarding-help">Sua conta já tem acesso a {dados.empresas.length} {dados.empresas.length === 1 ? "empresa" : "empresas"}. Você pode escolher onde entrar.</p>}
        </>}
        <nav className="onboarding-footer" aria-label="Opções da conta"><a href="/empresa">Escolher empresa</a><button type="button" onClick={() => void sair()}>Sair da conta</button></nav>
      </section>
      <p className="onboarding-legal">Seus acessos seguem as permissões da sua transportadora. <a href="/privacidade">Privacidade</a></p>
    </div>
  </main>;
}
