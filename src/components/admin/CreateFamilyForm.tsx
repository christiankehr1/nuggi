"use client";

import { useActionState } from "react";
import { createFamilyAction, type CreateFamilyState } from "@/actions/admin";
import { de } from "@/i18n/de";

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState<CreateFamilyState, FormData>(
    createFamilyAction,
    {},
  );
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="text-lg font-semibold">{de.admin.createFamily}</h2>
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input
          name="name"
          className="input flex-1"
          placeholder={de.admin.familyNamePlaceholder}
          required
          minLength={2}
        />
        <input name="timezone" className="input sm:w-48" defaultValue="Europe/Zurich" />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? de.common.loading : de.admin.create}
        </button>
      </form>
      {state.error ? <p className="text-sm text-coral">{state.error}</p> : null}
      {state.created ? (
        <div className="rounded-2xl bg-mint-soft p-4">
          <p className="text-sm text-muted">{state.created.name}</p>
          <p className="num my-1 text-3xl font-bold tracking-[0.15em]">{state.created.code}</p>
          <p className="text-sm text-mint">{de.admin.codeOnce}</p>
        </div>
      ) : null}
    </section>
  );
}
