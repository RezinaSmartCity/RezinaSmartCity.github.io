import nodemailer from "nodemailer";
import { logger } from "../../lib/logger";

interface ReportEmailParams {
  toEmail: string;
  toName: string;
  category: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  reporterName: string;
  reporterEmail?: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "noreply@rezina-civic.md";

  if (!host || !user || !pass) {
    logger.warn("SMTP not configured — email will be logged only");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  });
}

export async function sendReportEmail(params: ReportEmailParams): Promise<void> {
  const {
    toEmail,
    toName,
    category,
    title,
    description,
    address,
    latitude,
    longitude,
    reporterName,
    reporterEmail,
  } = params;

  const fromAddress = process.env.SMTP_FROM || "noreply@rezina-civic.md";
  const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const date = new Date().toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #1a237e; color: white; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 4px 0 0; opacity: 0.8; font-size: 14px; }
  .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 12px; font-size: 13px; margin-top: 8px; }
  .body { padding: 32px; }
  .field { margin-bottom: 20px; }
  .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .value { font-size: 15px; color: #222; line-height: 1.5; }
  .map-link { display: inline-block; background: #1565c0; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 8px; }
  .footer { background: #f5f5f5; padding: 16px 32px; font-size: 12px; color: #888; border-top: 1px solid #eee; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🏙️ Rezina Civic — Sesizare Nouă</h1>
    <p>Transmisă automat prin platforma de raportare urbană</p>
    <span class="badge">📋 ${category}</span>
  </div>
  <div class="body">
    <p>Stimate ${toName},<br>A fost înregistrată o nouă sesizare care necesită atenția dumneavoastră:</p>
    
    <div class="field">
      <div class="label">Titlu sesizare</div>
      <div class="value"><strong>${title}</strong></div>
    </div>
    
    <div class="field">
      <div class="label">Descriere</div>
      <div class="value">${description}</div>
    </div>
    
    <div class="field">
      <div class="label">Locație</div>
      <div class="value">${address}<br>Coordonate GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}<br>
      <a class="map-link" href="${mapsLink}" target="_blank">📍 Deschide în Google Maps</a></div>
    </div>
    
    <div class="field">
      <div class="label">Raportat de</div>
      <div class="value">${reporterName}${reporterEmail ? ` &lt;${reporterEmail}&gt;` : ""}</div>
    </div>
    
    <div class="field">
      <div class="label">Data și ora</div>
      <div class="value">${date}</div>
    </div>
  </div>
  <div class="footer">
    Acest email a fost generat automat de platforma Rezina Civic. 
    Nu răspundeți la acest mesaj.
  </div>
</div>
</body>
</html>
  `.trim();

  const subject = `[Rezina Civic] Sesizare: ${category} — ${title}`;

  logger.info(
    { toEmail, toName, category, title, latitude, longitude },
    "Sending report email"
  );

  const transport = createTransport();

  if (!transport) {
    // Log the email content for debugging when SMTP is not configured
    logger.info({ toEmail, subject, html: html.substring(0, 500) }, "Email not sent (SMTP not configured)");
    return;
  }

  await transport.sendMail({
    from: `"Rezina Civic" <${fromAddress}>`,
    to: `"${toName}" <${toEmail}>`,
    subject,
    html,
  });

  logger.info({ toEmail, subject }, "Report email sent successfully");
}
