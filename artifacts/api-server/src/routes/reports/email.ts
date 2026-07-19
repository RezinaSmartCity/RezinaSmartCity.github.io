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
  reportId: number;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn("SMTP not configured — email will be logged only");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
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
    reportId,
  } = params;

  const fromAddress = process.env.SMTP_FROM || "noreply@rezina-civic.md";
  const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const date = new Date().toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateTime = new Date().toLocaleString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Legal petition structure per Legea RM nr. 190/1994 cu privire la petiționare
  const html = `
<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Times New Roman", Times, serif; background: #f0f0f0; margin: 0; padding: 20px; font-size: 14px; line-height: 1.6; color: #111; }
  .page { max-width: 680px; margin: 0 auto; background: white; padding: 48px 56px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
  .header-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #1a237e; }
  .logo-text { font-size: 11px; color: #555; line-height: 1.3; }
  .logo-title { font-size: 16px; font-weight: bold; color: #1a237e; }
  .badge-ref { font-family: Arial, sans-serif; font-size: 11px; color: #888; text-align: right; margin-bottom: 24px; }
  .to-block { text-align: right; margin-bottom: 32px; }
  .to-block .label { font-size: 11px; color: #666; text-transform: uppercase; }
  .to-block .authority { font-weight: bold; font-size: 15px; }
  .subject-block { text-align: center; margin: 32px 0; }
  .subject-block .doc-type { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
  .subject-block .doc-subject { font-size: 13px; color: #444; margin-top: 4px; }
  .body-text { text-align: justify; margin-bottom: 16px; }
  .indent { text-indent: 2em; }
  .section-label { font-weight: bold; margin-top: 24px; margin-bottom: 4px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; color: #1a237e; }
  .info-box { background: #f8f8f8; border-left: 3px solid #1a237e; padding: 12px 16px; margin: 8px 0 16px; font-family: Arial, sans-serif; font-size: 13px; }
  .map-link { display: inline-block; background: #1565c0; color: white; padding: 8px 18px; border-radius: 4px; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; margin-top: 6px; }
  .signature-block { margin-top: 40px; }
  .sig-row { display: flex; justify-content: space-between; }
  .sig-col { min-width: 200px; }
  .sig-label { font-size: 11px; color: #666; border-top: 1px solid #333; padding-top: 4px; margin-top: 32px; }
  .footer { font-family: Arial, sans-serif; font-size: 10px; color: #aaa; margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; }
</style>
</head>
<body>
<div class="page">

  <div class="header-logo">
    <div>
      <div class="logo-title">🏙️ Rezina Smart City</div>
      <div class="logo-text">Platforma de Raportare Urbană<br>or. Rezina, Republica Moldova</div>
    </div>
  </div>

  <div class="badge-ref">
    Nr. RSC-${String(reportId).padStart(5, '0')} / ${date}
  </div>

  <div class="to-block">
    <div class="label">Către</div>
    <div class="authority">${toName}</div>
    <div style="font-size:12px;color:#555;">or. Rezina, Republica Moldova</div>
  </div>

  <div class="subject-block">
    <div class="doc-type">Sesizare</div>
    <div class="doc-subject">privind: ${title}</div>
  </div>

  <p class="body-text indent">
    Subsemnatul/a <strong>${reporterName}</strong>${reporterEmail ? ` (${reporterEmail})` : ""}, 
    în temeiul art. 3 și art. 8 din Legea Republicii Moldova nr. 190 din 19.07.1994 
    cu privire la petiționare, mă adresez instituției dumneavoastră cu prezenta sesizare 
    referitoare la o problemă de ordin public identificată pe teritoriul orașului Rezina.
  </p>

  <div class="section-label">I. Descrierea problemei</div>
  <div class="info-box"><strong>Categoria:</strong> ${category}</div>
  <p class="body-text">${description}</p>

  <div class="section-label">II. Locul constatării</div>
  <div class="info-box">
    <strong>Adresă:</strong> ${address}<br>
    <strong>Coordonate GPS:</strong> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}<br>
    <strong>Data și ora constatării:</strong> ${dateTime}
  </div>
  <a class="map-link" href="${mapsLink}" target="_blank">📍 Vizualizează pe hartă</a>

  <div class="section-label">III. Solicitare</div>
  <p class="body-text indent">
    Solicit instituției dumneavoastră să examineze prezenta sesizare în termenele 
    prevăzute de lege (30 de zile calendaristice) și să întreprindă măsurile necesare 
    pentru remedierea problemei semnalate, comunicând rezultatele la adresa indicată.
  </p>

  <div class="section-label">IV. Temei legal</div>
  <p class="body-text" style="font-size:12px;color:#555;">
    Legea RM nr. 190/1994 cu privire la petiționare; Legea RM nr. 436/2006 privind 
    administrația publică locală; Legea RM nr. 239/2008 privind transparența în 
    procesul decizional.
  </p>

  <div class="signature-block">
    <div class="sig-row">
      <div class="sig-col">
        <div class="sig-label">Petiționar</div>
        <div style="margin-top:4px;">${reporterName}</div>
        ${reporterEmail ? `<div style="font-size:12px;color:#555;">${reporterEmail}</div>` : ""}
      </div>
      <div class="sig-col" style="text-align:right;">
        <div class="sig-label">Data</div>
        <div style="margin-top:4px;">${date}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Această sesizare a fost transmisă automat prin platforma Rezina Smart City — Raportare Urbană.<br>
    Dezvoltat de Pavel Dordea · rezina-civic.md
  </div>
</div>
</body>
</html>
  `.trim();

  const subject = `[Rezina Smart City] Sesizare Nr. RSC-${String(reportId).padStart(5, '0')} — ${category}: ${title}`;

  logger.info(
    { toEmail, toName, category, title, latitude, longitude, reportId },
    "Sending report email"
  );

  const transport = createTransport();

  if (!transport) {
    logger.info({ toEmail, subject, snippet: html.substring(0, 400) }, "Email not sent (SMTP not configured)");
    return;
  }

  await transport.sendMail({
    from: `"Rezina Smart City" <${fromAddress}>`,
    to: `"${toName}" <${toEmail}>`,
    subject,
    html,
  });

  logger.info({ toEmail, subject }, "Report email sent successfully");
}
