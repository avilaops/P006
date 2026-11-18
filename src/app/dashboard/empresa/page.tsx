"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Copy, ImagePlus, KeyRound, Loader2, LogIn, ShieldAlert, Trash2, Truck } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IDENTIDADE_ALTERADA, LADO_DO_SIMBOLO, TAMANHO_MAXIMO_DO_SIMBOLO, type Identidade, type PixDaEmpresa } from "@/lib/empresa";
import type { ParametrosDeCobranca } from "@/lib/cobranca";
import { AVISO_PIX_ESTATICO, LIMITE_DA_CIDADE, LIMITE_DO_NOME, TIPOS_DE_CHAVE, TIPO_DE_CHAVE_LABEL, type TipoDeChave } from "@/lib/pix";
import { GATEWAY_INDISPONIVEL, type GatewayDaEmpresa } from "@/lib/cobranca-gateway";
import { deniedReason, type DeniedReason } from "../financeiro/carregar";
import { Entrega } from "./entrega";
import { Fiscal } from "./fiscal";

/**
 * Identidade da empresa (o nome e o símbolo que aparecem no cabeçalho do
 * painel), os parâmetros de cobrança, a integração e o fiscal (emitente de CT-e
 * e certificado A1, em ./fiscal.tsx). Só o administrador altera.
 */

type Carga = { denied: DeniedReason } | { denied: null; erro: string } | { denied: null; erro: null };

const FALHA = "Não foi possível carregar os dados da empresa.";
const FALHA_AO_SALVAR = "Não foi possível salvar.";
const IMAGEM_INVALIDA = "Não foi possível ler essa imagem. Use um arquivo PNG ou JPEG.";

const CARD = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm";
const INPUT =
  "block w-full min-w-0 px-3 py-2 md:py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
const LABEL = "text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300";

/**
 * Reduz a imagem escolhida para um quadrado pequeno, no próprio aparelho: foto
 * de celular tem vários megabytes, e o símbolo aparece com 40 pixels.
 */
async function reduzir(arquivo: File): Promise<string> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_DO_SIMBOLO / Math.max(imagem.width, imagem.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(imagem.width * escala));
  tela.height = Math.max(1, Math.round(imagem.height * escala));
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("sem canvas");
  contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
  // PNG mantém o fundo transparente do logotipo.
  return tela.toDataURL("image/png");
}

