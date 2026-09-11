import Link from "next/link";
import AdminHeader from "@/components/admin/AdminHeader";
import { getActivity } from "@/lib/activity";

const PERIODS: { key: string; days: number | null; label: string }[] = [
  { key: "7", days: 7, label: "7 dias" },
  { key: "30", days: 30, label: "30 dias" },
  { key: "90", days: 90, label: "90 dias" },
  { key: "tudo", days: null, label: "Tudo" },
];

// "publicou o post X" e "removeu o usuário X" só se distinguem se a linha
// disser de que tipo é a coisa mexida.
const TIPO: Record<string, string> = {
  post: "post",
  usuario: "usuário",
  categoria: "categoria",
};

// Mesmo motivo da lista de posts: o servidor roda em UTC e, sem fixar o fuso,
// uma ação das 22h apareceria com a data do dia seguinte.
const TZ = "America/Sao_Paulo";

function formatWhen(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  return { date, time, full: `${date} às ${time}` };
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const period = PERIODS.find((p) => p.key === dias) ?? PERIODS[1];
  const feed = await getActivity(period.days);

  return (
    <>
      <AdminHeader />
      <div className="admin-content">
        <div className="admin-content-head">
          <h1>Atividade</h1>
          <nav className="admin-tabs admin-tabs-inline">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/atividade?dias=${p.key}`}
                className={`admin-tab${p.key === period.key ? " admin-tab-active" : ""}`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="admin-hint">
          Tudo que foi feito no painel, com quem fez e quando: post, categoria
          e usuário. O histórico não pode ser editado nem apagado por ninguém,
          nem por aqui.
        </p>

        {!feed.available ? (
          <p className="admin-empty">
            Falta criar a tabela do registro. Rode{" "}
            <code>supabase/atividade.sql</code> no SQL Editor do Supabase.
          </p>
        ) : feed.entries.length === 0 ? (
          <p className="admin-empty">
            Nada registrado neste período. O registro começa a valer a partir de
            agora, então ações antigas não aparecem aqui.
          </p>
        ) : (
          <>
            {feed.truncated && (
              <p className="admin-hint">
                Mostrando as atividades mais recentes. O período escolhido tem
                mais registros do que cabe nesta tela.
              </p>
            )}
            <div className="admin-post-table">
              {feed.entries.map((e) => {
                const when = formatWhen(e.createdAt);
                return (
                  <div key={e.id} className="activity-row">
                    <span className={`activity-action activity-action-${e.action}`}>
                      {e.action}
                    </span>
                    <span className="activity-post">
                      <span className="activity-tipo">{TIPO[e.entity] ?? e.entity}</span>{" "}
                      {e.postId ? (
                        <Link href={`/admin/posts/${e.postId}`}>{e.label}</Link>
                      ) : (
                        e.label
                      )}
                      {e.details && (
                        <span className="activity-details"> {e.details}</span>
                      )}
                    </span>
                    <span className="activity-actor">{e.actorEmail}</span>
                    <time
                      className="activity-when"
                      dateTime={e.createdAt}
                      title={when.full}
                    >
                      {when.date}, {when.time}
                    </time>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
