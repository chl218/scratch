import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  date,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Accounts ----------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "client"] }).notNull(),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: createdAt(),
});

// Login sessions. `id` is a SHA-256 hash of the cookie token, so a leaked
// database can't be used to log in.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Set once the client accepts their invite and creates an account.
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// One-time links for account invites and password resets. `id` is a hash of the token.
export const accountTokens = pgTable("account_tokens", {
  id: text("id").primaryKey(),
  purpose: text("purpose", { enum: ["invite", "reset"] }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Photo library ----------

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default(""),
  notes: text("notes").notNull().default(""),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  originalKey: text("original_key").notNull(),
  previewKey: text("preview_key").notNull(),
  thumbKey: text("thumb_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  size: integer("size").notNull(),
  createdAt: createdAt(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const photoTags = pgTable(
  "photo_tags",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.photoId, t.tagId] }), index().on(t.tagId)],
);

// ---------- Client pages ----------

export const clientPages = pgTable("client_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  shootDate: date("shoot_date", { mode: "string" }),
  notes: text("notes").notNull().default(""),
  // Secret for the private link (/c/<token>). Null means the link is revoked.
  linkToken: text("link_token").unique(),
  shootPhotosVisible: boolean("shoot_photos_visible").notNull().default(false),
  createdAt: createdAt(),
});

export const inspirations = pgTable(
  "inspirations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["undecided", "accepted", "rejected"] })
      .notNull()
      .default("undecided"),
    addedBy: text("added_by", { enum: ["admin", "client"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.pageId, t.photoId)],
);

export const shootPhotos = pgTable(
  "shoot_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    originalKey: text("original_key").notNull(),
    previewKey: text("preview_key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    // Whether the client has been emailed about this photo (F7).
    notified: boolean("notified").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.pageId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    inspirationId: uuid("inspiration_id").references(() => inspirations.id, {
      onDelete: "cascade",
    }),
    shootPhotoId: uuid("shoot_photo_id").references(() => shootPhotos.id, {
      onDelete: "cascade",
    }),
    authorType: text("author_type", { enum: ["admin", "client"] }).notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.inspirationId), index().on(t.shootPhotoId)],
);

// ---------- Messaging & payments ----------

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["admin", "client"] }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId)],
);

export const paymentRequests = pgTable("payment_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").references(() => clientPages.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  status: text("status", { enum: ["pending", "paid", "cancelled"] })
    .notNull()
    .default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  providerRef: text("provider_ref"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(),
  type: text("type", {
    enum: ["inspirations", "shoot_photos", "message", "payment", "account"],
  }).notNull(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  error: text("error"),
  sentAt: createdAt(),
});
