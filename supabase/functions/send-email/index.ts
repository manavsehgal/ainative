/**
 * Send Email Edge Function — generic Resend dispatcher.
 *
 * Accepts a template ID and dynamic data, renders and sends via Resend API.
 * Templates are simple text-based emails (no HTML builder for V1).
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Stagent <noreply@stagent.io>";

interface EmailRequest {
  template: string;
  to: string;
  data: Record<string, unknown>;
}

const TEMPLATES: Record<string, (data: Record<string, unknown>) => { subject: string; text: string }> = {
  "welcome-install": (data) => ({
    subject: "Welcome to Stagent — Install Instructions",
    text: `Welcome to Stagent ${data.tier ?? ""} tier!

Get started:
  npx stagent

Sign in with this email address (${data.to ?? ""}) to activate your subscription.

Your premium features will activate automatically when you sign in.

— The Stagent Team`,
  }),

  "upgrade-confirmation": (data) => ({
    subject: `Stagent ${data.tier ?? ""} — Upgrade Confirmed`,
    text: `Your Stagent subscription has been upgraded to ${data.tier ?? ""}.

Your premium features are now active. Open Stagent to see your expanded limits:
  http://localhost:3000/settings

— The Stagent Team`,
  }),

  "memory-warning": (data) => ({
    subject: `Stagent — Memory limit approaching for ${data.profileName ?? "profile"}`,
    text: `Your agent profile "${data.profileName ?? ""}" has ${data.current ?? 0} of ${data.limit ?? 0} memories used.

When you reach the limit, new memories won't be stored until you upgrade or archive existing ones.

Manage your subscription:
  http://localhost:3000/settings

— The Stagent Team`,
  }),
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body: EmailRequest = await req.json();
  const { template, to, data } = body;

  const templateFn = TEMPLATES[template];
  if (!templateFn) {
    return new Response(
      JSON.stringify({ error: `Unknown template: ${template}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { subject, text } = templateFn({ ...data, to });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(
        JSON.stringify({ error: `Resend error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
