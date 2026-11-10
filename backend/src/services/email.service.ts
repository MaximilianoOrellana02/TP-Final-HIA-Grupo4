import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
    family: 4,
    connectionTimeout: 10000,
} as any);


export async function enviarEmailRecuperacion(destinatario: string, nombreCompleto: string, link: string) {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
    await transporter.sendMail({
        from: `"Sodería" <${process.env.GMAIL_USER}>`,
        to: destinatario,
        subject: 'Recuperar contraseña',
        html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0a5c63;">Recuperar contraseña</h2>
        <p>Hola ${escapeHtml(nombreCompleto)},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Si fuiste vos, tocá el siguiente botón:</p>
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #0e7c86; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
          Restablecer contraseña
        </a>
        <p style="color: #888; font-size: 13px;">Este link expira en 30 minutos. Si no fuiste vos, ignorá este email.</p>
      </div>
    `,
    });
}
