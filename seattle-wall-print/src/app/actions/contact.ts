"use server";

import { site } from "@/lib/site";
import { Resend } from "resend";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please add your name."),
  email: z.string().trim().email("Valid email required."),
  organization: z.string().trim().optional(),
  location: z.string().trim().min(2, "Where is the wall?"),
  wallDetails: z.string().trim().optional(),
  timeline: z.string().trim().optional(),
  budget: z.string().trim().optional(),
  message: z.string().trim().min(10, "Tell us a bit more—at least 10 characters."),
});

export type ContactState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function submitContact(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const hp = String(formData.get("company_website") ?? "");
  if (hp.length > 0) {
    return { status: "success", message: "Thanks — we'll be in touch shortly." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    organization: formData.get("organization") || undefined,
    location: formData.get("location"),
    wallDetails: formData.get("wallDetails") || undefined,
    timeline: formData.get("timeline") || undefined,
    budget: formData.get("budget") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(" ");
    return { status: "error", message };
  }

  const data = parsed.data;
  const inbox = process.env.CONTACT_INBOX_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const apiKey = process.env.RESEND_API_KEY;

  const bodyText = [
    `New lead from ${site.name}`,
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Organization: ${data.organization ?? "—"}`,
    `Location: ${data.location}`,
    `Wall / dimensions: ${data.wallDetails ?? "—"}`,
    `Timeline: ${data.timeline ?? "—"}`,
    `Budget band: ${data.budget ?? "—"}`,
    "",
    "Message:",
    data.message,
  ].join("\n");

  if (!apiKey || !inbox) {
    console.warn("[contact] RESEND_API_KEY or CONTACT_INBOX_EMAIL missing — lead not emailed");
    if (process.env.NODE_ENV === "development") {
      console.info(bodyText);
      return {
        status: "success",
        message:
          "Development mode: form validated and logged to the server console. Configure Resend to send email.",
      };
    }
    return {
      status: "error",
      message:
        "We could not deliver your message yet. Please call us or email " + site.email + " directly.",
    };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: inbox,
    replyTo: data.email,
    subject: `Wall print inquiry — ${data.name}`,
    text: bodyText,
  });

  if (error) {
    console.error("[contact] Resend error", error);
    return {
      status: "error",
      message: "Something went wrong sending your note. Please try calling us instead.",
    };
  }

  return {
    status: "success",
    message: "Thanks — we received your project details and will follow up shortly.",
  };
}
