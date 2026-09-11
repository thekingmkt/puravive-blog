import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ATENÇÃO: este é o único lugar do projeto que usa a chave de serviço, e ela
// ignora a RLS por completo. Nunca importe este arquivo de um Client Component
// ("use client") nem de nada que chegue ao navegador: a chave vazaria e daria
// acesso total ao banco para qualquer visitante.
//
// Ele existe por um motivo só: criar usuário do admin exige a API de
// administração do Supabase Auth, que a chave pública não alcança.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta a chave de serviço do Supabase no ambiente (SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
