import { sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

/** A shared expense pot: a trip, a flat, a dinner club. */
export const pots = pgTable("pots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  perExpenseCap: integer("per_expense_cap").notNull(),
  dailyCap: integer("daily_cap").notNull(),
  /** JSON array of allowed categories. */
  allowedCategories: text("allowed_categories").notNull(),
  approvalsRequired: integer("approvals_required").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const potShares = createSharesTable("pot_shares");

export const potMembers = pgTable("pot_members", {
  id: text("id").primaryKey(),
  potId: text("pot_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  potId: text("pot_id").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  /** Minor units in the pot currency. */
  amount: integer("amount").notNull(),
  paidBy: text("paid_by").notNull(),
  splitMode: text("split_mode").notNull().default("equal"),
  /** JSON memberId -> share (minor units); sums to amount. */
  splits: text("splits").notNull(),
  status: text("status").notNull(),
  /** JSON array of member ids who approved. */
  approvals: text("approvals").notNull().default("[]"),
  /** JSON rule checks and reasons from the rules engine. */
  checks: text("checks").notNull().default("[]"),
  reasons: text("reasons").notNull().default("[]"),
  /** "agent" when the agent added it, "ui" when a person did. */
  source: text("source").notNull().default("ui"),
  spentOn: text("spent_on").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const settlements = pgTable("settlements", {
  id: text("id").primaryKey(),
  potId: text("pot_id").notNull(),
  fromMember: text("from_member").notNull(),
  toMember: text("to_member").notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  source: text("source").notNull().default("ui"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

/** Who did what: every write by a person or the agent lands here. */
export const potActivity = pgTable("pot_activity", {
  id: text("id").primaryKey(),
  potId: text("pot_id").notNull(),
  actor: text("actor").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});
