import { z } from "zod";

/**
 * Shared validation schema for the contact/inquiry form — imported by both
 * the client form (react-hook-form) and the /api/contact route, so
 * server-side validation can never silently drift from the client's, per
 * the project's security rule to never trust client-side validation alone.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(2000),
  // Honeypot field — real users never fill this in; bots usually do.
  company: z.string().max(0, "").optional().or(z.literal("")),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
