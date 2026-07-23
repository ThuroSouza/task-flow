import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, isBefore, parseISO, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, CircleDollarSign, Copy, ExternalLink, FileText, Mail, MessageCircle, Plus, Send, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useClientInvoices, useTasks, type ClientInvoice } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/_app/portal")({ component: ClientPortalPage });

type InvoiceViewStatus = "overdue" | "open" | "paid";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function invoiceStatus(invoice: ClientInvoice): InvoiceViewStatus {
  if (invoice.status === "paid") return "paid";
  return isBefore(parseISO(invoice.due_date), startOfToday()) ? "overdue" : "open";
}

function ClientPortalPage() {
  const { data: clients = [] } = useClients();
  const { data: tasks = [] } = useTasks();
  const { data: invoices = [] } = useClientInvoices();
  const queryClient = useQueryClient();
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [shareInvoice, setShareInvoice] = useState<ClientInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ client_id: "", description: "", amount: "", due_date: format(addDays(new Date(), 7), "yyyy-MM-dd"), payment_method: "pix" });

  const sortedInvoices = useMemo(() => [...invoices].sort((a, b) => {
    const order = { overdue: 0, open: 1, paid: 2 };
    const difference = order[invoiceStatus(a)] - order[invoiceStatus(b)];
    return difference || a.due_date.localeCompare(b.due_date);
  }), [invoices]);

  const total = (status: InvoiceViewStatus) => invoices.filter(i => invoiceStatus(i) === status).reduce((sum, i) => sum + Number(i.amount), 0);
  const saveInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.client_id || !form.description || !form.amount || !form.due_date) return;
    setSubmitting(true);
    const { error } = await (supabase.from("client_invoices") as any).insert({
      client_id: form.client_id,
      description: form.description,
      amount: Number(form.amount.replace(",", ".")),
      due_date: form.due_date,
      payment_method: form.payment_method,
    });
    setSubmitting(false);
    if (error) return toast.error("Não foi possível criar a fatura: " + error.message);
    await queryClient.invalidateQueries({ queryKey: ["client_invoices"] });
    setNewInvoiceOpen(false);
    setForm({ client_id: "", description: "", amount: "", due_date: format(addDays(new Date(), 7), "yyyy-MM-dd"), payment_method: "pix" });
    toast.success("Fatura criada. Agora você pode enviá-la ao cliente.");
  };

  const markPaid = async (invoice: ClientInvoice) => {
    const { error } = await (supabase.from("client_invoices") as any).update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoice.id);
    if (error) return toast.error("Não foi possível atualizar a fatura.");
    await queryClient.invalidateQueries({ queryKey: ["client_invoices"] });
    toast.success("Pagamento marcado como recebido.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Área compartilhada</p>
          <h1 className="text-2xl font-bold tracking-tight">Portal do Cliente</h1>
          <p className="text-sm text-muted-foreground">Entregas e pagamentos em um único lugar.</p>
        </div>
        <Button onClick={() => setNewInvoiceOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Nova Fatura</Button>
      </header>

      <Collapsible defaultOpen className="rounded-xl border bg-card shadow-sm" id="entregas">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left">
          <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span><span><span className="block font-semibold">Calendário de Entregas</span><span className="block text-sm font-normal text-muted-foreground">Acompanhe as próximas demandas previstas.</span></span></span>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t px-4 pb-4 pt-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tasks.filter(t => t.due_date).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")).slice(0, 6).map(task => (
              <div key={task.id} className="rounded-lg border bg-muted/30 p-3">
                <p className="font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{format(parseISO(task.due_date!), "dd 'de' MMMM", { locale: ptBR })}</p>
              </div>
            ))}
            {!tasks.some(t => t.due_date) && <p className="text-sm text-muted-foreground">Nenhuma entrega com data definida.</p>}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm" id="financeiro">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/3">
          <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500/15 text-blue-400"><WalletCards className="h-5 w-5" /></span><span><span className="block font-semibold">Financeiro</span><span className="block text-sm font-normal text-zinc-400">Faturas ordenadas por prioridade de cobrança.</span></span></span>
          <ChevronDown className="h-5 w-5 text-zinc-400" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-zinc-800 p-4">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <FinanceMetric label="Em aberto" value={total("open")} />
            <FinanceMetric label="Vencido" value={total("overdue")} tone="red" />
            <FinanceMetric label="Pago" value={total("paid")} tone="green" />
          </div>
          <div className="space-y-3">
            {sortedInvoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} clientName={clients.find(c => c.id === invoice.client_id)?.name} onShare={() => setShareInvoice(invoice)} onPaid={() => markPaid(invoice)} />)}
            {!sortedInvoices.length && <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">Nenhuma fatura criada. Use “Nova Fatura” para começar.</div>}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen}>
        <DialogContent><DialogHeader><DialogTitle>Nova Fatura</DialogTitle><DialogDescription>Crie a cobrança e depois escolha como enviá-la ao cliente.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveInvoice}>
            <div className="space-y-2"><Label>Cliente</Label><Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Input id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Mensalidade agosto/2026" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="amount">Valor (R$)</Label><Input id="amount" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="620,00" /></div><div className="space-y-2"><Label htmlFor="due">Vencimento</Label><Input id="due" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div></div>
            <div className="space-y-2"><Label>Forma de pagamento</Label><Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">Pix</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="link">Link de pagamento</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Criando…" : "Criar fatura"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ShareDialog invoice={shareInvoice} client={clients.find(c => c.id === shareInvoice?.client_id)} onClose={() => setShareInvoice(null)} />
    </div>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: number; tone?: "red" | "green" }) {
  return <div className="rounded-lg bg-zinc-900 p-4"><p className="text-sm font-medium text-zinc-400">{label}</p><p className={`mt-1 text-2xl font-bold ${tone === "red" ? "text-red-400" : tone === "green" ? "text-emerald-400" : "text-zinc-100"}`}>{money.format(value)}</p></div>;
}

