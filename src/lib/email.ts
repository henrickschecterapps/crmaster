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
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "ÚLTIMO QUADRO <onboarding@resend.dev>";
  const usingResendSandbox = resendFrom.includes("onboarding@resend.dev");

  // Prefer Gmail SMTP whenever configured (especially if Resend is on sandbox sender)
  if (gmailUser && gmailPass && (!resendKey || usingResendSandbox)) {
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

  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: resendFrom,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      if (error) {
        // Fallback to Gmail SMTP if available when Resend rejects recipient
        if (gmailUser && gmailPass) {
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
        }
        return {
          ok: false,
          provider: "resend",
          error: error.message || "Resend recusou o envio.",
        };
      }
      return { ok: true, provider: "resend" };
    } catch (err) {
      return {
        ok: false,
        provider: "resend",
        error: err instanceof Error ? err.message : "Erro Resend",
      };
    }
  }

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

  return { ok: false, error: "Nenhum provedor de e-mail configurado." };
}

export function isAnyEmailProviderConfigured(): boolean {
  return Boolean(
    (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()) ||
      process.env.RESEND_API_KEY?.trim()
  );
}
