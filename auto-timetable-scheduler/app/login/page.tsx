"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  
async function handleGoogleLogin() {
  setLoading(true);
  setMessage("");

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
  } catch (err) {
    setMessage(
      err instanceof Error ? err.message : "Google login failed."
    );
    setLoading(false);
  }
}


  return (
    <main className="login-screen min-h-screen px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="login-layout mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <section className="login-story relative hidden min-h-[580px] overflow-hidden rounded-[32px] border border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="login-orbit login-orbit-one" aria-hidden="true" />
          <div className="login-orbit login-orbit-two" aria-hidden="true" />
          <div className="relative z-10">
            <p className="login-story-brand flex items-center gap-3 text-sm font-semibold tracking-[.2em]">
              <span className="login-mark grid h-10 w-10 place-items-center rounded-2xl" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </span>
              CHRONOS
            </p>
            <p className="login-story-kicker mt-20">YOUR CAMPUS, IN SYNC</p>
            <h2 className="login-story-title mt-4 max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-.055em] xl:text-6xl">
              Make room for what <em>matters.</em>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/70">
              Bring classes, rooms, and the time between them into one clear weekly plan.
            </p>
          </div>

          <div className="login-illustration login-campus-shot relative z-10 mx-auto w-full max-w-[440px]" aria-hidden="true">
            <Image src="/images/campus-study.jpg" alt="" fill sizes="40vw" />
            <span className="login-campus-label"><span className="login-campus-dot" /> A QUIETER PLACE TO FOCUS</span>
          </div>

          <div className="relative z-10 flex items-center gap-3 text-xs text-white/65">
            <span className="login-live-dot" /> Built around your real week, not a perfect one.
          </div>
        </section>

        <section className="login-card mx-auto w-full max-w-md rounded-[28px] border border-white/10 p-7 shadow-2xl sm:p-9">
        <div className="mb-8 text-center">
          <p className="login-brand text-sm tracking-[0.3em]">
            CHRONOS
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {mode === "login" ? "Pick up where your week left off." : "Set up your campus planner in a few steps."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="login-secondary w-full rounded-xl border px-4 py-3 font-medium disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="login-divider my-5 flex items-center gap-3 text-[10px] font-semibold tracking-[.12em]">
          <div className="h-px flex-1" />
          OR CONTINUE WITH EMAIL
          <div className="h-px flex-1" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <label className="login-field">
            <span>College email</span>
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />
          </label>

          <label className="login-field">
            <span>Password</span>
          <input
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={8}
            required
            placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="login-primary w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {message && (
          <p role="status" className="login-status mt-4 rounded-xl px-4 py-3 text-sm">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-white/65">
          {mode === "login"
            ? "New to Chronos? "
            : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            className="login-switch font-semibold hover:text-white"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </section>
      </div>
    </main>
  );
}
