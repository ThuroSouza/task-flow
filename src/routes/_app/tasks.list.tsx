import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTasks,
  useColumns,
  useClients,
  useProfiles,
  useSubtasks,
  useTaskStatuses,
  useTaskCollaborators,
  type Task,
} from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { TaskFilters, applyTaskFilters, type TaskFilterValue } from "@/components/TaskFilters";
import { TaskDialog } from "@/components/TaskDialog";
import { priorityColors, priorityLabels, statusLabels } from "@/lib/task-utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tasks/list")({
  component: ListPage,
  validateSearch: (s: Record<string, unknown>) => ({
    task: typeof s.task === "string" ? s.task : undefined,
    mine: s.mine === "1" || s.mine === true || s.mine === "true" ? true : undefined,
  }),
});

function ListPage() {
  const { data: tasks = [] } = useTasks();
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: subtasks = [] } = useSubtasks();
  const { data: statuses = [] } = useTaskStatuses();
  const { data: collaborators = [] } = useTaskCollaborators();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useColumns();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TaskFilterValue>(() =>
    search.mine ? { scope: "mine" } : {},
  );
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Task | null>(null);

  // Auto-open a task when arriving with ?task=<id>
  useEffect(() => {
    if (!search.task) return;
    const t = tasks.find((x) => x.id === search.task);
    if (t) {
      setEdit(t);
      setOpen(true);
      navigate({
        to: "/tasks/list",
        search: (p: any) => ({ ...p, task: undefined }),
        replace: true,
      });
    }
  }, [search.task, tasks, navigate]);

  const subtaskAssigneeTaskIds = useMemo(() => {
    const s = new Set<string>();
    if (!user?.id) return s;
    for (const st of subtasks as any[])
      if (st.assignee_id === user.id && st.task_id) s.add(st.task_id);
    return s;
  }, [subtasks, user?.id]);

  const subtaskAssigneeTaskIdsByUser = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const st of subtasks as any[]) {
      if (!st.assignee_id || !st.task_id) continue;
      const set = map.get(st.assignee_id) ?? new Set<string>();
      set.add(st.task_id);
      map.set(st.assignee_id, set);
    }
    return map;
  }, [subtasks]);

  const collaboratorTaskIds = useMemo(
    () => new Set(collaborators.filter((collaborator) => collaborator.collaborator_id === user?.id).map((collaborator) => collaborator.task_id)),
    [collaborators, user?.id],
  );

  const list = useMemo(() => {
    const r = applyTaskFilters(tasks, filters, {
      userId: user?.id ?? null,
      subtaskAssigneeTaskIds,
      collaboratorTaskIds,
      subtaskAssigneeTaskIdsByUser,
    });
    return r.filter((task) => task.status !== "done" && !task.completed_at).sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks, filters, user?.id, subtaskAssigneeTaskIds, collaboratorTaskIds, subtaskAssigneeTaskIdsByUser]);

  const completeTask = async (taskId: string) => {
    const completedStatus = statuses.find((status) => status.is_completed);

    if (!completedStatus) {
      toast.error("Cadastre um status marcado como concluído.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        status_id: completedStatus.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      toast.error(error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Tarefa concluída.");
  };

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-end gap-3 flex-wrap">
        <Button
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova tarefa
        </Button>
      </header>
      <TaskFilters filters={filters} onChange={setFilters} />

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="border-r px-4 py-3">Tarefa</th>
              <th className="border-r px-4 py-3">Cliente</th>
              <th className="border-r px-4 py-3">Responsável</th>
              <th className="border-r px-4 py-3">Status</th>
              <th className="border-r px-4 py-3">Prioridade</th>
              <th className="border-r px-4 py-3">Prazo</th>
              <th className="w-14 px-4 py-3 text-center">Concluir</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhuma tarefa
                </td>
              </tr>
            ) : list.map((t) => {
              const client = clients.find((c) => c.id === t.client_id);
              const assignee = profiles.find((p) => p.id === t.assignee_id);
              const overdue = t.due_date && isPast(new Date(t.due_date)) && t.status !== "done";

              return (
                <tr
                  key={t.id}
                  className="cursor-pointer border-t hover:bg-muted/30"
                  onClick={() => {
                    setEdit(t);
                    setOpen(true);
                  }}
                >
                  <td className="border-r px-4 py-3 font-medium">{t.title}</td>
                  <td className="border-r px-4 py-3">
                    {client ? (
                      <Badge variant="outline" style={{ borderColor: client.color ?? undefined }}>
                        {client.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="border-r px-4 py-3 text-muted-foreground">
                    {assignee?.full_name || assignee?.email || "—"}
                  </td>
                  <td className="border-r px-4 py-3">
                    {t.status ? (
                      <Badge variant="secondary">{statusLabels[t.status]}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="border-r px-4 py-3">
                    {t.priority ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: priorityColors[t.priority],
                          color: priorityColors[t.priority],
                        }}
                      >
                        {priorityLabels[t.priority]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`border-r px-4 py-3 ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    {t.due_date ? format(new Date(t.due_date), "dd MMM yyyy", { locale: ptBR }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Concluir tarefa"
                      disabled={t.completed_at !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        void completeTask(t.id);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TaskDialog open={open} onOpenChange={setOpen} task={edit} />
    </div>
  );
}
