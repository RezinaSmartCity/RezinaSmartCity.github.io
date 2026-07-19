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
import { loadCategories } from "../admin/index";

const router = Router();

function toJson(r: typeof reportsTable.$inferSelect) {
  return {
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
  };
}

// GET /api/reports
router.get("/", async (req, res) => {
  const reports = await db.select().from(reportsTable).orderBy(reportsTable.createdAt);
  res.json(reports.map(toJson));
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
  loadCategories().then((categories) => {
    const cat = categories[data.category] ?? categories.other;
    sendReportEmail({
      toEmail: cat.authorityEmail,
      toName: cat.authorityName,
      category: cat.label,
      title: data.title,
      description: data.description,
      address: data.address ?? "Locație GPS",
      latitude: data.latitude,
      longitude: data.longitude,
      reporterName: data.reporterName ?? "Anonim",
      reporterEmail: data.reporterEmail ?? undefined,
      reportId: report.id,
    }).catch((err) => req.log.error({ err }, "Failed to send report email"));
  }).catch((err) => req.log.error({ err }, "Failed to load categories for email"));

  res.status(201).json(toJson(report));
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

  res.json(toJson(report));
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

  res.json(toJson(updated));
});

export default router;
