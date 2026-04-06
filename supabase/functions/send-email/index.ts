/**
 * Send Email Edge Function — Resend dispatcher for transactional emails.
 *
 * Templates are plain text with consistent branding.
 * From address matches the waitlist emails (team@stagent.io).
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Stagent <team@stagent.io>";

const FOOTER = `--
Stagent | stagent.io
The operating system for AI-native business`;

interface EmailRequest {
  template: string;
  to: string;
  data: Record<string, unknown>;
}

const TEMPLATES: Record<string, (data: Record<string, unknown>) => { subject: string; text: string }> = {
  "welcome-install": (data) => ({
    subject: `Welcome to Stagent ${data.tier ?? ""} — You're In`,
    text: `Hi,

Thanks for subscribing to Stagent ${data.tier ?? ""}. Your AI agents
just got a serious upgrade.

Get started in one command:

  npx stagent

When it launches, go to Settings and sign in with this email
address. Your ${data.tier ?? ""} features will activate automatically —
expanded memory, longer history, and everything that comes
with your plan.

No license key needed. Just sign in and go.

If you have any questions, reply to this email.

${FOOTER}`,
  }),

  "upgrade-confirmation": (data) => ({
    subject: `You're now on Stagent ${data.tier ?? ""}`,
    text: `Hi,

Your Stagent subscription has been upgraded to ${data.tier ?? ""}.

Here's what just unlocked:
${data.tier === "operator" || data.tier === "Operator" ? `
  - ROI analytics dashboard
  - Encrypted cloud sync & backup
  - Marketplace publishing (70/30 revenue split)
  - 500 agent memories per profile
  - 50 active schedules
  - 1-year execution history
` : data.tier === "scale" || data.tier === "Scale" ? `
  - Everything in Operator
  - Unlimited memories & schedules
  - Unlimited history retention
  - Featured marketplace listings (80/20 split)
  - Priority support
` : `
  - 200 agent memories per profile
  - 20 active schedules
  - 180-day execution history
  - Marketplace blueprint imports
`}
Open Stagent and go to Settings to see your expanded limits.
Your features are already active.

${FOOTER}`,
  }),

  "memory-warning": (data) => ({
    subject: `Heads up — ${data.profileName ?? "your agent"} is running low on memory`,
    text: `Hi,

Your agent profile "${data.profileName ?? ""}" has used ${data.current ?? 0}
of ${data.limit ?? 0} available memories.

When you hit the limit, your agent will still run tasks — but it
won't be able to store new memories until you free up space or
upgrade your plan.

You can:

  1. Archive old memories you no longer need
  2. Upgrade your plan for more capacity

Manage your plan:
  Open Stagent → Settings → Subscription

${FOOTER}`,
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
        to: [to],
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
