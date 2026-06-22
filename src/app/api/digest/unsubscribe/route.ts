import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function html(title: string, body: string) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f3f4f6;}
.card{background:#fff;padding:40px;border-radius:12px;text-align:center;max-width:420px;border:1px solid #e5e7eb;}
h1{font-size:20px;color:#111827;margin:0 0 8px;} p{color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;} a{color:#0D2137;font-size:14px;}</style>
</head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return html("Invalid link", "<p>This unsubscribe link is invalid.</p>");
  }

  const user = await prisma.user.findUnique({
    where: { digestUnsubscribeToken: token },
    select: { id: true },
  });

  if (!user) {
    return html(
      "Already unsubscribed",
      "<p>You've already been removed from the weekly digest, or this link has expired.</p>" +
        (APP_URL ? `<a href="${APP_URL}/settings">Back to Settings</a>` : "")
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { weeklyDigestOptIn: false },
  });

  return html(
    "You're unsubscribed.",
    "<p>You won't receive weekly digest emails anymore. You can re-enable them anytime in Settings.</p>" +
      (APP_URL ? `<a href="${APP_URL}/settings">Back to Settings</a>` : "")
  );
}
