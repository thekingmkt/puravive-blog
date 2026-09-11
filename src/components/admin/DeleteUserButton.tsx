"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { DeleteUserState } from "@/app/admin/actions";

type Action = (
  prevState: DeleteUserState,
  formData: FormData
) => Promise<DeleteUserState>;

const initialState: DeleteUserState = { error: null };

function Botao({ email, ehVoce }: { email: string; ehVoce: boolean }) {
  const { pending } = useFormStatus();

  if (ehVoce) {
    return (
      <span className="user-row-you" title="Você não pode remover a própria conta">
        você
      </span>
    );
  }

  return (
    <button
      type="submit"
      className="btn-danger-quiet"
      disabled={pending}
      onClick={(e) => {
        if (
          !confirm(
            `Remover ${email}? A pessoa perde o acesso ao painel na hora e não dá pra desfazer.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Removendo…" : "Remover"}
    </button>
  );
}

export default function DeleteUserButton({
  action,
  email,
  ehVoce,
}: {
  action: Action;
  email: string;
  ehVoce: boolean;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="user-row-action">
      <Botao email={email} ehVoce={ehVoce} />
      {state.error && <p className="field-error">{state.error}</p>}
    </form>
  );
}
