"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Archive, ArrowLeft, Check, CircleDashed, LoaderCircle, MessageCircle, Paperclip, RefreshCw, Send, Settings2, Truck } from "lucide-react";

type Conversation = { id: string; phone: string; contactName: string | null; status: string; unreadCount: number; lastMessageAt: string | null; lastMessageText: string | null };
type Message = { id: string; direction: string; type: string; body: string | null; status: string; mediaKey: string | null; mediaMimeType: string | null; mediaFileName: string | null; mediaSize: number | null; sentAt: string };
type Detail = { id: string; phone: string; contactName: string | null; status: string; messages: Message[] };
type Connection = { configured: boolean; canManage: boolean; status: string; phone: string | null; historyPage: number; historyImported: number; historyComplete: boolean; error?: string };

const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

export default function WhatsAppInboxPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showQuote, setShowQuote] = useState(false);

  const refresh = useCallback(async () => {
    const [listResponse, connectionResponse] = await Promise.all([
      fetch(`/api/dashboard/whatsapp/conversations?q=${encodeURIComponent(search)}`, { cache: "no-store" }),
      fetch("/api/empresa/whatsapp", { cache: "no-store" }),
    ]);
    if (listResponse.ok) setItems(await listResponse.json());
    if (connectionResponse.ok) setConnection(await connectionResponse.json());
    setLoading(false);
  }, [search]);

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/dashboard/whatsapp/conversations/${id}`, { cache: "no-store" });
    if (response.ok) setDetail(await response.json());
  }, []);

  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 8000); return () => { window.clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  useEffect(() => { if (!activeId) return; const initial = window.setTimeout(() => void loadDetail(activeId), 0); const timer = setInterval(() => void loadDetail(activeId), 5000); return () => { window.clearTimeout(initial); clearInterval(timer); }; }, [activeId, loadDetail]);

  async function connect() {
    setBusy(true); setNotice(""); setQr(null);
    try {
      const response = await fetch("/api/empresa/whatsapp", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao iniciar conexão.");
      setQr(body.qrCode ?? null);
      setNotice(body.qrCode ? "Leia o QR Code em Aparelhos conectados no WhatsApp." : "A conexão foi iniciada; atualize o estado para consultar o QR Code.");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao conectar."); }
    finally { setBusy(false); }
  }

  async function importHistory() {
    setBusy(true); setNotice("Importando histórico disponível na Evolution…");
    try {
      let complete = false;
      while (!complete) {
        const response = await fetch("/api/empresa/whatsapp/historico", { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Falha ao importar histórico.");
        complete = body.complete;
        setNotice(complete ? `Histórico importado • ${body.imported} mensagens` : `Histórico em importação • página ${body.page} • ${body.imported} mensagens`);
        await refresh();
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao importar histórico."); }
    finally { setBusy(false); }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!activeId || !text.trim()) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/dashboard/whatsapp/conversations/${activeId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao enviar.");
      setText(""); await loadDetail(activeId); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao enviar."); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!activeId || !detail) return;
    const status = detail.status === "ARCHIVED" ? "OPEN" : "ARCHIVED";
    const response = await fetch(`/api/dashboard/whatsapp/conversations/${activeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) { await loadDetail(activeId); await refresh(); }
  }

  async function createQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/dashboard/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        companyName: form.get("companyName"), phone: detail.phone, email: form.get("email"), channel: "WHATSAPP",
        origin: form.get("origin"), destination: form.get("destination"), volumes: form.get("volumes"), weight: form.get("weight"),
        invoiceValue: form.get("invoiceValue") || undefined, whatsappConversationId: detail.id,
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível criar a cotação.");
      setShowQuote(false); setNotice(`Cotação nº ${body.number ?? ""} criada e vinculada à conversa.`); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível criar a cotação."); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-[calc(100dvh-2rem)] p-3 md:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-semibold text-gray-950 dark:text-white">Caixa do WhatsApp</h1><p className="text-sm text-gray-500">Conversas de cotação • histórico sincronizado por empresa</p></div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${connection?.status === "CONNECTED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}><span className="h-2 w-2 rounded-full bg-current" />{connection?.status === "CONNECTED" ? `Conectado${connection.phone ? ` • ${connection.phone}` : ""}` : connection?.status === "CONNECTING" ? "Conectando" : "Desconectado"}</span>
            <Link href="/dashboard/empresa" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"><Settings2 className="h-4 w-4" />Canais</Link>
            {connection?.canManage && connection.status !== "CONNECTED" && <button onClick={() => void connect()} disabled={busy || !connection.configured} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Conectando…" : "Conectar número"}</button>}
            {connection?.canManage && connection.status === "CONNECTED" && !connection.historyComplete && <button onClick={() => void importHistory()} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800">{connection.historyImported ? `Continuar histórico • ${connection.historyImported}` : "Importar histórico"}</button>}
            {connection?.historyComplete && <span className="hidden text-xs text-gray-500 lg:inline">Histórico importado • {connection.historyImported} mensagens</span>}
            <button onClick={() => void refresh()} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </header>
        {notice && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">{notice}</div>}
        {qr && <div className="flex flex-wrap items-center gap-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><Image unoptimized src={qr} alt="QR Code para conectar o WhatsApp" width={208} height={208} className="h-52 w-52 rounded-lg border border-gray-200 bg-white p-2"/><div><h2 className="font-semibold">Conecte o número da transportadora</h2><p className="mt-1 max-w-md text-sm text-gray-500">No WhatsApp • Aparelhos conectados • Conectar aparelho • leia este QR Code.</p><p className="mt-3 text-xs text-gray-500">O código é temporário. Se expirar, gere outro.</p>{connection?.canManage && <button onClick={() => void connect()} disabled={busy} className="mt-4 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800">Atualizar QR Code</button>}</div></div>}
        <section className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[330px_minmax(0,1fr)]">
          <aside className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-gray-200 dark:border-gray-800`}>
            <div className="border-b border-gray-100 p-4 dark:border-gray-800"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Conversas</h2><span className="text-xs text-gray-500">{items.length}</span></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <p className="p-5 text-sm text-gray-500">Carregando…</p> : items.length === 0 ? <div className="p-5 text-sm text-gray-500">Nenhuma conversa ainda. Conecte o WhatsApp para receber cotações.</div> : items.map((item) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`flex w-full gap-3 border-b border-gray-100 p-4 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${activeId === item.id ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{(item.contactName ?? item.phone).slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{item.contactName || item.phone}</span><span className="shrink-0 text-[11px] text-gray-400">{dateLabel(item.lastMessageAt)}</span></span><span className="block truncate text-xs text-gray-500">{item.lastMessageText || "Anexo"}</span><span className="mt-1 block text-[11px] text-gray-400">{item.phone} • {item.status === "ARCHIVED" ? "Arquivada" : item.status === "WAITING" ? "Aguardando" : "Aberta"}</span></span>{item.unreadCount > 0 && <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}</button>)}</div>
          </aside>
          <div className={`${activeId ? "flex" : "hidden md:flex"} min-h-[65vh] min-w-0 flex-col`}>
            {detail ? <>
              <header className="flex items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setActiveId(null)} className="md:hidden" aria-label="Voltar às conversas"><ArrowLeft className="h-5 w-5" /></button><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium dark:bg-slate-800">{(detail.contactName ?? detail.phone).slice(0, 2).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate font-semibold">{detail.contactName || detail.phone}</h2><p className="text-xs text-gray-500">{detail.phone}</p></div></div><div className="flex items-center gap-2"><button onClick={() => setShowQuote(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-gray-700"><Truck className="h-4 w-4" /><span className="hidden sm:inline">Criar cotação</span><span className="sm:hidden">Cotação</span></button><Link href="/dashboard/crm" className="hidden items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-gray-700 lg:inline-flex"><Truck className="h-4 w-4" />Funil</Link><button onClick={() => void archive()} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700" title={detail.status === "ARCHIVED" ? "Reabrir conversa" : "Arquivar conversa"}><Archive className="h-4 w-4" /></button></div></header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-gray-950">{detail.messages.map((message) => <div key={message.id} className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${message.direction === "OUTBOUND" ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"}`}>
                {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                {message.mediaKey && <a href={`/api/dashboard/whatsapp/media/${message.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 underline"><Paperclip className="h-4 w-4" />{message.mediaFileName || `Anexo ${message.mediaMimeType ?? ""}`}</a>}
                {!message.body && !message.mediaKey && <p className="text-sm italic">{message.type === "text" ? "Mensagem sem texto" : `Mensagem de ${message.type}`}</p>}
                <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.direction === "OUTBOUND" ? "text-blue-100" : "text-gray-400"}`}>{dateLabel(message.sentAt)} {message.direction === "OUTBOUND" && <Check className="h-3 w-3" />}</span>
              </div></div>)}</div>
              <form onSubmit={sendMessage} className="border-t border-gray-200 p-3 dark:border-gray-800"><div className="flex items-end gap-2"><textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={2} placeholder="Responder pelo WhatsApp…" className="min-h-12 flex-1 resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"/><button disabled={busy || !text.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Send className="h-4 w-4" /><span className="hidden sm:inline">Enviar</span></button></div></form>
            </> : <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><div className="rounded-full bg-blue-50 p-4 text-blue-600 dark:bg-blue-950"><MessageCircle className="h-8 w-8" /></div><h2 className="text-lg font-semibold">Organize as cotações que chegam pelo WhatsApp</h2><p className="max-w-md text-sm text-gray-500">O histórico fica na caixa do TMS; os anexos são privados no R2 da Ávila Ops.</p>{connection?.status !== "CONNECTED" && <button onClick={() => void connect()} disabled={busy || !connection?.configured || !connection?.canManage} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleDashed className="h-4 w-4" />}{!connection?.configured ? "Evolution API não configurada" : connection.canManage ? "Conectar WhatsApp" : "Aguarde o administrador conectar"}</button>}</div>}
          </div>
        </section>
        {!connection?.configured && <p className="text-xs text-gray-500">A conexão depende de `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no servidor. O pareamento fica disponível ao administrador após essa configuração.</p>}
      </div>
      {showQuote && detail && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQuote(false); }}><form onSubmit={createQuote} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Registrar cotação</h2><p className="text-sm text-gray-500">A cotação ficará vinculada a esta conversa.</p></div><button type="button" onClick={() => setShowQuote(false)} aria-label="Fechar" className="rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800">×</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Cliente ou empresa<input required name="companyName" defaultValue={detail.contactName || detail.phone} maxLength={200} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm">E-mail (opcional)<input type="email" name="email" maxLength={254} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm">Telefone<input readOnly value={detail.phone} className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" /></label><label className="text-sm">Origem<input required name="origin" maxLength={200} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm">Destino<input required name="destination" maxLength={200} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm">Volumes<input required type="number" name="volumes" min="1" step="1" defaultValue="1" className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm">Peso (kg)<input required type="number" name="weight" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label><label className="text-sm sm:col-span-2">Valor da nota (opcional)<input type="number" name="invoiceValue" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 dark:border-gray-700" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowQuote(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Salvando…" : "Registrar cotação"}</button></div></form></div>}
    </main>
  );
}
