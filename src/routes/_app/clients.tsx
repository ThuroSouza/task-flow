import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useClients, useTasks, type Client } from "@/hooks/use-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1e3a8a");
  const [desc, setDesc] = useState("");
  const [search, setSearch] = useState("");
  const filteredClients = clients.filter((client) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");

    return (
      client.name.toLocaleLowerCase("pt-BR").includes(term) ||
      client.description?.toLocaleLowerCase("pt-BR").includes(term)
    );
  });

  const onOpen = (c: Client | null) => {
    setEdit(c);
    setName(c?.name ?? "");
    setColor(c?.color ?? "#1e3a8a");
    setDesc(c?.description ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    if (edit) {
      await supabase.from("clients").update({ name, color, description: desc }).eq("id", edit.id);
    } else {
      await supabase.from("clients").insert({ name, color, description: desc, created_by: user?.id });
    }
    qc.invalidateQueries({ queryKey: ["clients"] });
    setOpen(false);
    toast.success("Cliente salvo");
  };

  const remove = async (c: Client) => {
    if (!confirm(`Excluir cliente "${c.name}"?`)) return;
    await supabase.from("clients").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Organize tarefas por cliente</p>
        </div>
        <Button onClick={() => onOpen(null)}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
      </header>
      {/* CAMPO DE BUSCA DE CLIENTES */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Localizar cliente..."
          className="pl-9"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredClients.map(c => {
          const count = tasks.filter(t => t.client_id === c.id).length;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg" style={{ background: c.color || "#1e3a8a" }} />
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{count} tarefa(s)</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="icon" variant="ghost" title="Relatório IA">
                    <Link to="/client-report/$clientId" params={{ clientId: c.id }}>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onOpen(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {c.description && <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>}
            </Card>
          );
        })}
        {clients.length === 0 && (
          <Card className="col-span-full p-10 text-center text-muted-foreground">
            Nenhum cliente cadastrado. Crie um para começar a organizar tarefas.
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Cor</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <Button onClick={save} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