export default function EmpresaPage() {
  const [carga, setCarga] = useState<Carga | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  // Uma área por vez evita a página interminável, no celular e no computador.
  const [aba, setAba] = useState<"identidade" | "cobranca" | "integracao" | "email" | "fiscal">("identidade");
  const [parteDaCobranca, setParteDaCobranca] = useState<"encargos" | "mercado-pago">("encargos");

  useEffect(() => {
    let ativo = true;
    fetch("/api/empresa")
      .then(async (res) => {
        if (!ativo) return;
        const denied = deniedReason(res.status);
        if (denied) return setCarga({ denied });
        const corpo = (await res.json().catch(() => null)) as (Identidade & { error?: string }) | null;
        if (!res.ok || !corpo) return setCarga({ denied: null, erro: corpo?.error ?? FALHA });
        setName(corpo.name);
        setLogo(corpo.logo);
        setCarga({ denied: null, erro: null });
      })
      .catch(() => {
        if (ativo) setCarga({ denied: null, erro: FALHA });
      });
    return () => {
      ativo = false;
    };
  }, []);

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const escolhido = e.target.files?.[0];
    // Limpa o campo: escolher o mesmo arquivo de novo precisa disparar a troca.
    e.target.value = "";
    if (!escolhido) return;
    setMensagem(null);
    try {
      const reduzida = await reduzir(escolhido);
      if (reduzida.length > TAMANHO_MAXIMO_DO_SIMBOLO) {
        return setMensagem({ ok: false, texto: "Imagem muito grande. Use uma imagem menor." });
      }
      setLogo(reduzida);
    } catch {
      setMensagem({ ok: false, texto: IMAGEM_INVALIDA });
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo }),
      });
      const corpo = (await res.json().catch(() => null)) as (Identidade & { error?: string }) | null;
      if (!res.ok || !corpo) {
        setMensagem({ ok: false, texto: corpo?.error ?? FALHA_AO_SALVAR });
        return;
      }
      setName(corpo.name);
      setLogo(corpo.logo);
      setMensagem({ ok: true, texto: "Empresa atualizada." });
      window.dispatchEvent(new Event(IDENTIDADE_ALTERADA));
    } catch {
      setMensagem({ ok: false, texto: FALHA_AO_SALVAR });
    } finally {
      setSalvando(false);
    }
  };

  if (!carga) {
    return (
      <div className="flex items-center justify-center h-[300px]" role="status" aria-label="Carregando">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (carga.denied === "login") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-blue-600" />
            Sessão expirada
          </CardTitle>
          <CardDescription>
            Entre de novo para ver os dados da empresa.{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Ir para o login
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (carga.denied !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Acesso negado
          </CardTitle>
          <CardDescription>Seu perfil não tem acesso a esta área.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (carga.erro !== null) {
    return (
      <div role="alert" className="px-4 py-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
        {carga.erro}
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-gray-900 dark:text-white">Empresa</h1>
        <p className="mt-1 text-sm text-gray-500">Configurações da transportadora, cobrança, conexões e emissão fiscal.</p>
      </div>

      <div role="tablist" aria-label="Parte" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 md:grid-cols-5 md:max-w-3xl">
        {(
          [
            ["identidade", "Identidade"],
            ["cobranca", "Cobrança"],
            ["integracao", "Integração"],
            ["email", "E-mail"],
            ["fiscal", "Fiscal"],
          ] as const
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            data-aba={chave}
            onClick={() => setAba(chave)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:text-sm ${aba === chave ? "bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className={`${aba === "identidade" ? "grid" : "hidden"} gap-4 lg:grid-cols-2 lg:items-start`}>
      <form aria-label="Identidade da empresa" onSubmit={salvar} className={`${CARD} p-4 md:p-6 space-y-4`}>
        <label className="block space-y-1">
          <span className={LABEL}>Nome da empresa</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </label>

        <div className="space-y-1">
          <span className={LABEL}>Símbolo</span>
          <div className="flex items-center gap-3">
            {logo ? (
              <Image src={logo} alt="Símbolo atual" width={56} height={56} unoptimized className="w-14 h-14 rounded-xl object-contain bg-white border border-gray-200 dark:border-gray-700" />
            ) : (
              <div data-simbolo-padrao className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
                <Truck className="w-7 h-7 text-white" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => arquivo.current?.click()}
                className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
              >
                <ImagePlus className="w-4 h-4" />
                Escolher imagem
              </button>
              {logo && (
                <button type="button" onClick={() => setLogo(null)} className="px-3 py-2 text-sm rounded-xl text-red-600 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              )}
            </div>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" onChange={escolher} className="hidden" aria-label="Arquivo do símbolo" />
          </div>
          <p className="text-xs text-gray-500">PNG, JPEG ou WebP. A imagem é reduzida antes de enviar. Sem símbolo, aparece o caminhão.</p>
        </div>

        {mensagem && (
          <p role={mensagem.ok ? "status" : "alert"} className={`text-sm ${mensagem.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {mensagem.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="px-4 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 flex items-center gap-2"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar
        </button>
      </form>

      {/* Perfil do comprovante de entrega: fica na aba Identidade, sem aba própria. */}
      <Entrega escondida={false} />
      </div>

      {/* No celular a aba Cobrança tem duas partes, para cada uma caber na tela. */}
      {aba === "cobranca" && (
        <div role="tablist" aria-label="Parte da cobrança" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 md:max-w-md">
          {(
            [
              ["encargos", "Encargos e Pix"],
              ["mercado-pago", "Mercado Pago"],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={parteDaCobranca === chave}
              data-parte={chave}
              onClick={() => setParteDaCobranca(chave)}
              className={`py-1 rounded-lg text-xs font-semibold ${parteDaCobranca === chave ? "bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-sm" : "text-gray-600 dark:text-gray-300"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      <Cobranca escondida={aba !== "cobranca" || parteDaCobranca !== "encargos"} />

      <MercadoPago escondida={aba !== "cobranca" || parteDaCobranca !== "mercado-pago"} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Integracao escondida={aba !== "integracao"} />
        <IntegracaoLojas escondida={aba !== "integracao"} />
      </div>

      <EmailDocumentos escondida={aba !== "email"} />

      <Fiscal escondida={aba !== "fiscal"} />
    </div>
  );
}

type EstadoLojas = {
  configurado: boolean;
  final: string | null;
  rotacionadaEm: string | null;
  ordens: { externalId: string; mode: string; state: string; direction: string; rma: string | null; createdAt: string }[];
};

function IntegracaoLojas({ escondida }: { escondida: boolean }) {
  const [estado, setEstado] = useState<EstadoLojas | null>(null);
  const [chave, setChave] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const ler = () => fetch("/api/empresa/integracoes/lojas")
    .then((res) => res.ok ? res.json() : null)
    .then((corpo: EstadoLojas | null) => corpo && setEstado(corpo))
    .catch(() => {
      // A seção fica indisponível sem derrubar as demais configurações da empresa.
    });
  useEffect(() => { void ler(); }, []);

  const rotacionar = async () => {
    if (estado === null) return;
    if (estado?.configurado && !window.confirm("Trocar a chave desativa imediatamente a chave atual. Deseja continuar?")) return;
    setOcupado(true); setErro(null); setChave(null); setCopiada(false);
    try {
      const res = await fetch("/api/empresa/integracoes/lojas", { method: "POST" });
      const corpo = await res.json() as EstadoLojas & { chave?: string; error?: string };
      if (!res.ok || !corpo.chave) return setErro(corpo.error ?? FALHA_AO_SALVAR);
      setChave(corpo.chave); await ler();
    } catch { setErro(FALHA_AO_SALVAR); } finally { setOcupado(false); }
  };

  const copiarChave = async () => {
    if (!chave) return;
    try {
      await navigator.clipboard.writeText(chave);
      setCopiada(true);
    } catch {
      setErro("Não foi possível copiar. Selecione a chave e copie manualmente.");
    }
  };

  const rotacionadaEm = estado?.rotacionadaEm
    ? new Date(estado.rotacionadaEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : null;

  return (
    <section aria-label="Integração Lojas" className={`${escondida ? "hidden " : ""}${CARD} space-y-4 p-4 md:p-6`}>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Integração Lojas</h2>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Cotações, pedidos multi-origem, rastreio e logística reversa por empresa.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {estado?.configurado ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{estado === null ? "Carregando configuração" : estado.configurado ? "Ativa" : "Não configurada"}</p>
            <p className="text-xs text-gray-500">
              {estado?.configurado ? `Chave •••• ${estado.final}${rotacionadaEm ? ` · criada em ${rotacionadaEm}` : ""}` : estado === null ? "Aguarde a consulta antes de gerar uma chave." : "A chave completa aparece uma única vez."}
            </p>
          </div>
        </div>
        <button type="button" disabled={ocupado || estado === null} onClick={() => void rotacionar()} className="shrink-0 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
          {estado === null ? "Carregando chave" : estado.configurado ? "Trocar chave" : "Criar chave"}
        </button>
      </div>
      {chave && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Copie agora. Ela não será mostrada novamente.</p><code className="mt-1 block break-all text-xs text-amber-950">{chave}</code><button type="button" onClick={() => void copiarChave()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-950"><Copy className="h-3.5 w-3.5" />{copiada ? "Chave copiada" : "Copiar chave"}</button></div>}
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pedidos recentes</h3>
        {!estado?.ordens.length ? <p className="mt-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">Nenhum pedido recebido ainda. Crie a chave e envie um pedido de teste.</p> : <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">{estado.ordens.map((ordem) => <div key={ordem.externalId} className="py-2 flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><p className="font-medium truncate">{ordem.externalId}</p><p className="text-xs text-gray-500">{ordem.direction === "REVERSE" ? `Reversa • RMA ${ordem.rma}` : ordem.mode}</p></div><span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs">{ordem.state}</span></div>)}</div>}
      </div>
    </section>
  );
}

/** O que a rota de cobrança devolve: os percentuais e, se cadastrado, o Pix. */
type CobrancaDaEmpresa = ParametrosDeCobranca & { pix?: PixDaEmpresa | null };

const SEM_PIX = { tipo: "CNPJ" as TipoDeChave, chave: "", nome: "", cidade: "" };

const EXEMPLO_DE_CHAVE: Record<TipoDeChave, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0000-00",
  EMAIL: "financeiro@suaempresa.com.br",
  TELEFONE: "(17) 99999-0000",
  ALEATORIA: "123e4567-e89b-12d3-a456-426614174000",
};

/**
 * Parâmetros de cobrança: a multa e os juros que a baixa de um título vencido
 * sugere (Financeiro e Faturamento) e o recebimento por Pix. Os encargos são
 * só a sugestão: na baixa o operador altera ou apaga os valores. Com a chave
 * Pix cadastrada, a fatura e o aviso de cobrança saem com o Pix Copia e Cola.
 */
function Cobranca({ escondida }: { escondida: boolean }) {
  const [multaPct, setMultaPct] = useState("");
  const [jurosPct, setJurosPct] = useState("");
  const [pix, setPix] = useState(SEM_PIX);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const mostrar = (corpo: CobrancaDaEmpresa) => {
    setMultaPct(String(corpo.multaPct).replace(".", ","));
    setJurosPct(String(corpo.jurosPct).replace(".", ","));
    setPix(corpo.pix ?? SEM_PIX);
  };

  const campoDoPix = (nome: keyof typeof SEM_PIX) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPix((atual) => ({ ...atual, [nome]: e.target.value }));

  useEffect(() => {
    let ativo = true;
    fetch("/api/empresa/cobranca")
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo: CobrancaDaEmpresa | null) => {
        if (ativo && corpo) mostrar(corpo);
      })
      .catch(() => {
        // Sem a leitura os campos ficam em branco e salvar pede os dois.
      });
    return () => {
      ativo = false;
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/empresa/cobranca", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Chave em branco remove o Pix; preenchida, vai com o recebedor.
        body: JSON.stringify({ multaPct, jurosPct, pix: pix.chave.trim() === "" ? null : pix }),
      });
      const corpo = (await res.json().catch(() => null)) as (CobrancaDaEmpresa & { error?: string }) | null;
      if (!res.ok || !corpo) return setMensagem({ ok: false, texto: corpo?.error ?? FALHA_AO_SALVAR });
      mostrar(corpo);
      setMensagem({ ok: true, texto: "Cobrança atualizada." });
    } catch {
      setMensagem({ ok: false, texto: FALHA_AO_SALVAR });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form onSubmit={salvar} aria-label="Cobrança" className={`${escondida ? "hidden " : ""}${CARD} p-3 md:p-6 space-y-3`}>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Cobrança</h2>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
          Multa e juros sugeridos na baixa de um título vencido. Os juros são proporcionais aos dias de atraso.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-4">
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Multa (%)</span>
          <input required inputMode="decimal" data-campo="multaPct" value={multaPct} onChange={(e) => setMultaPct(e.target.value)} className={INPUT} />
        </label>
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Juros ao mês (%)</span>
          <input required inputMode="decimal" data-campo="jurosPct" value={jurosPct} onChange={(e) => setJurosPct(e.target.value)} className={INPUT} />
        </label>
      </div>

      <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
        <h3 className="pt-2 text-sm font-semibold text-gray-900 dark:text-white">Recebimento por Pix</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Com a chave cadastrada, a fatura e o aviso de cobrança saem com o Pix Copia e Cola. Chave em branco desliga.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-4">
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Tipo da chave</span>
          <select data-campo="pixTipo" value={pix.tipo} onChange={campoDoPix("tipo")} className={INPUT}>
            {TIPOS_DE_CHAVE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_DE_CHAVE_LABEL[tipo]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Chave Pix</span>
          <input data-campo="pixChave" maxLength={120} placeholder={EXEMPLO_DE_CHAVE[pix.tipo]} value={pix.chave} onChange={campoDoPix("chave")} className={INPUT} />
        </label>
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Nome do recebedor</span>
          <input data-campo="pixNome" maxLength={LIMITE_DO_NOME} required={pix.chave.trim() !== ""} value={pix.nome} onChange={campoDoPix("nome")} className={INPUT} />
        </label>
        <label className="block space-y-1 min-w-0">
          <span className={LABEL}>Cidade</span>
          <input data-campo="pixCidade" maxLength={LIMITE_DA_CIDADE} required={pix.chave.trim() !== ""} value={pix.cidade} onChange={campoDoPix("cidade")} className={INPUT} />
        </label>
      </div>
      <p className="text-xs text-gray-500">{AVISO_PIX_ESTATICO}</p>

      {mensagem && (
        <p role={mensagem.ok ? "status" : "alert"} className={`text-sm ${mensagem.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {mensagem.texto}
        </p>
      )}

      <button type="submit" disabled={ocupado} className="px-4 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 flex items-center gap-2">
        {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar
      </button>
    </form>
  );
}

/**
 * A conta do Mercado Pago da empresa: com ela ligada, a fatura ganha "Gerar
 * Pix" e "Gerar boleto", e o pagamento dá baixa sozinho. O Access Token e a
 * assinatura secreta entram por aqui e não voltam: a tela só mostra que estão
 * configurados e os 4 últimos caracteres.
 */
function MercadoPago({ escondida }: { escondida: boolean }) {
  const [gateway, setGateway] = useState<GatewayDaEmpresa | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/empresa/gateway")
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo: GatewayDaEmpresa | null) => {
        if (ativo && corpo) setGateway(corpo);
      })
      .catch(() => {
        // Sem a leitura a seção não aparece.
      });
    return () => {
      ativo = false;
    };
  }, []);

  const chamar = async (caminho: string, method: string, corpo: unknown, sucesso: (resposta: GatewayDaEmpresa & { conta?: string }) => string) => {
    setOcupado(true);
    setMensagem(null);
    try {
      const res = await fetch(caminho, { method, headers: { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
      const resposta = (await res.json().catch(() => null)) as (GatewayDaEmpresa & { conta?: string; error?: string }) | null;
      if (!res.ok || !resposta) return setMensagem({ ok: false, texto: resposta?.error ?? FALHA_AO_SALVAR });
      if (typeof resposta.configurado === "boolean") setGateway(resposta);
      // As credenciais saem da tela assim que são guardadas.
      setAccessToken("");
      setWebhookSecret("");
      setMensagem({ ok: true, texto: sucesso(resposta) });
    } catch {
      setMensagem({ ok: false, texto: FALHA_AO_SALVAR });
    } finally {
      setOcupado(false);
    }
  };

  if (!gateway) return null;

  return (
    <section aria-label="Mercado Pago" className={`${escondida ? "hidden " : ""}${CARD} p-3 md:p-6 space-y-3`}>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Mercado Pago</h2>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
          Pix com QR Code e boleto gerados na fatura, com baixa automática quando o Mercado Pago avisa o pagamento.
        </p>
      </div>

      {!gateway.disponivel ? (
        <p data-gateway-indisponivel className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {GATEWAY_INDISPONIVEL}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void chamar("/api/empresa/gateway", "PUT", { accessToken, webhookSecret }, () => "Conta do Mercado Pago ligada. Use Testar conexão para conferir.");
          }}
          className="space-y-2"
        >
          {gateway.configurado && (
            <p data-gateway-configurado className="text-sm text-green-700 dark:text-green-400">
              Configurado: Access Token final {gateway.accessTokenFinal}, assinatura final {gateway.webhookSecretFinal}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-4">
            <label className="block space-y-1 min-w-0">
              <span className={LABEL}>Access Token</span>
              <input required type="password" autoComplete="off" data-campo="accessToken" placeholder="APP_USR-…" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={INPUT} />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className={LABEL}>Assinatura secreta</span>
              <input required type="password" autoComplete="off" data-campo="webhookSecret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className={INPUT} />
            </label>
          </div>
          <div className="space-y-1">
            <span className={LABEL}>Endereço de webhook (cadastre no painel do Mercado Pago, evento Pagamentos)</span>
            <code data-webhook className="block break-all font-mono text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200">{gateway.webhook}</code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {gateway.configurado ? "Trocar credenciais" : "Ligar conta"}
            </button>
            {gateway.configurado && (
              <>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void chamar("/api/empresa/gateway/teste", "POST", undefined, (resposta) => `Conexão certa: conta ${resposta.conta ?? ""}.`)}
                  className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60"
                >
                  Testar conexão
                </button>
                <button type="button" disabled={ocupado} onClick={() => void chamar("/api/empresa/gateway", "DELETE", undefined, () => "Conta do Mercado Pago desligada.")} className="px-3 py-2 text-sm rounded-xl text-red-600 disabled:opacity-60">
                  Desligar
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {mensagem && (
        <p role={mensagem.ok ? "status" : "alert"} className={`text-sm ${mensagem.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {mensagem.texto}
        </p>
      )}
    </section>
  );
}

type Entrega = { id: string; type: string; createdAt: string; deliveredAt: string | null; attempts: number; lastError: string | null };
type Webhook = { url: string | null; entregas: Entrega[] };

const TIPO: Record<string, string> = {
  "coleta.status": "Status de carga",
  "fatura.emitida": "Fatura emitida",
  "fatura.paga": "Fatura paga",
  "fatura.reaberta": "Fatura reaberta",
  "fatura.cancelada": "Fatura cancelada",
  "cobranca.vencida": "Título vencido",
  "ocorrencia.aberta": "Chamado aberto",
  "ocorrencia.status": "Status de chamado",
  "cte.autorizado": "CT-e autorizado",
  "cte.cancelado": "CT-e cancelado",
  "mdfe.autorizado": "MDF-e autorizado",
  "mdfe.encerrado": "MDF-e encerrado",
  "mdfe.cancelado": "MDF-e cancelado",
  teste: "Teste",
};

const DOCUMENTO_EMAIL: Record<string, string> = {
  comprovantePdf: "Comprovante", cteXml: "XML do CT-e", dactePdf: "DACTE",
  boletoPdf: "Boleto/link", faturaPdf: "Fatura", vencimento: "Cobrança vencida",
};

type EmailDelivery = { id: string; documentType: string; recipientEmail: string; status: string; attempts: number; errorMessage: string | null; createdAt: string; sentAt: string | null };
type EmailSettings = {
  mode: "TMS" | "PROPRIO"; enabled: boolean; fromName: string; fromEmail: string;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUsername: string;
  passwordConfigured: boolean; centralAvailable: boolean; encryptionAvailable: boolean;
  entregas: EmailDelivery[];
};

const EMAIL_VAZIO: EmailSettings = {
  mode: "TMS", enabled: false, fromName: "", fromEmail: "", smtpHost: "", smtpPort: 587,
  smtpSecure: false, smtpUsername: "", passwordConfigured: false, centralAvailable: false,
  encryptionAvailable: false, entregas: [],
};

function EmailDocumentos({ escondida }: { escondida: boolean }) {
  const [config, setConfig] = useState<EmailSettings>(EMAIL_VAZIO);
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const ler = async () => {
    const response = await fetch("/api/empresa/email");
    if (!response.ok) throw new Error("Não foi possível carregar a configuração de e-mail.");
    setConfig((await response.json()) as EmailSettings);
  };
  useEffect(() => {
    let ativo = true;
    void fetch("/api/empresa/email").then(async (response) => {
      if (!response.ok) throw new Error();
      const body = (await response.json()) as EmailSettings;
      if (ativo) setConfig(body);
    }).catch(() => { if (ativo) setMensagem({ ok: false, texto: "Não foi possível carregar a configuração de e-mail." }); });
    return () => { ativo = false; };
  }, []);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault(); setOcupado(true); setMensagem(null);
    try {
      const response = await fetch("/api/empresa/email", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: config.mode, enabled: config.enabled, fromName: config.fromName.trim() || null,
          fromEmail: config.fromEmail.trim() || null, smtpHost: config.smtpHost.trim() || null,
          smtpPort: config.mode === "PROPRIO" ? Number(config.smtpPort) : null,
          smtpSecure: config.smtpSecure, smtpUsername: config.smtpUsername.trim() || null,
          ...(senha ? { smtpPassword: senha } : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Não foi possível salvar a configuração.");
      setSenha(""); setMensagem({ ok: true, texto: "Configuração de e-mail salva." }); await ler();
    } catch (error) {
      setMensagem({ ok: false, texto: error instanceof Error ? error.message : "Não foi possível salvar a configuração." });
    } finally { setOcupado(false); }
  };

  const testar = async () => {
    setOcupado(true); setMensagem(null);
    try {
      const response = await fetch("/api/empresa/email/teste", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Falha no teste SMTP.");
      setMensagem({ ok: true, texto: `O servidor SMTP aceitou o teste para ${body.to}.` });
      await ler();
    } catch (error) { setMensagem({ ok: false, texto: error instanceof Error ? error.message : "Falha no teste SMTP." }); }
    finally { setOcupado(false); }
  };

  const tentarNovamente = async (id: string) => {
    setOcupado(true); setMensagem(null);
    try {
      const response = await fetch(`/api/empresa/email/${id}/reenviar`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Não foi possível colocar o e-mail na fila.");
      setMensagem({ ok: true, texto: "Envio colocado novamente na fila." }); await ler();
    } catch (error) { setMensagem({ ok: false, texto: error instanceof Error ? error.message : "Falha ao reenviar." }); }
    finally { setOcupado(false); }
  };

  const campo = (key: "fromName" | "fromEmail" | "smtpHost" | "smtpUsername") => (event: React.ChangeEvent<HTMLInputElement>) => setConfig((old) => ({ ...old, [key]: event.target.value }));

  return <section aria-label="Envios de documentos por e-mail" className={`${escondida ? "hidden " : ""}${CARD} p-4 md:p-6 space-y-4`}>
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Envios documentais por e-mail</h2>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${config.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{config.enabled ? "Ativo" : "Desativado"}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">Envie comprovantes aprovados, CT-e autorizado, faturas e avisos de vencimento para os contatos configurados no cadastro de cada cliente.</p>
    </div>

    <form onSubmit={(event) => void salvar(event)} className="space-y-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig((old) => ({ ...old, enabled: event.target.checked }))} /> Ativar envios automáticos</label>
      <label className="block space-y-1"><span className={LABEL}>Serviço de envio</span>
        <select className={INPUT} value={config.mode} onChange={(event) => setConfig((old) => ({ ...old, mode: event.target.value as EmailSettings["mode"] }))}>
          <option value="TMS">Serviço central do TMS {config.centralAvailable ? "• disponível" : "• ainda não provisionado"}</option>
          <option value="PROPRIO">Usar meu servidor SMTP</option>
        </select>
      </label>
      {config.mode === "TMS" ? <p className="text-xs text-gray-500">O serviço central só pode ser ativado quando o SMTP remetente da Ávila Ops estiver provisionado.</p> : <>
        {!config.encryptionAvailable && <p role="alert" className="text-sm text-amber-700">O servidor precisa de TMS_CHAVE_DE_DADOS para guardar a senha SMTP cifrada.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1"><span className={LABEL}>Servidor SMTP</span><input required maxLength={253} placeholder="smtp.suaempresa.com.br" value={config.smtpHost} onChange={campo("smtpHost")} className={INPUT} /></label>
          <label className="block space-y-1"><span className={LABEL}>Porta</span><input required type="number" min={1} max={65535} value={config.smtpPort} onChange={(event) => setConfig((old) => ({ ...old, smtpPort: Number(event.target.value) }))} className={INPUT} /></label>
          <label className="block space-y-1"><span className={LABEL}>Usuário SMTP</span><input required autoComplete="username" value={config.smtpUsername} onChange={campo("smtpUsername")} className={INPUT} /></label>
          <label className="block space-y-1"><span className={LABEL}>Senha SMTP</span><input type="password" autoComplete="new-password" placeholder={config.passwordConfigured ? "Senha salva • deixe vazio para manter" : "Senha SMTP"} value={senha} onChange={(event) => setSenha(event.target.value)} className={INPUT} /></label>
          <label className="block space-y-1"><span className={LABEL}>Nome do remetente</span><input maxLength={120} value={config.fromName} onChange={campo("fromName")} className={INPUT} /></label>
          <label className="block space-y-1"><span className={LABEL}>E-mail do remetente</span><input required type="email" value={config.fromEmail} onChange={campo("fromEmail")} className={INPUT} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.smtpSecure} onChange={(event) => setConfig((old) => ({ ...old, smtpSecure: event.target.checked }))} /> Conexão TLS direta • normalmente porta 465; desmarcado exige STARTTLS</label>
      </>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">{ocupado ? "Salvando…" : "Salvar configuração"}</button>
        <button type="button" disabled={ocupado || !config.enabled} onClick={() => void testar()} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm disabled:opacity-50">Enviar teste para meu e-mail de acesso</button>
      </div>
    </form>
    {mensagem && <p role={mensagem.ok ? "status" : "alert"} className={`text-sm ${mensagem.ok ? "text-green-700" : "text-red-600"}`}>{mensagem.texto}</p>}
      <p className="text-xs text-gray-500">O comprovante inclui as fotos e link do portal. CT-e envia o XML e tenta gerar o DACTE. Fatura e cobrança levam resumo e links; hoje não há PDF próprio de fatura nem anexo PDF do boleto. O teste confirma o aceite SMTP, não a entrega ou leitura. Os destinatários são escolhidos no cadastro de cada cliente.</p>
    {config.entregas.length > 0 && <div className="space-y-2"><div className="flex items-center justify-between"><h3 className={LABEL}>Envios recentes</h3><button type="button" onClick={() => void ler().catch(() => undefined)} className="text-xs text-blue-600">Atualizar</button></div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">{config.entregas.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0"><strong>{DOCUMENTO_EMAIL[item.documentType] ?? item.documentType}</strong> • {item.recipientEmail}<small className="block text-xs text-gray-500">{item.status === "SENT" ? "Aceito pelo SMTP" : item.status === "FAILED" ? item.errorMessage || "Falhou" : item.status === "QUEUED" ? "Enviando" : "Na fila"} • {new Date(item.createdAt).toLocaleString("pt-BR")}</small></span>{item.status === "FAILED" && <button type="button" disabled={ocupado || !config.enabled} onClick={() => void tentarNovamente(item.id)} className="text-xs text-blue-600 disabled:opacity-50">Tentar de novo</button>}</li>)}</ul>
    </div>}
  </section>;
}

const quando = (instante: string) =>
  new Date(instante).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function situacao(entrega: Entrega): { texto: string; classe: string } {
  if (entrega.deliveredAt) return { texto: "Entregue", classe: "text-green-700 dark:text-green-400" };
  if (entrega.attempts === 0) return { texto: "Na fila", classe: "text-gray-500" };
  return { texto: entrega.lastError ?? "Falhou", classe: "text-red-600 dark:text-red-400" };
}

/**
 * Endereço que recebe os eventos da empresa (um fluxo do n8n, por exemplo). A
 * cada troca de status de carga o TMS manda um aviso assinado para lá.
 */
function Integracao({ escondida }: { escondida: boolean }) {
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [url, setUrl] = useState("");
  const [segredo, setSegredo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const ler = () =>
    fetch("/api/empresa/webhook")
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo: Webhook | null) => {
        if (!corpo) return;
        setWebhook(corpo);
        setUrl(corpo.url ?? "");
      })
      .catch(() => {
        // Sem a leitura a seção fica só com o campo vazio.
      });

  useEffect(() => {
    void ler();
  }, []);

  const gravar = async (corpo: { url: string | null; novoSegredo?: boolean }, sucesso: string) => {
    setOcupado(true);
    setMensagem(null);
    setSegredo(null);
    try {
      const res = await fetch("/api/empresa/webhook", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const resposta = (await res.json().catch(() => null)) as { url?: string | null; segredo?: string; error?: string } | null;
      if (!res.ok || !resposta) return setMensagem({ ok: false, texto: resposta?.error ?? FALHA_AO_SALVAR });
      if (resposta.segredo) setSegredo(resposta.segredo);
      setMensagem({ ok: true, texto: sucesso });
      await ler();
    } catch {
      setMensagem({ ok: false, texto: FALHA_AO_SALVAR });
    } finally {
      setOcupado(false);
    }
  };

  const testar = async () => {
    setOcupado(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/empresa/webhook/teste", { method: "POST" });
      const resposta = (await res.json().catch(() => null)) as { error?: string } | null;
      setMensagem(res.ok ? { ok: true, texto: "Teste na fila. Ele sai em até 15 segundos; atualize para ver o resultado." } : { ok: false, texto: resposta?.error ?? "Não foi possível enviar o teste." });
      await ler();
    } catch {
      setMensagem({ ok: false, texto: "Não foi possível enviar o teste." });
    } finally {
      setOcupado(false);
    }
  };

  const cadastrado = Boolean(webhook?.url);

  return (
    <section aria-label="Avisos automáticos" className={`${escondida ? "hidden " : ""}${CARD} p-4 md:p-6 space-y-3`}>
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Avisos automáticos</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cadastrado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{cadastrado ? "Ativo" : "Não configurado"}</span>
        </div>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
          O TMS avisa este endereço (um fluxo do n8n, por exemplo) a cada troca de status de carga, fatura emitida, paga ou cancelada, e título que venceu.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void gravar({ url: url.trim() }, cadastrado ? "Endereço atualizado." : "Endereço cadastrado.");
        }}
        className="space-y-2"
      >
        <label className="block space-y-1">
          <span className={LABEL}>Endereço que recebe os avisos</span>
          <input type="url" required placeholder="https://n8n.suaempresa.com/webhook/tms" value={url} onChange={(e) => setUrl(e.target.value)} className={INPUT} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={ocupado} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">
            {cadastrado ? "Salvar endereço" : "Cadastrar"}
          </button>
          {cadastrado && (
            <>
              <button type="button" disabled={ocupado} onClick={() => void testar()} className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60">
                Enviar teste
              </button>
              <button type="button" disabled={ocupado} onClick={() => void gravar({ url: url.trim(), novoSegredo: true }, "Segredo trocado.")} className="px-3 py-2 text-sm rounded-xl text-gray-600 dark:text-gray-300 disabled:opacity-60">
                Trocar segredo
              </button>
              <button type="button" disabled={ocupado} onClick={() => void gravar({ url: null }, "Integração removida.")} className="px-3 py-2 text-sm rounded-xl text-red-600 disabled:opacity-60">
                Remover
              </button>
            </>
          )}
        </div>
      </form>

      {segredo && (
        <div data-segredo className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900 space-y-1">
          <p className="font-medium">Guarde este segredo agora: ele não aparece de novo.</p>
          <code className="block break-all font-mono text-xs">{segredo}</code>
          <p className="text-xs">É com ele que o destino confere a assinatura do cabeçalho X-TMS-Assinatura.</p>
        </div>
      )}

      {mensagem && (
        <p role={mensagem.ok ? "status" : "alert"} className={`text-sm ${mensagem.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {mensagem.texto}
        </p>
      )}

      {webhook && webhook.entregas.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className={LABEL}>Últimos avisos</h3>
            <button type="button" onClick={() => void ler()} className="text-xs text-blue-600 hover:underline">
              Atualizar
            </button>
          </div>
          <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            {webhook.entregas.map((entrega) => {
              const estado = situacao(entrega);
              return (
                <li key={entrega.id} data-entrega={entrega.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-gray-700 dark:text-gray-300">
                    {TIPO[entrega.type] ?? entrega.type} <span className="text-xs text-gray-500">· {quando(entrega.createdAt)}</span>
                  </span>
                  <span className={`text-xs text-right ${estado.classe}`}>{estado.texto}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
