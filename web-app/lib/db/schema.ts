import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  date,
  jsonb,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Accounts ----------

export type EmailPrefs = {
  /** Client messages and contact form submissions. */
  messages: boolean;
  /** The activity digest (choices, comments, favourites). */
  activity: boolean;
  /** Bookings made, changed or cancelled. */
  bookings: boolean;
};

export const DEFAULT_EMAIL_PREFS: EmailPrefs = { messages: true, activity: true, bookings: true };

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "client"] }).notNull(),
  // Exactly one admin (the account created by /setup) has this set. SPEC F12.
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  emailPrefs: jsonb("email_prefs").$type<EmailPrefs>().notNull().default(DEFAULT_EMAIL_PREFS),
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
  // Short address for the client area: /u/<username>. SPEC F17.
  username: text("username").unique(),
  // Set once the client accepts their invite and creates an account.
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// Which admins look after a client (at least one). Decides who gets that client's emails.
export const clientAdmins = pgTable(
  "client_admins",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.adminId] }), index().on(t.adminId)],
);

// Admin invites. Invites from a regular admin wait for the Super Admin's approval.
export const adminInvites = pgTable("admin_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "approved", "declined"] }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// One-time links for invites and password resets. `id` is a hash of the token.
export const accountTokens = pgTable("account_tokens", {
  id: text("id").primaryKey(),
  purpose: text("purpose", { enum: ["invite", "reset", "admin_invite"] }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  adminInviteId: uuid("admin_invite_id").references(() => adminInvites.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const teamProfiles = pgTable("team_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  roleTitle: text("role_title").notNull().default(""),
  bio: text("bio").notNull().default(""),
  yearsExperience: integer("years_experience"),
  specialties: text("specialties").notNull().default(""),
  photoKey: text("photo_key"),
  visible: boolean("visible").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------- Reference library ----------

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default(""),
  notes: text("notes").notNull().default(""),
  // Where a picture saved from the web came from. Blank for the studio's own work.
  sourceUrl: text("source_url").notNull().default(""),
  credit: text("credit").notNull().default(""),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  originalKey: text("original_key").notNull(),
  previewKey: text("preview_key").notNull(),
  thumbKey: text("thumb_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  size: integer("size").notNull(),
  // Public portfolio (F13). Only allowed when `credit` is blank.
  inPortfolio: boolean("in_portfolio").notNull().default(false),
  focusX: integer("focus_x").notNull().default(50),
  focusY: integer("focus_y").notNull().default(50),
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
  // True = "Your Photos" is visible and the page is locked (F6).
  shootPhotosVisible: boolean("shoot_photos_visible").notNull().default(false),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  favouritesLimit: integer("favourites_limit"),
  // Last time an admin opened the page, for the "unseen activity" badge (F7).
  adminSeenAt: timestamp("admin_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const referencePictures = pgTable(
  "reference_pictures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    // Null once the picture was deleted from the library; the snapshot remains.
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    state: text("state", { enum: ["undecided", "accepted", "rejected"] })
      .notNull()
      .default("undecided"),
    addedBy: text("added_by", { enum: ["admin", "client"] }).notNull(),
    // An admin took this picture off the page (it stays in the library).
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    // Saved when the page locks, so the client can find their references later.
    snapshotFilename: text("snapshot_filename"),
    snapshotTitle: text("snapshot_title"),
    snapshotTags: text("snapshot_tags").array(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.pageId, t.photoId), index().on(t.photoId)],
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
    // The original with all metadata removed: what clients download (F1, F8).
    cleanKey: text("clean_key"),
    previewKey: text("preview_key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    favourite: boolean("favourite").notNull().default(false),
    inPortfolio: boolean("in_portfolio").notNull().default(false),
    focusX: integer("focus_x").notNull().default(50),
    focusY: integer("focus_y").notNull().default(50),
    // Whether the client has been emailed about this photo (F7).
    notified: boolean("notified").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.pageId)],
);

export const shootPhotoTags = pgTable(
  "shoot_photo_tags",
  {
    shootPhotoId: uuid("shoot_photo_id")
      .notNull()
      .references(() => shootPhotos.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.shootPhotoId, t.tagId] }), index().on(t.tagId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    referencePictureId: uuid("reference_picture_id").references(() => referencePictures.id, {
      onDelete: "cascade",
    }),
    shootPhotoId: uuid("shoot_photo_id").references(() => shootPhotos.id, {
      onDelete: "cascade",
    }),
    authorType: text("author_type", { enum: ["admin", "client"] }).notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.referencePictureId), index().on(t.shootPhotoId)],
);

// Client activity waiting to go out in an admin digest email (F7).
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => clientPages.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["accepted", "rejected", "undecided", "comment", "favourite", "added"] }).notNull(),
    digestedAt: timestamp("digested_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.pageId)],
);

// ---------- Messaging ----------

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["admin", "client"] }).notNull(),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  body: text("body").notNull(),
  ipHash: text("ip_hash").notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Booking (F15) ----------

export const sessionTypes = pgTable("session_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Weekly working hours. weekday: 0 = Sunday … 6 = Saturday. Times are "HH:MM" in the studio time zone.
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
  },
  (t) => [index().on(t.adminId)],
);

// Whole days off, inclusive, in the studio time zone.
export const timeOff = pgTable(
  "time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [index().on(t.adminId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTypeId: uuid("session_type_id").references(() => sessionTypes.id, { onDelete: "set null" }),
    sessionName: text("session_name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: ["confirmed", "cancelled"] }).notNull().default("confirmed"),
    pageId: uuid("page_id").references(() => clientPages.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.adminId, t.startsAt), index().on(t.clientId)],
);

// A single row (id = 1) of studio-wide settings.
export const studioSettings = pgTable("studio_settings", {
  id: integer("id").primaryKey().default(1),
  timeZone: text("time_zone").notNull().default("America/Los_Angeles"),
  bufferMinutes: integer("buffer_minutes").notNull().default(30),
  cancelCutoffHours: integer("cancel_cutoff_hours").notNull().default(48),
  digestDelayMinutes: integer("digest_delay_minutes").notNull().default(30),
});

// ---------- Payments: kept for later, unused in the beta (F11) ----------

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
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  error: text("error"),
  sentAt: createdAt(),
});
