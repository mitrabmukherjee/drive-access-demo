"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERRORS = {
  Domain: "Sign in with an @steorasystems.com Google account.",
  OAuthSignin: "Could not start Google sign-in. Check the OAuth client settings.",
  OAuthCallback: "Google sign-in failed. Confirm the redirect URI is http://localhost:3000/api/auth/callback/google.",
  AccessDenied: "Access denied.",
  Configuration: "Auth is misconfigured. Check AUTH_SECRET and Google client env vars.",
  Default: "Sign-in failed. Try again.",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorMessage = errorKey ? ERRORS[errorKey] || ERRORS.Default : "";

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Steora demo
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Drive access demo</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sign in with Google. You will be asked for Drive access so this app can share
          files you own with whoever you assign.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800"
        >
          <GoogleLogo />
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Restricted to @steorasystems.com
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
