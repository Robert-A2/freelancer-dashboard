import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface DigestEmailData {
  to: string;
  firstName: string;
  period: string;
  income: string;
  expenses: string;
  cashflow: string;
  cashflowPositive: boolean;
  insightLine: string | null;
  clientAlerts: { name: string; daysSince: number }[];
  unsubscribeUrl: string;
  appUrl: string;
}

function buildDigestHtml(d: DigestEmailData): string {
  const cashflowClass = d.cashflowPositive ? "pos" : "neg";

  const insightHtml = d.insightLine
    ? `<div class="insight">${d.insightLine}</div>`
    : "";

  const alertsHtml = d.clientAlerts
    .slice(0, 2)
    .map(
      (c) =>
        `<div class="alert">⏱ <strong>${c.name}</strong> has not paid in ${c.daysSince} days. Worth a follow up.</div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 16px; }
  .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .top { background: #0D2137; padding: 20px 28px; }
  .app-name { color: #4CC4A4; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .body { padding: 28px; }
  .greeting { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .period { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
  .numbers { display: flex; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
  .num { flex: 1; padding: 16px 10px; text-align: center; border-right: 1px solid #e5e7eb; }
  .num:last-child { border-right: none; }
  .num-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .num-value { font-size: 17px; font-weight: 700; color: #111827; }
  .num-value.pos { color: #059669; }
  .num-value.neg { color: #dc2626; }
  .insight { background: #f0fdf9; border-left: 3px solid #4CC4A4; padding: 12px 14px; border-radius: 0 8px 8px 0; margin-bottom: 16px; font-size: 14px; color: #374151; line-height: 1.6; }
  .alert { background: #fffbeb; border-left: 3px solid #d97706; padding: 12px 14px; border-radius: 0 8px 8px 0; margin-bottom: 10px; font-size: 13px; color: #92400e; line-height: 1.5; }
  .alert strong { color: #78350f; }
  .cta-wrap { margin: 24px 0 4px; }
  .cta { display: block; background: #0D2137; color: #4CC4A4; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 600; font-size: 14px; }
  .footer { padding: 18px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; }
  .footer-text { font-size: 11px; color: #9ca3af; line-height: 1.8; }
  .unsub { color: #9ca3af; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="top"><div class="app-name">Freelancer OS</div></div>
  <div class="body">
    <div class="greeting">Hi ${d.firstName},</div>
    <div class="period">Here's how ${d.period} is looking.</div>
    <div class="numbers">
      <div class="num">
        <div class="num-label">Income</div>
        <div class="num-value pos">${d.income}</div>
      </div>
      <div class="num">
        <div class="num-label">Expenses</div>
        <div class="num-value">${d.expenses}</div>
      </div>
      <div class="num">
        <div class="num-label">Net</div>
        <div class="num-value ${cashflowClass}">${d.cashflow}</div>
      </div>
    </div>
    ${insightHtml}
    ${alertsHtml}
    <div class="cta-wrap">
      <a href="${d.appUrl}/dashboard" class="cta">See your full picture →</a>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">
      You're receiving this because you opted in to the Freelancer OS weekly digest.<br>
      <a href="${d.unsubscribeUrl}" class="unsub">Unsubscribe</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function sendDigestEmail(data: DigestEmailData): Promise<void> {
  await resend.emails.send({
    from: "Freelancer OS <digest@mail.freelanceros.app>",
    to: data.to,
    subject: `Your money this month, ${data.firstName}`,
    html: buildDigestHtml(data),
  });
}
