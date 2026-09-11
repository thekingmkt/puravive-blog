import AdminHeader from "@/components/admin/AdminHeader";
import NewUserForm from "@/components/admin/NewUserForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUser } from "../actions";

const TZ = "America/Sao_Paulo";

function formatDate(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

async function listUsers() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) return null;
    return data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "sem e-mail",
        createdAt: u.created_at,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    // Sem a chave de serviço no ambiente, a tela avisa em vez de quebrar.
    return null;
  }
}

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <>
      <AdminHeader />
      <div className="admin-content">
        <div className="admin-content-head">
          <h1>Usuários</h1>
        </div>

        <p className="admin-hint">
          Quem entra aqui tem acesso a tudo no painel: criar, editar, publicar e
          excluir post. Cadastre só quem precisa mesmo.
        </p>

        <section className="metric-card">
          <div className="metric-card-head">
            <h2>Novo usuário</h2>
          </div>
          <NewUserForm action={createUser} />
        </section>

        {users === null ? (
          <p className="admin-empty">
            Não consegui listar os usuários. Falta a chave de serviço do
            Supabase no ambiente.
          </p>
        ) : (
          <div className="admin-post-table">
            {users.map((u) => (
              <div key={u.id} className="user-row">
                <span className="user-row-email">{u.email}</span>
                <span className="user-row-date">
                  desde {formatDate(u.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
