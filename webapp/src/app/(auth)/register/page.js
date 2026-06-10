"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { signUp } from "@/lib/auth/client";
import { registerSchema } from "@/lib/validation/auth";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values) {
    setServerError("");
    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(
        error.message?.includes("exist")
          ? "An account with this email already exists."
          : "Sign-up failed. Please try again.",
      );
      return;
    }
    // No email verification in the prototype → land straight on onboarding.
    // Hard navigation so the server sees the new session cookie immediately.
    window.location.assign("/onboarding");
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          It only takes a few seconds. Then we&apos;ll set up your companion
          together.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}

        <TextField
          label="Your name"
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
          {...register("name")}
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register("consent")} />
          <span>
            I consent to the processing of my health data so the companion can
            work. It stays on my device.
          </span>
        </label>
        {errors.consent ? (
          <span className={styles.checkError}>{errors.consent.message}</span>
        ) : null}

        <Button type="submit" fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className={styles.footer}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
