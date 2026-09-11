import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Teto de segurança, igual ao de metrics.ts: acima disso a tela passaria a
// demorar. Se bater, o aviso aparece em vez de mostrar histórico cortado em
// silêncio.
const ROW_LIMIT = 2000;

export type ActivityEntity = "post" | "usuario" | "categoria";

export type ActivityEntry = {
  id: number;
  actorEmail: string;
  action: string;
  entity: ActivityEntity | string;
  postId: string | null;
  label: string;
  details: string | null;
  createdAt: string;
};

export type ActivityFeed = {
  available: boolean;
  truncated: boolean;
  entries: ActivityEntry[];
};

const EMPTY: ActivityFeed = { available: false, truncated: false, entries: [] };

type Actor = { id: string; email?: string | null };

/**
 * Grava uma linha no registro de atividade.
 *
 * Nunca lança: se o registro falhar, quem chamou já fez o que tinha que fazer,
 * e derrubar a ação do usuário por causa do log seria pior do que perder o log.
 * A falha vai pro console do servidor para não sumir sem deixar rastro.
 */
export async function logActivity(
  supabase: SupabaseClient,
  actor: Actor,
  entry: {
    action: string;
    entity: ActivityEntity;
    label: string;
    postId?: string | null;
    details?: string | null;
  }
) {
  try {
    const { error } = await supabase.from("activity_log").insert({
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action: entry.action,
      entity: entry.entity,
      post_id: entry.postId ?? null,
      entity_label: entry.label,
      details: entry.details ?? null,
    });
    if (error) {
      console.error("[atividade] não consegui registrar:", error.message);
    }
  } catch (e) {
    console.error("[atividade] não consegui registrar:", e);
  }
}

/**
 * Lê o registro. `days` nulo traz tudo.
 *
 * Se a tabela ainda não existir (a migração é manual neste projeto), devolve
 * `available: false` em vez de estourar, do mesmo jeito que getMetrics faz.
 */
export async function getActivity(days: number | null): Promise<ActivityFeed> {
  const supabase = await createClient();

  let query = supabase
    .from("activity_log")
    .select(
      "id, actor_email, action, entity, post_id, entity_label, details, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT + 1);

  if (days !== null) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return EMPTY;

  const truncated = data.length > ROW_LIMIT;
  const rows = truncated ? data.slice(0, ROW_LIMIT) : data;

  return {
    available: true,
    truncated,
    entries: rows.map((r) => ({
      id: r.id as number,
      actorEmail: (r.actor_email as string | null) ?? "usuário removido",
      action: r.action as string,
      entity: (r.entity as string) ?? "post",
      postId: r.post_id as string | null,
      label: r.entity_label as string,
      details: r.details as string | null,
      createdAt: r.created_at as string,
    })),
  };
}
