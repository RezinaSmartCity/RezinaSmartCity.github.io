import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateReportBody,
  VoteResolvedBody,
  GetReportParams,
  DeleteReportParams,
  VoteResolvedParams,
} from "@workspace/api-zod";
import { sendReportEmail } from "./email";

const router = Router();

// Category → authority mapping
const CATEGORY_AUTHORITY: Record<string, { name: string; email: string }> = {
  parking: { name: "Poliția Rezina", email: process.env.EMAIL_POLITIE || "politie@rezina.md" },
  tree: { name: "Secția Ecologie Rezina", email: process.env.EMAIL_ECOLOGIE || "ecologie@rezina.md" },
  electricity: { name: "Rednord SA", email: process.env.EMAIL_REDNORD || "rednord@rezina.md" },
  road: { name: "Primăria Rezina", email: process.env.EMAIL_PRIMARIE || "primarie@rezina.md" },
  water: { name: "Apă Canal Rezina", email: process.env.EMAIL_APA || "apa@rezina.md" },
  garbage: { name: "Servicii Comunale Rezina", email: process.env.EMAIL_COMUNALE || "comunale@rezina.md" },
  other: { name: "Primăria Rezina", email: process.env.EMAIL_PRIMARIE || "primarie@rezina.md" },
};

const CATEGORY_LABELS: Record<string, string> = {
  parking: "Parcare neregulamentară",
  tree: "Copac/Crengi căzute",
  electricity: "Probleme electricitate",
  road: "Drum deteriorat",
  water: "Probleme apă",
  garbage: "Gunoi/Depozitare ilegală",
  other: "Altele",
};

// GET /api/reports
router.get("/", async (req, res) => {
  const reports = await db.select().from(reportsTable).orderBy(reportsTable.createdAt);
  res.json(
    reports.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      latitude: r.latitude,
      longitude: r.longitude,
      photoBase64: r.photoBase64,
      address: r.address,
      reporterName: r.reporterName,
      reporterEmail: r.reporterEmail,
      status: r.status,
      resolvedVotes: r.resolvedVotes,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

// POST /api/reports
router.post("/", async (req, res) => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  const [report] = await db
    .insert(reportsTable)
    .values({
      title: data.title,
      description: data.description,
      category: data.category,
      latitude: data.latitude,
      longitude: data.longitude,
      photoBase64: data.photoBase64 ?? null,
      address: data.address ?? null,
      reporterName: data.reporterName ?? null,
      reporterEmail: data.reporterEmail ?? null,
    })
    .returning();

  // Send email to authority asynchronously — don't block response
  const authority = CATEGORY_AUTHORITY[data.category] ?? CATEGORY_AUTHORITY.other;
  sendReportEmail({
    toEmail: authority.email,
    toName: authority.name,
    category: CATEGORY_LABELS[data.category] ?? data.category,
    title: data.title,
    description: data.description,
    address: data.address ?? "Locație GPS",
    latitude: data.latitude,
    longitude: data.longitude,
    reporterName: data.reporterName ?? "Anonim",
    reporterEmail: data.reporterEmail ?? undefined,
  }).catch((err) => req.log.error({ err }, "Failed to send report email"));

  res.status(201).json({
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    latitude: report.latitude,
    longitude: report.longitude,
    photoBase64: report.photoBase64,
    address: report.address,
    reporterName: report.reporterName,
    reporterEmail: report.reporterEmail,
    status: report.status,
    resolvedVotes: report.resolvedVotes,
    createdAt: report.createdAt.toISOString(),
  });
});

// GET /api/reports/:id
router.get("/:id", async (req, res) => {
  const parsed = GetReportParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, parsed.data.id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    latitude: report.latitude,
    longitude: report.longitude,
    photoBase64: report.photoBase64,
    address: report.address,
    reporterName: report.reporterName,
    reporterEmail: report.reporterEmail,
    status: report.status,
    resolvedVotes: report.resolvedVotes,
    createdAt: report.createdAt.toISOString(),
  });
});

// DELETE /api/reports/:id
router.delete("/:id", async (req, res) => {
  const parsed = DeleteReportParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, parsed.data.id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  await db.delete(reportsTable).where(eq(reportsTable.id, parsed.data.id));
  res.status(204).end();
});

// POST /api/reports/:id/vote-resolved
router.post("/:id/vote-resolved", async (req, res) => {
  const paramsParsed = VoteResolvedParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = VoteResolvedBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, paramsParsed.data.id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const fingerprint = bodyParsed.data.voterFingerprint ?? "anonymous";
  const existingFingerprints = report.voterFingerprints
    ? report.voterFingerprints.split(",").filter(Boolean)
    : [];

  if (existingFingerprints.includes(fingerprint)) {
    res.status(400).json({ error: "Already voted" });
    return;
  }

  const newFingerprints = [...existingFingerprints, fingerprint];
  const newVotes = report.resolvedVotes + 1;
  const newStatus = newVotes >= 3 ? "resolved" : "pending";

  const [updated] = await db
    .update(reportsTable)
    .set({
      resolvedVotes: newVotes,
      voterFingerprints: newFingerprints.join(","),
      status: newStatus,
    })
    .where(eq(reportsTable.id, paramsParsed.data.id))
    .returning();

  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    category: updated.category,
    latitude: updated.latitude,
    longitude: updated.longitude,
    photoBase64: updated.photoBase64,
    address: updated.address,
    reporterName: updated.reporterName,
    reporterEmail: updated.reporterEmail,
    status: updated.status,
    resolvedVotes: updated.resolvedVotes,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
