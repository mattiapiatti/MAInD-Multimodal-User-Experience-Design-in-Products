"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { onboardingSchema } from "@/lib/validation/onboarding";
import {
  CARE_CONTEXTS,
  GOAL_OPTIONS,
  SYMPTOM_OPTIONS,
} from "@/lib/validation/onboarding";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import styles from "./OnboardingForm.module.css";

function ChipGroup({ options, value = [], onChange, columns = 1 }) {
  const set = new Set(value);
  const toggle = (v) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange([...next]);
  };
  return (
    <div
      className={styles.chips}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {options.map((opt) => {
        const v = opt.value ?? opt;
        const label = opt.label ?? opt;
        const active = set.has(v);
        return (
          <button
            type="button"
            key={v}
            className={`${styles.chip} ${active ? styles.chipActive : ""}`}
            onClick={() => toggle(v)}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RadioCards({ options, value, onChange }) {
  return (
    <div className={styles.radioList}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            className={`${styles.radioCard} ${active ? styles.radioActive : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
          >
            <span className={styles.radioDot} aria-hidden="true" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const STEPS = [
  { title: "What's your name", fields: ["preferredName", "pronouns"] },
  { title: "Your journey", fields: ["careContext"] },
  { title: "What matters to you", fields: ["goals", "trackedSymptoms"] },
  { title: "Last details", fields: ["therapyStartDate", "language"] },
];

/**
 * @param {{
 *   defaultValues?: object,
 *   wizard?: boolean,
 *   submitLabel?: string,
 *   onSubmit: (values:object) => Promise<{ok:boolean, errors?:object}>,
 * }} props
 */
export default function OnboardingForm({
  defaultValues,
  wizard = false,
  submitLabel = "Save",
  onSubmit,
}) {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      preferredName: "",
      pronouns: "",
      careContext: undefined,
      goals: [],
      trackedSymptoms: [],
      therapyStartDate: "",
      language: "en",
      ...defaultValues,
    },
  });

  const isLast = step === STEPS.length - 1;

  async function next() {
    const ok = await trigger(STEPS[step].fields);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit(values) {
    setServerError("");
    setSaved(false);
    // The onboarding action redirects server-side on success, so execution only
    // continues here when it returns (validation error) or in edit mode (save).
    const res = await onSubmit(values);
    if (res && res.ok === false) {
      setServerError("Check the fields and try again.");
      return;
    }
    setSaved(true);
  }

  // ---- field blocks, shown either per-step (wizard) or all at once (edit) ----
  const blocks = {
    preferredName: (
      <div className={styles.block} key="name">
        <TextField
          label="Name the companion will use"
          placeholder="e.g. Sam"
          error={errors.preferredName?.message}
          {...register("preferredName")}
        />
        <TextField
          label="Pronouns (optional)"
          placeholder="e.g. she/her, he/him, they/them"
          error={errors.pronouns?.message}
          {...register("pronouns")}
        />
      </div>
    ),
    careContext: (
      <div className={styles.block} key="care">
        <p className={styles.fieldLabel}>What's your journey?</p>
        <Controller
          control={control}
          name="careContext"
          render={({ field }) => (
            <RadioCards
              options={CARE_CONTEXTS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.careContext ? (
          <span className={styles.err}>Select an option</span>
        ) : null}
      </div>
    ),
    goals: (
      <div className={styles.block} key="goals">
        <p className={styles.fieldLabel}>What do you want to get out of it?</p>
        <Controller
          control={control}
          name="goals"
          render={({ field }) => (
            <ChipGroup
              options={GOAL_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    ),
    trackedSymptoms: (
      <div className={styles.block} key="symptoms">
        <p className={styles.fieldLabel}>Symptoms to track (optional)</p>
        <Controller
          control={control}
          name="trackedSymptoms"
          render={({ field }) => (
            <ChipGroup
              options={SYMPTOM_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              columns={2}
            />
          )}
        />
      </div>
    ),
    therapyStartDate: (
      <div className={styles.block} key="date">
        <TextField
          label="Therapy start (optional)"
          type="date"
          error={errors.therapyStartDate?.message}
          {...register("therapyStartDate")}
        />
        <div>
          <p className={styles.fieldLabel}>Companion language</p>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <RadioCards
                options={[
                  { value: "en", label: "English" },
                  { value: "it", label: "Italiano" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
    ),
  };

  if (!wizard) {
    // Edit mode: everything in one scroll, single save.
    return (
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}
        {saved ? <Alert tone="success">Changes saved.</Alert> : null}
        {Object.values(blocks)}
        <Button type="submit" fullWidth loading={isSubmitting}>
          {submitLabel}
        </Button>
      </form>
    );
  }

  // Wizard mode: step header + progress + per-step fields.
  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      <div className={styles.progress}>
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i <= step ? styles.dotOn : ""}`}
          />
        ))}
      </div>
      <h2 className={styles.stepTitle}>{STEPS[step].title}</h2>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}

      {STEPS[step].fields.map((f) => blocks[f])}

      <div className={styles.nav}>
        {step > 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        {isLast ? (
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            Next
          </Button>
        )}
      </div>
    </form>
  );
}
