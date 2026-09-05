"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormValues } from "@/lib/contact-schema";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "", company: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      {/* Honeypot — hidden from real visitors via CSS, not display:none, so
          screen readers and simple bots that check visibility still see a
          field to fill in. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("company")}
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className="w-full rounded-sm border border-border bg-bg px-4 py-2.5 text-sm"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-error">{errors.name.message}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-sm border border-border bg-bg px-4 py-2.5 text-sm"
          {...register("email")}
        />
        {errors.email ? (
          <p className="mt-1 text-xs text-error">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold">
          Phone <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          className="w-full rounded-sm border border-border bg-bg px-4 py-2.5 text-sm"
          {...register("phone")}
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1.5 block text-sm font-semibold"
        >
          What are you looking for?
        </label>
        <textarea
          id="message"
          rows={4}
          className="w-full rounded-sm border border-border bg-bg px-4 py-2.5 text-sm"
          {...register("message")}
        />
        {errors.message ? (
          <p className="mt-1 text-xs text-error">{errors.message.message}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 inline-flex items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-6 py-3.5 text-sm font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Send Inquiry"}
      </button>

      <p role="status" className="text-sm">
        {status === "sent" ? (
          <span className="text-success">
            Thanks — Nadeem will get back to you shortly.
          </span>
        ) : null}
        {status === "error" ? (
          <span className="text-error">
            Something went wrong. Please try again, or call{" "}
            <a href="tel:+923339357378" className="underline">
              +92 333 9357378
            </a>{" "}
            directly.
          </span>
        ) : null}
      </p>
    </form>
  );
}
