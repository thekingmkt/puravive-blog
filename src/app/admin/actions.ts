"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import type { PostStatus } from "@/lib/types";

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type LoginState = { error: string | null };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Só credencial errada é culpa do que foi digitado. E-mail não confirmado,
  // limite de tentativas ou projeto fora do ar davam a mesma mensagem, o que
  // manda a pessoa reconferir a senha à toa — nesses casos o motivo aparece.
  if (error) {
    if (error.code === "invalid_credentials") {
      return { error: "E-mail ou senha incorretos." };
    }
    return { error: `Não foi possível entrar: ${error.message}` };
  }

  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export type PostFormState = { error: string | null; savedAt?: number };

// O campo datetime-local manda "2026-08-17T15:30", sem fuso nenhum. Sem marca
// de fuso o Postgres lê como UTC e o post sai 3h adiantado. O navegador já
// converte pra ISO, mas isso depende do JavaScript atual estar carregado —
// aba aberta antes de um deploy roda o código antigo. Aqui é a rede de
// segurança: sem fuso na string, assume Brasília (UTC-3, sem horário de verão
// desde 2019), que é o fuso deste blog.
function scheduledToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  const withSeconds = /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  return `${withSeconds}-03:00`;
}

// Data legível para o registro de atividade, no fuso do blog.
function dataLegivel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${dia} às ${hora}`;
}

function readPostFields(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const rawSlug = String(formData.get("slug") || "").trim();
  const status = String(formData.get("status") || "rascunho");

  return {
    title,
    slug: rawSlug ? slugify(rawSlug) : slugify(title),
    excerpt: String(formData.get("excerpt") || "").trim() || null,
    content_html: String(formData.get("content_html") || ""),
    cover_image_url: String(formData.get("cover_image_url") || "") || null,
    category_id: String(formData.get("category_id") || "") || null,
    status,
    published_at:
      status === "publicado"
        ? new Date().toISOString()
        : status === "agendado"
          ? scheduledToIso(String(formData.get("scheduled_at") || ""))
          : null,
    meta_title: String(formData.get("meta_title") || "").trim() || null,
    meta_description:
      String(formData.get("meta_description") || "").trim() || null,
    product_name: String(formData.get("product_name") || "").trim() || null,
    product_image_url:
      String(formData.get("product_image_url") || "") || null,
    product_description:
      String(formData.get("product_description") || "").trim() || null,
    product_url: String(formData.get("product_url") || "").trim() || null,
  };
}

export async function createPost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  const fields = readPostFields(formData);
  if (!fields.title) return { error: "Título é obrigatório." };
  if (!fields.slug) return { error: "Não foi possível gerar o link do post." };

  const { data: created, error } = await supabase
    .from("posts")
    .insert({ ...fields, author_id: user.id })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um post com esse link. Mude o título ou o link." };
    }
    return { error: error.message };
  }

  // Antes do redirect: redirect() lança exceção no Next, nada roda depois dele.
  await logActivity(supabase, user, {
    action: "criou",
    entity: "post",
    postId: created?.id ?? null,
    label: fields.title,
    details:
      fields.status === "agendado"
        ? `agendado para ${dataLegivel(fields.published_at)}`
        : `salvou como ${fields.status}`,
  });

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function updatePost(
  postId: string,
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  const fields = readPostFields(formData);
  if (!fields.title) return { error: "Título é obrigatório." };
  if (!fields.slug) return { error: "Não foi possível gerar o link do post." };

  const { data: existing } = await supabase
    .from("posts")
    .select("slug, status")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await supabase
    .from("posts")
    .update(fields)
    .eq("id", postId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um post com esse link. Mude o título ou o link." };
    }
    return { error: error.message };
  }

  // Agendar ou publicar pelo formulário é uma mudança de estado, não uma
  // edição qualquer: o registro precisa dizer isso, senão some no meio dos
  // "editou" e ninguém descobre quem pôs o post no ar.
  const mudouStatus = existing?.status !== fields.status;
  const acao = !mudouStatus
    ? "editou"
    : fields.status === "agendado"
      ? "agendou"
      : fields.status === "publicado"
        ? "publicou"
        : "despublicou";

  await logActivity(supabase, user, {
    action: acao,
    entity: "post",
    postId,
    label: fields.title,
    details:
      fields.status === "agendado"
        ? `para ${dataLegivel(fields.published_at)}`
        : null,
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/${fields.slug}`);
  if (existing?.slug && existing.slug !== fields.slug) {
    revalidatePath(`/${existing.slug}`);
  }
  redirect("/admin");
}

export type CategoryFormState = { error: string | null; savedAt?: number };

function readCategoryFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const rawSlug = String(formData.get("slug") || "").trim();
  const rawPosition = String(formData.get("position") || "").trim();

  return {
    name,
    slug: rawSlug ? slugify(rawSlug) : slugify(name),
    description: String(formData.get("description") || "").trim() || null,
    position: rawPosition === "" ? 100 : Number(rawPosition),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function categoryError(code: string | undefined, message: string) {
  if (code === "23505") {
    return { error: "Já existe uma categoria com esse link. Mude o link." };
  }
  return { error: message };
}

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  const fields = readCategoryFields(formData);
  if (!fields.name) return { error: "O nome é obrigatório." };
  if (!fields.slug) return { error: "Não foi possível gerar o link." };
  if (!Number.isFinite(fields.position)) {
    return { error: "A ordem precisa ser um número." };
  }

  const { error } = await supabase.from("categories").insert(fields);
  if (error) return categoryError(error.code, error.message);

  await logActivity(supabase, user, {
    action: "criou",
    entity: "categoria",
    label: fields.name,
  });

  revalidatePath("/admin/categorias");
  revalidatePath("/", "layout");
  return { error: null, savedAt: Date.now() };
}

