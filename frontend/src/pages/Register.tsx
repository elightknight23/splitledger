import { AtSign, Loader2, Lock, User, UserPlus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="paper-bg flex min-h-screen items-center justify-center bg-surface p-4">
      <main className="relative w-full max-w-[420px]">
        <div className="hard-shadow relative border-2 border-on-surface bg-surface-container-low p-8 sm:p-10">
          <div className="paper-clip" aria-hidden="true" />

          <header className="mb-10 text-center">
            <h1 className="font-headline text-3xl font-bold">SplitLedger</h1>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-on-surface" />
              <span className="label-caps text-on-surface-variant">New Member Form</span>
              <span className="h-px w-8 bg-on-surface" />
            </div>
          </header>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
            {error && (
              <p className="border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
                {error}
              </p>
            )}

            <div className="flex flex-col space-y-1">
              <label
                className="label-caps flex items-center gap-1.5 text-on-surface-variant"
                htmlFor="name"
              >
                <User className="h-3.5 w-3.5" />
                Display_Name:
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="border-b-2 border-on-surface bg-transparent p-2 font-body placeholder:text-outline-variant focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label
                className="label-caps flex items-center gap-1.5 text-on-surface-variant"
                htmlFor="email"
              >
                <AtSign className="h-3.5 w-3.5" />
                User_Identifier:
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="border-b-2 border-on-surface bg-transparent p-2 font-body placeholder:text-outline-variant focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label
                className="label-caps flex items-center gap-1.5 text-on-surface-variant"
                htmlFor="password"
              >
                <Lock className="h-3.5 w-3.5" />
                Pass_Key:
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="border-b-2 border-on-surface bg-transparent p-2 font-body placeholder:text-outline-variant focus:border-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="hard-shadow-sm btn-press flex w-full items-center justify-center gap-2 border-2 border-on-surface bg-primary py-3.5 font-headline text-lg font-bold uppercase text-on-primary disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {isSubmitting ? "Registering…" : "Register"}
            </button>
          </form>

          <footer className="mt-10 border-t-2 border-dashed border-outline-variant pt-6 text-center">
            <p className="mb-4 font-body text-on-surface-variant">Already in the ledger?</p>
            <Link
              to="/login"
              className="label-caps inline-block rotate-1 border-2 border-primary px-4 py-2 text-primary transition-colors hover:bg-primary hover:text-on-primary"
            >
              Log_In
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
