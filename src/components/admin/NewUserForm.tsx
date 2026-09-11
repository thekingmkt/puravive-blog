"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { NewUserState } from "@/app/admin/actions";

type Action = (
  prevState: NewUserState,
  formData: FormData
) => Promise<NewUserState>;

const initialState: NewUserState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-store btn-store--yellow" disabled={pending}>
      {pending ? "Cadastrando…" : "Cadastrar usuário"}
    </button>
  );
}

export default function NewUserForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialState);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  // O que foi realmente cadastrado, congelado no momento do sucesso.
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(
    null
  );
  const enviando = useRef<{ email: string; senha: string }>({
    email: "",
    senha: "",
  });

  useEffect(() => {
    if (state.ok) {
      setCriado({ ...enviando.current });
      setEmail("");
      setSenha("");
    }
  }, [state.ok]);

  if (criado) {
    return (
      <div className="user-created">
        <p className="user-created-title">Usuário cadastrado</p>
        <dl className="user-created-data">
          <div>
            <dt>E-mail</dt>
            <dd>{criado.email}</dd>
          </div>
          <div>
            <dt>Senha</dt>
            <dd>{criado.senha}</dd>
          </div>
        </dl>
        <p className="field-hint">
          Manda esses dois dados para a pessoa. A senha não aparece de novo
          depois que você sair desta tela, então copie agora se precisar.
        </p>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setCriado(null)}
        >
          Cadastrar outro usuário
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="user-form"
      onSubmit={() => {
        enviando.current = { email, senha };
      }}
    >
      <div className="user-form-fields">
        <div className="field">
          <label className="field-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="rodrigo@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="text"
            autoComplete="off"
            minLength={8}
            placeholder="mínimo de 8 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <p className="field-hint">
            A senha aparece à mostra de propósito, para você conseguir copiar e
            mandar para a pessoa. Ela pode trocar depois.
          </p>
        </div>
      </div>

      {state.error && <p className="field-error">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
