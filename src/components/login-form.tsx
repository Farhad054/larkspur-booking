"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  return (
    <form action={action} className="mt-6 grid gap-4">
      <div>
        <label htmlFor="password" className="mb-1 block font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div role="alert" aria-live="assertive">
        {state.error && (
          <p id="login-error" className="field-error !mt-0 font-semibold">
            {state.error}
          </p>
        )}
        {!configured && !state.error && (
          <p className="field-error !mt-0">
            ADMIN_PASSWORD is not set on the server.
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
