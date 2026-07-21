import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [color, setColor] = useState(profile?.color ?? "#1e3a8a");

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles")
      .update({ full_name: name, color })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Preferências salvas");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Personalização</h1>
        <p className="text-sm text-muted-foreground">Ajuste seu perfil e cor pessoal usada em avatares e gráficos</p>
      </header>

      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Sua cor de destaque</Label>
          <div className="flex items-center gap-3">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-20 p-1" />
            <span className="text-sm text-muted-foreground">{color}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Personalize a cor das colunas, clientes e tarefas individualmente pelos seus respectivos editores.
          </p>
        </div>
        <Button onClick={save}>Salvar preferências</Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Tema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O tema padrão é <strong>azul-marinho escuro</strong>. Cada cliente, coluna e tarefa pode ter sua própria cor.
        </p>
      </Card>
    </div>
  );
}
