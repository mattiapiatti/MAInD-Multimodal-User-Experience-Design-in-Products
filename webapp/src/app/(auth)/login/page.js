"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { signIn } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values) {
    setServerError("");
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError("Incorrect email or password.");
      return;
    }
    // Hard navigation so the server re-reads the fresh session cookie and routes
    // to /home or /onboarding. (router.push + refresh race and can stall.)
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
