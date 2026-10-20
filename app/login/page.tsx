
"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Shield } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // AuthContext records failed attempts when login fails.
      const result = await login(email.trim(), password);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.role === "admin") {
        router.replace("/admin");
      } else if (result.role === "user") {
        router.replace("/user");
      } else {
        setError("Your account role could not be verified.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white">
            <Shield size={24} />
          </div>

          <h1 className="text-2xl font-bold">Welcome to Nexus</h1>

          <p className="mt-2 text-sm text-gray-500">
            Sign in to your security operations account
          </p>
        </div>

        {searchParams.get("registered") === "true" && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Registration successful. Confirm your email if required, then sign in.
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email
            </label>

            <div className="relative">
              <Mail
                size={18}
                aria-hidden="true"
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
                className="w-full rounded-lg border py-2.5 pl-10 pr-3 outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                aria-hidden="true"
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border py-2.5 pl-10 pr-3 outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-gray-600 hover:text-black"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link href="/signup" className="font-medium text-black">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <p className="text-sm text-gray-500">Loading login...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
