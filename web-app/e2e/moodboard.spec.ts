import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { findMail, fixture, linkIn, makeFixtures } from "./helpers";

// One walk through SPEC.md F1–F11, in order. Steps share state (admin and
// client browsers), so they run serially.
test.describe.configure({ mode: "serial" });

let adminCtx: BrowserContext;
let clientCtx: BrowserContext;
let admin: Page;
let client: Page;
let privateLink = "";
let adminPageUrl = "";

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept()); // confirm() prompts
  return { ctx, page };
}

test.beforeAll(async ({ browser }) => {
  await makeFixtures();
  ({ ctx: adminCtx, page: admin } = await newPage(browser));
  ({ ctx: clientCtx, page: client } = await newPage(browser));
});

test.afterAll(async () => {
  await adminCtx?.close();
  await clientCtx?.close();
});

test("first run: create the admin account", async () => {
  await admin.goto("/");
  await expect(admin).toHaveURL(/\/setup$/);
  await admin.getByLabel("Your name").fill("Jack Photo");
  await admin.getByLabel("Email").fill("admin@example.com");
  await admin.getByLabel(/Password/).fill("supersecret1");
  await admin.getByRole("button", { name: "Create admin account" }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("F1: upload photos with tags; bad files are rejected", async () => {
  await admin.goto("/admin/library");
  const picker = admin.locator('input[type="file"]');

  await picker.setInputFiles([fixture("ref1.jpg"), fixture("ref2.jpg"), fixture("ref3.jpg"), fixture("fake.jpg"), fixture("too-big.jpg")]);
  await expect(admin.getByText("Larger than 50 MB")).toBeVisible();
  await admin.getByLabel("Tags for these photos").fill("#Portrait #moody");
  await admin.getByRole("button", { name: /Upload photos/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(3);
  await expect(admin.getByText(/fake\.jpg isn't a supported photo/)).toBeVisible();

  await picker.setInputFiles([fixture("ref4.jpg"), fixture("ref5.jpg")]);
  await admin.getByLabel("Tags for these photos").fill("#blackandwhite, portrait");
  await admin.getByRole("button", { name: /Upload photos/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(2);

  await admin.reload();
  await expect(admin.getByText("5 photos")).toBeVisible();
  await expect(admin.getByRole("link", { name: /#portrait\s*5/ })).toBeVisible();
});

test("F1: edit a photo's tags", async () => {
  await admin.goto("/admin/library?tags=blackandwhite");
  await admin.locator("main button:has(img)").first().click();
  await admin.getByLabel("Title").fill("Window light");
  await admin.getByLabel("Tags", { exact: true }).fill("#blackandwhite #portrait #window");
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();
  await admin.keyboard.press("Escape");
  await admin.goto("/admin/library");
  await expect(admin.getByRole("link", { name: /#window\s*1/ })).toBeVisible();
});

test("F2: search the library by tags (all tags must match)", async () => {
  await admin.goto("/admin/library?tags=blackandwhite,portrait");
  await expect(admin.getByText("2 photos tagged #blackandwhite + #portrait")).toBeVisible();
  await admin.goto("/admin/library?tags=moody,blackandwhite");
  await expect(admin.getByText("0 photos")).toBeVisible();
});

test("F3: create a client and a client page with a private link", async () => {
  await admin.goto("/admin/clients");
  await admin.getByLabel("Name").fill("Alex Rivera");
  await admin.getByLabel("Email").fill("alex@example.com");
  await admin.getByRole("button", { name: "Add client" }).click();
  await expect(admin.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();

  await admin.getByLabel("Page name").fill("Engagement shoot");
  await admin.getByLabel("Shoot date").fill("2026-12-05");
  await admin.getByLabel("Notes for the client").fill("Pick the looks you love!");
  await admin.getByRole("button", { name: "Create page" }).click();
  await expect(admin).toHaveURL(/\/admin\/pages\//);
  adminPageUrl = new URL(admin.url()).pathname;

  privateLink = new URL(await admin.locator("input[readonly]").inputValue()).pathname;
  expect(privateLink).toMatch(/^\/c\/[\w-]{40,}$/);
});

test("F3/F7: admin adds inspirations and the client gets one email", async () => {
  await admin.getByRole("button", { name: "+ Add from library" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: /^#moody\s*3$/ }).click();
  await expect(dialog.locator("button:has(img)")).toHaveCount(3);
  await dialog.locator("button:has(img)").nth(0).click();
  await dialog.locator("button:has(img)").nth(1).click();
  await dialog.getByRole("button", { name: /Add 2 to inspirations/ }).click();
  await expect(admin.getByText(/Added 2 photos\. The client has been emailed\./)).toBeVisible();

  const mail = await findMail(/New inspiration photos/);
  expect(mail?.to).toBe("alex@example.com");
  expect(mail?.text).toContain("2 new inspiration photos");
  expect(linkIn(mail!.text)).toBe(privateLink);
});

test("F3: client accepts/rejects without logging in; choices save immediately", async () => {
  await client.goto(privateLink);
  await expect(client.getByRole("heading", { name: "Engagement shoot" })).toBeVisible();
  await expect(client.getByRole("button", { name: /^All\s*2$/ })).toBeVisible();

  await client.getByRole("button", { name: "✓ Accept" }).first().click();
  await client.getByRole("button", { name: "✕ Reject" }).nth(1).click();
  await expect(client.getByRole("button", { name: /^Accepted\s*1$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*1$/ })).toBeVisible();

  // No submit step: a reload keeps the choices.
  await client.reload();
  await expect(client.getByRole("button", { name: /^Accepted\s*1$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*1$/ })).toBeVisible();
});

test("F3: a rejected photo can be accepted again from the Rejected pill", async () => {
  await client.getByRole("button", { name: /^Rejected\s*1$/ }).click();
  await expect(client.getByText("Changed your mind?")).toBeVisible();
  await client.getByRole("button", { name: "✓ Accept" }).first().click();
  await expect(client.getByRole("button", { name: /^Accepted\s*2$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*0$/ })).toBeVisible();
  await client.getByRole("button", { name: /^All\s*2$/ }).click();
});

test("F4: client searches the whole library by tag and adds a photo", async () => {
  await client.getByRole("button", { name: "+ Find more by tag" }).click();
  const dialog = client.getByRole("dialog");
  await dialog.getByRole("button", { name: /#blackandwhite\s*2/ }).click();
  await expect(dialog.getByText("Already added")).toHaveCount(0);
  await dialog.locator("button:has(img)").first().click();
  await dialog.getByRole("button", { name: /Add 1 to inspirations/ }).click();
  await expect(client.getByRole("button", { name: /^All\s*3$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Undecided\s*1$/ })).toBeVisible();
});

test("F8: clients can't load the original of a reference photo", async () => {
  const src = await client.locator("main img").first().getAttribute("src");
  const photoId = src!.split("/")[3];
  const token = privateLink.split("/")[2];
  const thumb = await client.request.get(`/media/photo/${photoId}/thumb?a=t:${token}`);
  expect(thumb.status()).toBe(200);
  const original = await client.request.get(`/media/photo/${photoId}/original?a=t:${token}`);
  expect(original.status()).toBe(404);
  const noKey = await client.request.get(`/media/photo/${photoId}/thumb`);
  expect(noKey.status()).toBe(404);
});

test("F5: client comments on a photo; admin sees and replies", async () => {
  await client.locator("main button:has(img)").first().click();
  await client.getByPlaceholder("Add a comment…").fill("Love this light!");
  await client.getByRole("button", { name: "Post comment" }).click();
  await expect(client.getByRole("dialog").getByText("Love this light!")).toBeVisible();
  await client.keyboard.press("Escape");
  await expect(client.locator("main").getByText("💬 1")).toBeVisible();

  await admin.goto(adminPageUrl);
  await admin.locator("main button:has(img)").first().click();
  await expect(admin.getByRole("dialog").getByText("Love this light!")).toBeVisible();
  await admin.getByPlaceholder("Add a comment…").fill("Great pick, we'll do this at sunset.");
  await admin.getByRole("button", { name: "Post comment" }).click();
  await expect(admin.getByRole("dialog").getByText("Photographer")).toBeVisible();
  await admin.keyboard.press("Escape");
});

test("F6/F7/F8: shoot photos stay hidden until shown, then the client is emailed and can download", async () => {
  await admin.goto(adminPageUrl);
  await admin.locator('input[type="file"]').setInputFiles([fixture("shoot1.png"), fixture("shoot2.jpg")]);
  await admin.getByRole("button", { name: /Upload shoot photos/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(2, { timeout: 60_000 });
  expect(await findMail(/are ready/)).toBeUndefined(); // hidden: no email yet

  await client.goto(privateLink);
  await expect(client.getByRole("button", { name: /Your Photos/ })).toHaveCount(0);

  await admin.getByRole("button", { name: "Show to client" }).click();
  await expect(admin.getByText("Visible to client")).toBeVisible();
  const mail = await findMail(/Your photos from "Engagement shoot" are ready/);
  expect(mail?.text).toContain("2 new photos have been added");

  await client.reload();
  await expect(client.getByRole("button", { name: "Your Photos (2)" })).toBeVisible();
  const download = client.getByRole("link", { name: "Download", exact: true }).first();
  const res = await client.request.get((await download.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");

  const zip = await client.request.get(`/download/${encodeURIComponent(`t:${privateLink.split("/")[2]}`)}`);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
});

test("F9: client accepts an invite and sees their pages in the account", async () => {
  await admin.goto("/admin/clients");
  await admin.getByRole("link", { name: /Alex Rivera/ }).click();
  await admin.getByRole("button", { name: "Send account invite" }).click();
  await expect(admin.getByText("Invite sent.")).toBeVisible();

  const invite = await findMail(/invited to Moodboard/);
  await client.goto(linkIn(invite!.text));
  await expect(client.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await client.getByLabel(/New password/).fill("clientpass1");
  await client.getByLabel("Confirm password").fill("clientpass1");
  await client.getByRole("button", { name: "Create account" }).click();
  await expect(client).toHaveURL(/\/account$/);
  await client.getByRole("link", { name: /Engagement shoot/ }).click();
  await expect(client.getByRole("button", { name: "Your Photos (2)" })).toBeVisible();

  // The invite link only works once.
  await client.goto(linkIn(invite!.text));
  await expect(client.getByRole("heading", { name: "Link expired" })).toBeVisible();
});

test("F10: client and admin message each other", async () => {
  await client.goto("/account/messages");
  await client.getByPlaceholder("Write a message…").fill("Can we move the shoot to 4pm?");
  await client.getByRole("button", { name: "Send" }).click();
  await expect(client.getByText("Can we move the shoot to 4pm?")).toBeVisible();
  expect((await findMail(/New message from Alex Rivera/))?.to).toBe("admin@example.com");

  await admin.goto("/admin/inbox");
  await expect(admin.getByText("1 new")).toBeVisible();
  await admin.getByRole("link", { name: /Alex Rivera/ }).click();
  await admin.getByPlaceholder("Write a message…").fill("Sure, 4pm works.");
  await admin.getByRole("button", { name: "Send" }).click();
  await expect(admin.getByText("Sure, 4pm works.")).toBeVisible();

  await client.goto("/account/messages");
  await expect(client.getByText("Sure, 4pm works.")).toBeVisible();
});

test("F11: payment request, client sees it, admin marks it paid", async () => {
  await admin.goto("/admin/clients");
  await admin.getByRole("link", { name: /Alex Rivera/ }).click();
  await admin.getByText("New payment request").click();
  await admin.getByLabel("Description").fill("Deposit");
  await admin.getByLabel("Amount").fill("250");
  await admin.getByRole("button", { name: "Send payment request" }).click();
  await expect(admin.getByText("Payment request sent.")).toBeVisible();
  expect((await findMail(/Payment request: Deposit/))?.text).toContain("$250.00");

  await client.goto("/account/payments");
  await expect(client.getByText("$250.00")).toBeVisible();
  await client.getByRole("button", { name: "Pay now" }).click();
  await expect(client.getByText(/Online payment isn't set up yet/)).toBeVisible();

  await admin.goto("/admin/payments");
  await admin.getByRole("button", { name: "Mark paid" }).click();
  await expect(admin.getByText("paid", { exact: true })).toBeVisible();
  await client.reload();
  await expect(client.getByText("paid", { exact: true })).toBeVisible();
});

test("F3/F9: turning off the link blocks it, but the account still works", async () => {
  await admin.goto(adminPageUrl);
  await admin.getByRole("button", { name: "Turn off link" }).click();
  await expect(admin.getByText("The link is turned off.")).toBeVisible();

  const anon = await clientCtx.browser()!.newContext();
  const anonPage = await anon.newPage();
  const res = await anonPage.goto(privateLink);
  expect(res?.status()).toBe(404);
  await anon.close();

  await client.goto("/account");
  await client.getByRole("link", { name: /Engagement shoot/ }).click();
  await expect(client.getByRole("heading", { name: "Engagement shoot" })).toBeVisible();
});

test("access: clients can't open admin pages; wrong password is refused", async () => {
  await client.goto("/admin");
  await expect(client).toHaveURL(/\/login$|\/account$/);

  const ctx = await clientCtx.browser()!.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await ctx.close();
});