function InvoiceCard({ invoice, clientName, onShare, onPaid }: { invoice: ClientInvoice; clientName?: string; onShare: () => void; onPaid: () => void }) {
  const status = invoiceStatus(invoice);
  const labels = { overdue: "Vencido", open: "Pendente", paid: "Pago" };
  const styles = { overdue: "border-red-800 bg-red-950/15", open: "border-zinc-700 bg-zinc-900", paid: "border-zinc-800 bg-zinc-900/60 opacity-75" };
  const badge = { overdue: "bg-red-950 text-red-300", open: "bg-amber-950 text-amber-300", paid: "bg-emerald-950 text-emerald-300" };
  return <article className={`rounded-xl border p-4 ${styles[status]}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{invoice.description}</h3><p className="mt-1 text-sm text-zinc-400">{clientName && `${clientName} · `}{status === "paid" ? `Pago em ${format(parseISO(invoice.paid_at || invoice.due_date), "dd 'de' MMM yyyy", { locale: ptBR })}` : `Vence em ${format(parseISO(invoice.due_date), "dd 'de' MMM yyyy", { locale: ptBR })}`}</p></div><Badge className={`border-0 ${badge[status]}`}>{labels[status]}</Badge></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3"><strong className="text-xl">{money.format(Number(invoice.amount))}</strong><div className="flex gap-2">{status !== "paid" && <Button size="sm" variant="outline" className="border-zinc-600 bg-transparent text-zinc-100 hover:bg-zinc-800 hover:text-white" onClick={onShare}><Send className="mr-1 h-3.5 w-3.5" />Enviar ao cliente</Button>}{status !== "paid" && <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={onPaid}><Check className="mr-1 h-3.5 w-3.5" />Marcar pago</Button>}{status === "paid" && <Button size="sm" variant="outline" className="border-zinc-600 bg-transparent text-zinc-100 hover:bg-zinc-800 hover:text-white"><FileText className="mr-1 h-3.5 w-3.5" />Recibo</Button>}</div></div></article>;
}

function ShareDialog({ invoice, client, onClose }: { invoice: ClientInvoice | null; client?: { name: string; email: string | null; phone: string | null }; onClose: () => void }) {
  const shareUrl = invoice && typeof window !== "undefined" ? `${window.location.origin}/portal?fatura=${invoice.id}` : "";
  const message = invoice ? `Olá, ${client?.name || ""}! Segue a fatura ${invoice.description}, no valor de ${money.format(Number(invoice.amount))}, com vencimento em ${format(parseISO(invoice.due_date), "dd/MM/yyyy")}: ${shareUrl}` : "";
  const copy = async () => { await navigator.clipboard.writeText(message); toast.success("Mensagem copiada."); };
  return <Dialog open={!!invoice} onOpenChange={open => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>Enviar cobrança</DialogTitle><DialogDescription>Escolha o canal para encaminhar esta fatura ao cliente.</DialogDescription></DialogHeader><div className="rounded-lg bg-muted p-3 text-sm">{message}</div><div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={copy}><Copy className="mr-1.5 h-4 w-4" />Copiar</Button><Button variant="outline" asChild><a href={`https://wa.me/${(client?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</a></Button><Button variant="outline" asChild><a href={`mailto:${client?.email || ""}?subject=${encodeURIComponent("Fatura: " + (invoice?.description || ""))}&body=${encodeURIComponent(message)}`}><Mail className="mr-1.5 h-4 w-4" />E-mail</a></Button></div><a className="flex items-center justify-center gap-1 text-sm text-primary underline" href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Abrir link da fatura</a></DialogContent></Dialog>;
}
