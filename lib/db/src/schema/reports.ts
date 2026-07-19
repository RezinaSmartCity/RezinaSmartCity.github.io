import { pgTable, serial, text, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // parking | tree | electricity | road | water | garbage | other
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  photoBase64: text("photo_base64"),
  address: text("address"),
  reporterName: text("reporter_name"),
  reporterEmail: text("reporter_email"),
  status: text("status").notNull().default("pending"), // pending | resolved
  resolvedVotes: integer("resolved_votes").notNull().default(0),
  voterFingerprints: text("voter_fingerprints").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  resolvedVotes: true,
  voterFingerprints: true,
  status: true,
  createdAt: true,
});

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
