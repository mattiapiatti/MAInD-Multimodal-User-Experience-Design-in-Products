import { z } from "zod";

export const CARE_CONTEXTS = [
  { value: "gender_affirming", label: "Gender-affirming therapy" },
  { value: "menopause", label: "Menopause / HRT" },
  { value: "contraception", label: "Contraception" },
  { value: "pcos", label: "PCOS" },
  { value: "endometriosis", label: "Endometriosis" },
  { value: "other", label: "Other" },
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
  pronouns: z.string().trim().max(40).optional().or(z.literal("")),
  careContext: z.enum([
    "gender_affirming",
    "menopause",
    "contraception",
    "pcos",
    "endometriosis",
    "other",
  ]),
  goals: z.array(z.string()).default([]),
  trackedSymptoms: z.array(z.string()).default([]),
  therapyStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  language: z.enum(["it", "en"]).default("en"),
});
