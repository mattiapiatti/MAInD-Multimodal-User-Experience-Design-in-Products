"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { signIn } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";
import { DEMO_EMAIL, DEMO_FORM_PASSWORD } from "@/lib/demo";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import styles from "../auth.module.css";

function isLocalHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)
  );
}

export default function LoginPage() {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  // Local/LAN only: prefill Andrea's demo credentials for a one-tap sign-in.
  // In production the form stays empty and uses real authentication.
  useEffect(() => {
    if (isLocalHost()) {
      setValue("email", DEMO_EMAIL);
      setValue("password", DEMO_FORM_PASSWORD);
    }
  }, [setValue]);

  async function onSubmit(values) {
    setServerError("");

    // Local/LAN: password-less demo sign-in. The /api/dev-login route is gated
    // to local hosts (404 in production), so this path only works on a dev box.
    if (isLocalHost()) {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      if (!res.ok) {
        setServerError("Sign-in failed. Please try again.");
        return;
      }
      window.location.assign("/");
      return;
    }

    // Production: real email + password sign-in via Better Auth.
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(
        error.status === 401
          ? "Incorrect email or password."
          : "Sign-in failed. Please try again.",
      );
      return;
    }
    // Hard navigation so the server re-reads the fresh session cookie and routes
    // to /home or /onboarding.
    window.location.assign("/");
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your companion.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account? <Link href="/register">Sign up</Link>
      </p>
    </>
  );
}
