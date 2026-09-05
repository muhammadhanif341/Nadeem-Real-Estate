import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";

/**
 * Inquiry form handler.
 *
 * TODO once real infrastructure is wired up:
 *  - Send a notification email to Nadeem and an auto-reply to the lead via
 *    Resend (RESEND_API_KEY, see .env.example).
 *  - Persist the inquiry to Supabase so it shows up in an agent dashboard.
 *  - Verify a Cloudflare Turnstile token before accepting the submission.
 *
 * Until those are configured this endpoint validates and logs server-side
 * only — it never trusts the client-side validation alone, per CLAUDE.md.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, {
      status: 400,
    });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Honeypot tripped — pretend success so bots don't learn anything, but
  // don't actually notify anyone.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  const { name, email, phone, message } = parsed.data;

  // TODO: replace with Resend + Supabase once configured.
  console.log("[contact] new inquiry", {
    name,
    email,
    phone: phone || null,
    message,
  });

  return NextResponse.json({ ok: true });
}