export async function updateCategory(
  categoryId: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  const fields = readCategoryFields(formData);
  if (!fields.name) return { error: "O nome é obrigatório." };
  if (!fields.slug) return { error: "Não foi possível gerar o link." };
  if (!Number.isFinite(fields.position)) {
    return { error: "A ordem precisa ser um número." };
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("slug")
    .eq("id", categoryId)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .update(fields)
    .eq("id", categoryId);
  if (error) return categoryError(error.code, error.message);

  await logActivity(supabase, user, {
    action: "editou",
    entity: "categoria",
    label: fields.name,
  });

  revalidatePath("/admin/categorias");
  revalidatePath("/", "layout");
  revalidatePath(`/categoria/${fields.slug}`);
  if (existing?.slug && existing.slug !== fields.slug) {
    revalidatePath(`/categoria/${existing.slug}`);
  }
  return { error: null, savedAt: Date.now() };
}

export async function deleteCategory(
  categoryId: string,
  _prevState: CategoryFormState,
  _formData: FormData
): Promise<CategoryFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  // Apagar uma categoria com posts deixaria os posts órfãos no menu do blog.
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if ((count ?? 0) > 0) {
    return {
      error: `Essa categoria tem ${count} post${count === 1 ? "" : "s"}. Mova ${count === 1 ? "ele" : "eles"} para outra categoria antes de apagar.`,
    };
  }

  const { data: alvo } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { error: error.message };

  await logActivity(supabase, user, {
    action: "excluiu",
    entity: "categoria",
    label: alvo?.name ?? "categoria sem nome",
  });

  revalidatePath("/admin/categorias");
  revalidatePath("/", "layout");
  return { error: null, savedAt: Date.now() };
}

export async function setPostStatus(postId: string, nextStatus: PostStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: existing } = await supabase
    .from("posts")
    .select("slug, title, published_at")
    .eq("id", postId)
    .maybeSingle();

  const fields: { status: PostStatus; published_at?: string } = {
    status: nextStatus,
  };
  if (nextStatus === "publicado") {
    // Mantém a data original de quem já esteve no ar, pra republicar não jogar
    // o post pro topo do blog de novo. Data futura (post agendado) vira agora.
    const current = existing?.published_at
      ? new Date(existing.published_at)
      : null;
    if (!current || current.getTime() > Date.now()) {
      fields.published_at = new Date().toISOString();
    }
  }

  // O erro era ignorado aqui. Sem checar, o registro de atividade passaria a
  // mentir: mostraria uma publicação que o banco recusou.
  const { error } = await supabase
    .from("posts")
    .update(fields)
    .eq("id", postId);
  if (error) return;

  const acao =
    nextStatus === "publicado"
      ? "publicou"
      : nextStatus === "agendado"
        ? "agendou"
        : "despublicou";

  await logActivity(supabase, user, {
    action: acao,
    entity: "post",
    postId,
    label: existing?.title ?? "post sem título",
  });

  revalidatePath("/admin");
  revalidatePath("/");
  if (existing?.slug) revalidatePath(`/${existing.slug}`);
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  // O título tem que ser lido antes de apagar, senão o registro fica sem como
  // dizer qual post sumiu.
  const { data: existing } = await supabase
    .from("posts")
    .select("title")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (!error) {
    await logActivity(supabase, user, {
      action: "excluiu",
      entity: "post",
      postId: null,
      label: existing?.title ?? "post sem título",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export type NewUserState = { error: string | null; ok?: string };

export async function createUser(
  _prevState: NewUserState,
  formData: FormData
): Promise<NewUserState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email) return { error: "Informe o e-mail." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Esse e-mail não parece válido." };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
  }

  const admin = createAdminClient();
  // email_confirm: true porque quem cadastra aqui já é do time. Sem isso a
  // pessoa receberia um e-mail de confirmação e não conseguiria entrar antes
  // de clicar nele.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const jaExiste =
      error.status === 422 ||
      /already|registered|exists/i.test(error.message);
    return {
      error: jaExiste
        ? "Já existe um usuário com esse e-mail."
        : error.message,
    };
  }

  await logActivity(supabase, user, {
    action: "cadastrou",
    entity: "usuario",
    label: email,
  });

  revalidatePath("/admin/usuarios");
  return { error: null, ok: `${email} já pode entrar no painel.` };
}

export type DeleteUserState = { error: string | null };

export async function deleteUser(
  userId: string,
  _prevState: DeleteUserState,
  _formData: FormData
): Promise<DeleteUserState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada, faça login de novo." };

  // Remover a si mesmo derrubaria a própria sessão no meio do caminho e
  // deixaria a tela num estado sem volta.
  if (userId === user.id) {
    return { error: "Você não pode remover a sua própria conta." };
  }

  const admin = createAdminClient();

  // Sem esta trava dá para apagar todo mundo e trancar o painel para sempre:
  // não existe tela de cadastro pública para criar o primeiro usuário de volta.
  const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (erroLista) return { error: erroLista.message };
  if (lista.users.length <= 1) {
    return { error: "Esse é o último usuário. Sem ele ninguém entra no painel." };
  }

  // O e-mail tem que sair da lista antes do apagamento, senão o registro fica
  // sem como dizer quem perdeu o acesso.
  const alvo =
    lista.users.find((u) => u.id === userId)?.email ?? "usuário sem e-mail";

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  await logActivity(supabase, user, {
    action: "removeu",
    entity: "usuario",
    label: alvo,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}
