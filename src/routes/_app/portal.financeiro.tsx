import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { isBefore, startOfToday } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type ClientInvoice, useClientInvoices, useClients } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/portal/financeiro")({ component: ClientFinancePage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const initialForm = { description: "", amount: "", dueDate: "", paymentMethod: "pix", paymentLink: "" };

function ClientFinancePage() {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: invoices = [] } = useClientInvoices();
  const { isAdmin, isCollaborator, isClient, clientId: linkedClientId } = useAuth();
  const [clientId, setClientId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ClientInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<ClientInvoice | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isClient) setClientId(linkedClientId ?? "");
    else if (!clientId && clients[0]) setClientId(clients[0].id);
  }, [clientId, clients, isClient, linkedClientId]);

  const client = clients.find((item) => item.id === clientId);
  const items = useMemo(() => invoices.filter((invoice) => invoice.client_id === clientId).sort((a, b) => a.due_date.localeCompare(b.due_date)), [clientId, invoices]);
  const total = (kind: "open" | "paid" | "overdue") => items.filter((invoice) => kind === "paid" ? invoice.status === "paid" : kind === "overdue" ? invoice.status !== "paid" && isBefore(new Date(invoice.due_date), startOfToday()) : invoice.status !== "paid" && !isBefore(new Date(invoice.due_date), startOfToday())).reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const canManageInvoices = isAdmin || isCollaborator;

  const saveInvoice = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!clientId || !form.description.trim() || !form.dueDate || !Number.isFinite(amount) || amount <= 0) throw new Error("Preencha a descrição, o valor e o vencimento da fatura.");
      const data = { description: form.description.trim(), amount, due_date: form.dueDate, payment_method: form.paymentMethod, payment_link: form.paymentLink.trim() || null };
      const query = editingInvoice
        ? (supabase.from("client_invoices") as any).update(data).eq("id", editingInvoice.id)
        : (supabase.from("client_invoices") as any).insert({ ...data, client_id: clientId });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["client_invoices"] });
      setEditorOpen(false);
      setEditingInvoice(null);
      setForm(initialForm);
      toast.success(editingInvoice ? "Fatura atualizada." : "Fatura cadastrada para pagamento.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a fatura."),
  });
  const deleteInvoice = useMutation({
    mutationFn: async () => {
      if (!invoiceToDelete) return;
      const { error } = await (supabase.from("client_invoices") as any).delete().eq("id", invoiceToDelete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["client_invoices"] });
      setInvoiceToDelete(null);
      toast.success("Fatura apagada.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível apagar a fatura."),
  });

  const openCreate = () => { setEditingInvoice(null); setForm(initialForm); setEditorOpen(true); };
  const openEdit = (invoice: ClientInvoice) => { setEditingInvoice(invoice); setForm({ description: invoice.description, amount: String(invoice.amount), dueDate: invoice.due_date, paymentMethod: invoice.payment_method, paymentLink: invoice.payment_link ?? "" }); setEditorOpen(true); };

  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-primary">Portal do Cliente</p><h1 className="text-2xl font-bold">Financeiro</h1><p className="text-sm text-muted-foreground">Consulte as faturas e pagamentos por cliente.</p></div>
      {canManageInvoices && <Button onClick={openCreate} disabled={!clientId}><Plus /> Cadastrar fatura</Button>}
    </header>
    {isClient ? <Card className="p-4"><p className="text-sm text-muted-foreground">Cliente vinculado</p><p className="mt-1 font-semibold">{client?.name ?? "Cliente não vinculado"}</p></Card> : <Card className="p-4"><p className="mb-2 text-sm font-medium">Cliente</p><Select value={clientId} onValueChange={setClientId}><SelectTrigger className="max-w-md"><SelectValue placeholder="Selecionar o cliente" /></SelectTrigger><SelectContent>{clients.map((currentClient) => <SelectItem key={currentClient.id} value={currentClient.id}>{currentClient.name}</SelectItem>)}</SelectContent></Select></Card>}
    {!clientId ? <Card className="p-10 text-center text-sm text-muted-foreground">Cadastre ou selecione um cliente para ver o financeiro.</Card> : <><div className="grid gap-3 sm:grid-cols-3"><Metric label="Em aberto" value={total("open")} /><Metric label="Vencido" value={total("overdue")} /><Metric label="Pago" value={total("paid")} /></div><section className="space-y-3"><h2 className="text-lg font-semibold">Faturas de {client?.name}</h2>{items.map((invoice) => <Card key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{invoice.description}</p><p className="text-sm text-muted-foreground">Vencimento: {invoice.due_date}</p></div><div className="flex items-center gap-2"><strong>{money.format(Number(invoice.amount))}</strong>{canManageInvoices && <><Button type="button" size="icon" variant="outline" aria-label={`Editar ${invoice.description}`} onClick={() => openEdit(invoice)}><Pencil /></Button><Button type="button" size="icon" variant="outline" className="text-destructive hover:text-destructive" aria-label={`Apagar ${invoice.description}`} onClick={() => setInvoiceToDelete(invoice)}><Trash2 /></Button></>}</div></Card>)}{!items.length && <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada para este cliente.</Card>}</section></>}
    <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditingInvoice(null); setForm(initialForm); } }}><DialogContent><DialogHeader><DialogTitle>{editingInvoice ? "Editar fatura" : "Cadastrar fatura para pagamento"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveInvoice.mutate(); }}><div className="space-y-2"><Label htmlFor="invoice-description">Descrição</Label><Input id="invoice-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex.: Mensalidade de agosto" required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="invoice-amount">Valor</Label><Input id="invoice-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" required /></div><div className="space-y-2"><Label htmlFor="invoice-due-date">Vencimento</Label><Input id="invoice-due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required /></div></div><div className="space-y-2"><Label htmlFor="invoice-method">Forma de pagamento</Label><Select value={form.paymentMethod} onValueChange={(paymentMethod) => setForm({ ...form, paymentMethod })}><SelectTrigger id="invoice-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">Pix</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="link">Link de pagamento</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="invoice-link">Link de pagamento (opcional)</Label><Input id="invoice-link" type="url" value={form.paymentLink} onChange={(event) => setForm({ ...form, paymentLink: event.target.value })} placeholder="https://" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button><Button type="submit" disabled={saveInvoice.isPending}>{saveInvoice.isPending ? "Salvando…" : editingInvoice ? "Salvar alterações" : "Cadastrar fatura"}</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apagar fatura?</AlertDialogTitle><AlertDialogDescription>A fatura “{invoiceToDelete?.description}” será excluída permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteInvoice.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteInvoice.isPending} onClick={() => deleteInvoice.mutate()}>{deleteInvoice.isPending ? "Apagando…" : "Apagar fatura"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{money.format(value)}</p></Card>;
}
