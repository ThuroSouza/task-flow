import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProfiles, useTasks } from "@/hooks/use-data";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Archive, UserCheck, UserX, ShieldCheck, User as UserIcon, ArrowRightLeft, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteUserCompletely } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, user, loading } = useAuth();
  const qc = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: tasks = [] } = useTasks();
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id, role")).data ?? [],
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "member" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await (supabase.from("profiles") as any).update({ is_active: active }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const reassignTask = useMutation({
    mutationFn: async ({ taskId, newAssignee }: { taskId: string; newAssignee: string }) => {
      const { error } = await supabase.from("tasks").update({ assignee_id: newAssignee }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Tarefa reatribuída"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteUserCompletely);
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Usuário excluído permanentemente");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const [reassignTarget, setReassignTarget] = useState<Record<string, string>>({});

  const activeProfiles = useMemo(() => profiles.filter(p => (p as any).is_active !== false), [profiles]);
  const inactiveProfiles = useMemo(() => profiles.filter(p => (p as any).is_active === false), [profiles]);
  const orphanTasks = useMemo(() => {
    const inactiveIds = new Set(inactiveProfiles.map(p => p.id));
    return tasks.filter(t => t.assignee_id && inactiveIds.has(t.assignee_id));
  }, [tasks, inactiveProfiles]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Gerencie papéis e acesso da equipe" : "Membros da equipe"}
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Ativos ({activeProfiles.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeProfiles.map(p => {
            const userRoles = roles.filter(r => r.user_id === p.id).map(r => r.role);
            const isUserAdmin = userRoles.includes("admin");
            const userTasks = tasks.filter(t => t.assignee_id === p.id);
            const done = userTasks.filter(t => t.status === "done").length;
            const isSelf = p.id === user?.id;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback style={{ background: p.color || "#1e3a8a", color: "white" }}>
                      {(p.full_name || p.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{p.full_name || "Sem nome"}</h3>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  {isUserAdmin ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {isUserAdmin && <Badge>Admin</Badge>}
                  {!isUserAdmin && <Badge variant="secondary">Membro</Badge>}
                  {isSelf && <Badge variant="outline" className="text-xs">Você</Badge>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded bg-muted p-2">
                    <p className="text-lg font-bold">{userTasks.length}</p>
                    <p className="text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded bg-muted p-2">
                    <p className="text-lg font-bold text-emerald-600">{done}</p>
                    <p className="text-muted-foreground">Concluídas</p>
                  </div>
                </div>

                {isAdmin && !isSelf && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <Select
                      value={isUserAdmin ? "admin" : "member"}
                      onValueChange={(v) => setRole.mutate({ userId: p.id, role: v as "admin" | "member" })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membro</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => {
                        if (confirm(`Desativar ${p.full_name || p.email}? As tarefas dele(a) somem do kanban mas continuam visíveis em relatórios.`)) {
                          setActive.mutate({ userId: p.id, active: false });
                        }
                      }}
                    >
                      <UserX className="mr-1 h-3 w-3" /> Desativar acesso
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full text-xs"
                      disabled={deleteUser.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `⚠️ EXCLUIR PERMANENTEMENTE ${p.full_name || p.email}?\n\nTudo será apagado: tarefas, anotações, arquivos, tags, status, colunas e o login.\nO email poderá criar uma nova conta do zero.\n\nEsta ação NÃO pode ser desfeita.`,
                          )
                        ) {
                          deleteUser.mutate(p.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Excluir do sistema
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {isAdmin && inactiveProfiles.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Archive className="h-4 w-4" /> Desativados ({inactiveProfiles.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inactiveProfiles.map(p => (
              <Card key={p.id} className="border-dashed p-4 opacity-75">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 grayscale">
                    <AvatarFallback style={{ background: "#64748b", color: "white" }}>
                      {(p.full_name || p.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{p.full_name || "Sem nome"}</h3>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="text-xs"
                    variant="outline"
                    onClick={() => setActive.mutate({ userId: p.id, active: true })}
                  >
                    <UserCheck className="mr-1 h-3 w-3" /> Reativar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    disabled={deleteUser.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `⚠️ EXCLUIR PERMANENTEMENTE ${p.full_name || p.email}?\n\nTudo será apagado e o email poderá criar uma nova conta do zero.\nEsta ação NÃO pode ser desfeita.`,
                        )
                      ) {
                        deleteUser.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isAdmin && orphanTasks.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <ArrowRightLeft className="h-4 w-4" /> Tarefas de membros desativados ({orphanTasks.length})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Reatribua para um membro ativo.</p>
          <div className="space-y-2">
            {orphanTasks.map(t => {
              const target = reassignTarget[t.id] ?? "";
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                  <span className="flex-1 truncate">{t.title}</span>
                  <Select value={target} onValueChange={(v) => setReassignTarget(s => ({ ...s, [t.id]: v }))}>
                    <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Escolher membro…" /></SelectTrigger>
                    <SelectContent>
                      {activeProfiles.map(ap => (
                        <SelectItem key={ap.id} value={ap.id}>{ap.full_name || ap.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!target}
                    onClick={() => reassignTask.mutate({ taskId: t.id, newAssignee: target })}
                  >
                    Reatribuir
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!isAdmin && <Navigate to="/dashboard" />}
    </div>
  );
}
