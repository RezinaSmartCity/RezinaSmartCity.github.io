import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, settingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// Default category configuration (can be overridden via DB settings)
export const DEFAULT_CATEGORIES: Record<
  string,
  { label: string; icon: string; color: string; authorityName: string; authorityEmail: string }
> = {
  parking:          { label: "Parcare neregulamentară",       icon: "🚗", color: "#E53935", authorityName: "Poliția Rezina",           authorityEmail: process.env.EMAIL_POLITIE   || "politie@rezina.md"   },
  accident_traffic: { label: "Accident / Acțiuni în trafic", icon: "🚨", color: "#D32F2F", authorityName: "Poliția Rezina",           authorityEmail: process.env.EMAIL_POLITIE   || "politie@rezina.md"   },
  sewage:           { label: "Canalizare astupată",           icon: "🪣", color: "#5D4037", authorityName: "Apă Canal Rezina",         authorityEmail: process.env.EMAIL_APA       || "apa@rezina.md"        },
  garbage_road:     { label: "Gunoi pe drum / trotuare",      icon: "♻️", color: "#795548", authorityName: "Servicii Comunale Rezina", authorityEmail: process.env.EMAIL_COMUNALE   || "comunale@rezina.md"   },
  tree:             { label: "Copac / Crengi căzute",         icon: "🌳", color: "#43A047", authorityName: "Secția Ecologie Rezina",   authorityEmail: process.env.EMAIL_ECOLOGIE  || "ecologie@rezina.md"   },
  electricity:      { label: "Probleme electricitate",        icon: "⚡", color: "#FFB300", authorityName: "Rednord SA",               authorityEmail: process.env.EMAIL_REDNORD   || "rednord@rezina.md"    },
  road:             { label: "Drum deteriorat",               icon: "🕳️", color: "#757575", authorityName: "Primăria Rezina",          authorityEmail: process.env.EMAIL_PRIMARIE  || "primarie@rezina.md"   },
  water:            { label: "Probleme apă",                  icon: "💧", color: "#1E88E5", authorityName: "Apă Canal Rezina",         authorityEmail: process.env.EMAIL_APA       || "apa@rezina.md"        },
  garbage:          { label: "Depozitare ilegală de deșeuri", icon: "🗑️", color: "#8D6E63", authorityName: "Servicii Comunale Rezina", authorityEmail: process.env.EMAIL_COMUNALE   || "comunale@rezina.md"   },
  lighting:         { label: "Iluminat stradal defect",       icon: "💡", color: "#F9A825", authorityName: "Primăria Rezina",          authorityEmail: process.env.EMAIL_PRIMARIE  || "primarie@rezina.md"   },
  vandalism:        { label: "Vandalism",                     icon: "🔨", color: "#E64A19", authorityName: "Poliția Rezina",           authorityEmail: process.env.EMAIL_POLITIE   || "politie@rezina.md"   },
  stray_animals:    { label: "Animale vagabonde",             icon: "🐕", color: "#F57F17", authorityName: "Primăria Rezina",          authorityEmail: process.env.EMAIL_PRIMARIE  || "primarie@rezina.md"   },
  other:            { label: "Altele",                        icon: "❓", color: "#AB47BC", authorityName: "Primăria Rezina",          authorityEmail: process.env.EMAIL_PRIMARIE  || "primarie@rezina.md"   },
};

// Load categories from DB (merges with defaults)
export async function loadCategories() {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "categories"));
    if (row) {
      const saved = JSON.parse(row.value) as typeof DEFAULT_CATEGORIES;
      return { ...DEFAULT_CATEGORIES, ...saved };
    }
  } catch (e) {
    logger.warn({ e }, "Could not load categories from DB, using defaults");
  }
  return DEFAULT_CATEGORIES;
}

// Middleware: check admin password
function requireAdmin(req: any, res: any, next: any) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // If no password set, deny access for safety
    res.status(403).json({ error: "Admin panel not configured (ADMIN_PASSWORD not set)" });
    return;
  }
  const provided = req.headers["x-admin-password"] as string | undefined;
  if (!provided || provided !== adminPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// POST /api/admin/auth — verify password
router.post("/auth", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(403).json({ error: "Admin panel not configured" });
    return;
  }
  const { password } = req.body as { password?: string };
  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "Parolă incorectă" });
    return;
  }
  res.json({ ok: true });
});

// GET /api/admin/reports — all reports with full data
router.get("/reports", requireAdmin, async (req, res) => {
  const reports = await db
    .select()
    .from(reportsTable)
    .orderBy(desc(reportsTable.createdAt));

  res.json(
    reports.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      reporterName: r.reporterName,
      reporterEmail: r.reporterEmail,
      status: r.status,
      resolvedVotes: r.resolvedVotes,
      photoBase64: r.photoBase64,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

// PATCH /api/admin/reports/:id — update status
router.patch("/reports/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (!status || !["pending", "resolved"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Must be 'pending' or 'resolved'." });
    return;
  }

  const [updated] = await db
    .update(reportsTable)
    .set({ status })
    .where(eq(reportsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({ id: updated.id, status: updated.status });
});

// DELETE /api/admin/reports/:id
router.delete("/reports/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  await db.delete(reportsTable).where(eq(reportsTable.id, id));
  res.status(204).end();
});

// GET /api/admin/config — get current categories + email config
router.get("/config", requireAdmin, async (req, res) => {
  const categories = await loadCategories();

  const emailConfig = {
    EMAIL_POLITIE:  process.env.EMAIL_POLITIE  || "politie@rezina.md",
    EMAIL_ECOLOGIE: process.env.EMAIL_ECOLOGIE || "ecologie@rezina.md",
    EMAIL_REDNORD:  process.env.EMAIL_REDNORD  || "rednord@rezina.md",
    EMAIL_PRIMARIE: process.env.EMAIL_PRIMARIE || "primarie@rezina.md",
    EMAIL_APA:      process.env.EMAIL_APA      || "apa@rezina.md",
    EMAIL_COMUNALE: process.env.EMAIL_COMUNALE || "comunale@rezina.md",
    SMTP_HOST:      process.env.SMTP_HOST      || "(nesetat)",
    SMTP_PORT:      process.env.SMTP_PORT      || "587",
    SMTP_USER:      process.env.SMTP_USER      || "(nesetat)",
    SMTP_FROM:      process.env.SMTP_FROM      || "noreply@rezina-civic.md",
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  };

  res.json({ categories, emailConfig });
});

// PUT /api/admin/config/categories — save category overrides to DB
router.put("/config/categories", requireAdmin, async (req, res) => {
  const categories = req.body as Record<string, { label: string; icon: string; color: string; authorityName: string; authorityEmail: string }>;

  if (!categories || typeof categories !== "object") {
    res.status(400).json({ error: "Invalid categories payload" });
    return;
  }

  const value = JSON.stringify(categories);

  await db
    .insert(settingsTable)
    .values({ key: "categories", value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });

  logger.info("Admin updated categories config");
  res.json({ ok: true });
});

// GET /api/admin/stats — dashboard stats
router.get("/stats", requireAdmin, async (req, res) => {
  const all = await db.select().from(reportsTable);

  const total = all.length;
  const pending = all.filter((r) => r.status === "pending").length;
  const resolved = all.filter((r) => r.status === "resolved").length;

  const byCategory: Record<string, number> = {};
  for (const r of all) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = all.filter((r) => r.createdAt >= thirtyDaysAgo).length;

  res.json({ total, pending, resolved, recent, byCategory });
});

export default router;
