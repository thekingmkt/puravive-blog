-- Registro de atividade do admin: quem fez o quê, e quando.
-- Rode este arquivo uma vez no SQL Editor do Supabase. Pode rodar de novo sem
-- medo: tudo aqui é idempotente e nada apaga histórico.
--
-- O e-mail de quem fez e o nome do alvo (título do post, e-mail do usuário,
-- nome da categoria) ficam gravados aqui dentro de propósito, em vez de só o
-- id. O admin usa a chave pública e não consegue ler auth.users, então sem o
-- e-mail gravado a tela não teria como dizer quem foi. E o nome gravado faz
-- "Fulano removeu o usuário X" continuar legível depois que o X deixou de
-- existir.

create table if not exists public.activity_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null default 'post',
  post_id uuid references public.posts(id) on delete set null,
  entity_label text not null,
  details text,
  created_at timestamptz not null default now()
);

-- Passagem da primeira versão, que só registrava post, para esta, que registra
-- post, usuário e categoria. Preserva o que já estava gravado.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'activity_log'
       and column_name = 'post_title'
  ) then
    alter table public.activity_log rename column post_title to entity_label;
  end if;
end $$;

alter table public.activity_log
  add column if not exists entity text not null default 'post';

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
