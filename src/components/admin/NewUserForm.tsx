"use client";

import { useActionState, useEffect, useRef } from "react";
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
    <button type="submit" className="btn-store" disabled={pending}>
      {pending ? "Cadastrando…" : "Cadastrar usuário"}
    </button>
  );
}

export default function NewUserForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Depois de cadastrar, limpa os campos: senão a senha de quem acabou de ser
  // criado fica visível na tela para a próxima pessoa que passar.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="user-form">
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
            required
          />
          <p className="field-hint">
            A senha aparece à mostra de propósito, para você conseguir copiar e
            mandar para a pessoa. Ela pode trocar depois.
          </p>
        </div>
      </div>

      {state.error && <p className="field-error">{state.error}</p>}
      {state.ok && <p className="field-success">{state.ok}</p>}

      <SubmitButton />
    </form>
  );
}
