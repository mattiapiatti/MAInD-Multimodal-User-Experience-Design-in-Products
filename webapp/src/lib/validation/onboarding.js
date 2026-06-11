import { z } from "zod";

export const CARE_CONTEXTS = [
  { value: "gender_affirming", label: "Gender-affirming therapy" },
  { value: "menopause", label: "Menopause / HRT" },
  { value: "contraception", label: "Contraception" },
  { value: "pmos", label: "PMOS" },
  { value: "endometriosis", label: "Endometriosis" },
  { value: "other", label: "Other" },
];

// Preset pronoun choices shown in the selector. "Custom…" lets the user type
// their own; "Prefer not to say" keeps it inclusive while staying required.
export const PRONOUN_PRESETS = ["She/Her", "He/Him", "They/Them"];
export const PRONOUN_PREFER_NOT = "Prefer not to say";

// How the hormone/medication is taken.
export const METHOD_OPTIONS = [
  { value: "gel", label: "Gel" },
  { value: "injection", label: "Injection" },
  { value: "pill", label: "Pill" },
  { value: "patch", label: "Patch" },
  { value: "nothing", label: "Nothing" },
];

// Where the person is in their therapy.
export const STAGE_OPTIONS = [
  { value: "starting", label: "Starting" },
  { value: "few_months", label: "A few months in" },
  { value: "further", label: "Further along" },
];

export const GOAL_OPTIONS = [
  { value: "track_symptoms", label: "Track symptoms over time" },
  { value: "understand_changes", label: "Understand changes in my body" },
  { value: "prepare_appointments", label: "Prepare for appointments" },
  { value: "emotional_support", label: "Support in difficult moments" },
];

export const SYMPTOM_OPTIONS = [
  "Hot flashes",
  "Mood swings",
  "Fatigue",
  "Headaches",
  "Sleep changes",
  "Skin changes",
  "Pain",
  "Bleeding",
];

export const onboardingSchema = z.object({
  preferredName: z.string().trim().min(1, "Enter a name").max(60),
  pronouns: z.string().trim().min(1, "Select your pronouns").max(60),
  careContext: z.enum([
    "gender_affirming",
    "menopause",
    "contraception",
    "pmos",
    "endometriosis",
    "other",
  ]),
  hormoneMethod: z.enum(["gel", "injection", "pill", "patch", "nothing"]),
  stage: z.enum(["starting", "few_months", "further"]),
  goals: z.array(z.string()).default([]),
  trackedSymptoms: z.array(z.string()).default([]),
  therapyStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  language: z.enum(["it", "en"]).default("en"),
});
