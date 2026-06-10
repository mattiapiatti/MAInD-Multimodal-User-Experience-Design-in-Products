import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
    consent: z.literal(true, {
      errorMap: () => ({ message: "You must accept to continue" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
