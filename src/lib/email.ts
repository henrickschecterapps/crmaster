import nodemailer from "nodemailer";
import { Resend } from "resend";

export async function sendEmailNotification(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: `ÚLTIMO QUADRO <${gmailUser}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { ok: true, provider: "gmail" };
    } catch (err) {
      return {
        ok: false,
        provider: "gmail",
        error: err instanceof Error ? err.message : "Erro Gmail SMTP",
      };
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const from =
        process.env.RESEND_FROM_EMAIL?.trim() ||
        "ÚLTIMO QUADRO <onboarding@resend.dev>";
      await resend.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { ok: true, provider: "resend" };
    } catch (err) {
      return {
        ok: false,
        provider: "resend",
        error: err instanceof Error ? err.message : "Erro Resend",
      };
    }
  }

  return { ok: false, error: "Nenhum provedor de e-mail configurado." };
}
