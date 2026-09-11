-- Registro de atividade do admin: quem mexeu em qual post, e quando.
-- Rode este arquivo uma vez no SQL Editor do Supabase.
--
-- O e-mail de quem fez e o título do post ficam gravados aqui dentro de
-- propósito, em vez de só o id. O admin usa a chave pública e não consegue ler
-- auth.users, então sem o e-mail gravado a tela não teria como dizer quem foi.
-- E o título gravado faz "Fulano excluiu o post X" continuar legível depois
-- que o post deixou de existir.

create table if not exists public.activity_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  post_id uuid references public.posts(id) on delete set null,
  post_title text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- Quem está logado no admin registra o que fez.
drop policy if exists "admin registra atividade" on public.activity_log;
create policy "admin registra atividade"
  on public.activity_log for insert
  to authenticated
  with check (true);

-- E enxerga o histórico inteiro.
drop policy if exists "admin le atividade" on public.activity_log;
create policy "admin le atividade"
  on public.activity_log for select
  to authenticated
  using (true);

-- Não existe policy de update nem de delete, e isso é a trava: com RLS ligada,
-- o que não tem policy é negado. Ninguém reescreve nem apaga o histórico pelo
-- site, nem com a chave pública, nem logado. É o mesmo desenho de page_views.
