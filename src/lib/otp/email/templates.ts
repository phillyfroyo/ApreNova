// src/lib/otp/email/templates.ts
// Email templates for OTP authentication

type Language = 'en' | 'es';

interface OtpEmailContent {
  subject: string;
  html: string;
  text: string;
}

const OTP_EXPIRY_MINUTES = 10;

export function getOtpEmailContent(code: string, lang: Language = 'en'): OtpEmailContent {
  const content = {
    en: {
      subject: `${code} is your Cuentana login code`,
      greeting: 'Hi there!',
      intro: 'You requested a login code for Cuentana.',
      codeLabel: 'Your code is:',
      expiry: `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      ignore: "If you didn't request this code, you can safely ignore this email.",
      footer: 'Happy learning!',
      team: 'The Cuentana Team',
    },
    es: {
      subject: `${code} es tu código de acceso a Cuentana`,
      greeting: '¡Hola!',
      intro: 'Solicitaste un código de acceso para Cuentana.',
      codeLabel: 'Tu código es:',
      expiry: `Este código expira en ${OTP_EXPIRY_MINUTES} minutos.`,
      ignore: 'Si no solicitaste este código, puedes ignorar este mensaje.',
      footer: '¡Feliz aprendizaje!',
      team: 'El equipo de Cuentana',
    },
  };

  const t = content[lang];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                Cuentana
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                ${t.greeting}
              </p>
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.5;">
                ${t.intro}
              </p>

              <!-- Code Box -->
              <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  ${t.codeLabel}
                </p>
                <p style="margin: 0; color: #111827; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">
                  ${code}
                </p>
              </div>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                ${t.expiry}
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                ${t.ignore}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 4px; color: #374151; font-size: 14px;">
                ${t.footer}
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">
                ${t.team}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${t.greeting}

${t.intro}

${t.codeLabel} ${code}

${t.expiry}

${t.ignore}

${t.footer}
${t.team}
  `.trim();

  return {
    subject: t.subject,
    html,
    text,
  };
}
