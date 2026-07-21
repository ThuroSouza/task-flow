import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteUserCompletely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify caller is admin
    const { data: callerRoles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) throw new Error(rolesErr.message);
    if (!callerRoles?.some((r) => r.role === "admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }

    const uid = data.userId;

    // Wipe user-owned content in public schema. Order matters for FKs.
    const tasksRes = await supabaseAdmin
      .from("tasks")
      .select("id")
      .or(`assignee_id.eq.${uid},created_by.eq.${uid}`);
    const taskIds = (tasksRes.data ?? []).map((t: any) => t.id);

    if (taskIds.length) {
      await supabaseAdmin.from("subtasks").delete().in("task_id", taskIds);
      await supabaseAdmin.from("task_tag_links").delete().in("task_id", taskIds);
      await supabaseAdmin.from("task_interruptions").delete().in("task_id", taskIds);
      await supabaseAdmin.from("task_history").delete().in("task_id", taskIds);
      await supabaseAdmin.from("comments").delete().in("task_id", taskIds);
      await supabaseAdmin.from("attachments").delete().in("task_id", taskIds);
      await supabaseAdmin.from("tasks").delete().in("id", taskIds);
    }

    // Other user-scoped rows
    await supabaseAdmin.from("task_interruptions").delete().eq("user_id", uid);
    await supabaseAdmin.from("comments").delete().eq("author_id", uid);
    await supabaseAdmin.from("client_note_attachments").delete().eq("uploaded_by", uid);
    await supabaseAdmin.from("client_notes").delete().eq("created_by", uid);
    await supabaseAdmin.from("client_files").delete().eq("uploaded_by", uid);
    // tags/statuses/columns are global — never delete on user removal
    await supabaseAdmin.from("user_column_order").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_task_order").delete().eq("user_id", uid);
    await supabaseAdmin.from("board_preferences").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").delete().eq("id", uid);

    // Finally remove auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(authErr.message);

    return { ok: true };
  });
