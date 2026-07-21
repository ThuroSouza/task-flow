import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [municipalRegistration, setMunicipalRegistration] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [responsible, setResponsible] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#1e3a8a");

  const save = async () => {
    const name = tradeName.trim() || legalName.trim();
    if (!name) {
      toast.error("Preencha o Nome fantasia ou a Razão social.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("clients").insert({
      name,
      cnpj: cnpj || null,
      legal_name: legalName || null,
      trade_name: tradeName || null,
      state_registration: stateRegistration || null,
      municipal_registration: municipalRegistration || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      responsible: responsible || null,
      description: description || null,
      color,
      created_by: user?.id,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Cliente cadastrado");
    navigate({ to: "/clients" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center gap-4">
        <Button asChild size="icon" variant="ghost" title="Voltar para clientes">
          <Link to="/clients">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os dados comerciais e de contato do cliente.
          </p>
        </div>
      </header>

      <Card className="p-6">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-semibold">Dados cadastrais</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CNPJ">
                <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
              </Field>
              <Field label="Nome fantasia">
                <Input value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
              </Field>
              <Field label="Razão social">
                <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
              </Field>
              <Field label="Responsável">
                <Input
                  value={responsible}
                  onChange={(event) => setResponsible(event.target.value)}
                />
              </Field>
              <Field label="Inscrição Estadual">
                <Input
                  value={stateRegistration}
                  onChange={(event) => setStateRegistration(event.target.value)}
                />
              </Field>
              <Field label="Inscrição Municipal">
                <Input
                  value={municipalRegistration}
                  onChange={(event) => setMunicipalRegistration(event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="font-semibold">Contato</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone">
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Endereço completo">
              <Input value={address} onChange={(event) => setAddress(event.target.value)} />
            </Field>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="font-semibold">Informações adicionais</h2>
            <Field label="Descrição">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Cor de identificação">
              <Input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-20"
              />
            </Field>
          </section>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button asChild variant="outline">
              <Link to="/clients">Cancelar</Link>
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar cliente"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
