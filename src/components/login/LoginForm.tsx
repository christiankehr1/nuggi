"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";
import { de } from "@/i18n/de";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="card flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.login.codeLabel}</span>
        <input
          name="code"
          className="input num text-center text-2xl font-semibold uppercase tracking-[0.2em]"
          placeholder={de.login.codePlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={9}
          defaultValue={state.code ?? ""}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.login.nameLabel}</span>
        <input
          name="name"
          className="input"
          placeholder={de.login.namePlaceholder}
          autoComplete="nickname"
          maxLength={40}
          defaultValue={state.name ?? ""}
          required
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary mt-2 w-full text-lg" disabled={pending}>
        {pending ? de.common.loading : de.login.submit}
      </button>
    </form>
  );
}
