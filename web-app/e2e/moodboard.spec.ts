import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { findMail, fixture, linkIn, makeFixtures, readMail, waitForMail } from "./helpers";

// One walk through SPEC.md v0.6, in order. Steps share state (admin, client and
// visitor browsers), so they run serially.
test.describe.configure({ mode: "serial" });

let adminCtx: BrowserContext;
let clientCtx: BrowserContext;
let visitorCtx: BrowserContext;
let admin: Page;
let client: Page;
let visitor: Page;
let privateLink = "";
let token = "";
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
  ({ ctx: visitorCtx, page: visitor } = await newPage(browser));
});

test.afterAll(async () => {
  await adminCtx?.close();
  await clientCtx?.close();
  await visitorCtx?.close();
});

test("first run: create the Super Admin", async () => {
  await admin.goto("/");
  await expect(admin).toHaveURL(/\/setup$/);
  await admin.getByLabel("Your name").fill("Jack Photo");
  await admin.getByLabel("Email").fill("admin@example.com");
  await admin.getByLabel(/Password/).fill("supersecret1");
  await admin.getByRole("button", { name: "Create the Super Admin account" }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await expect(admin.getByText("Super Admin", { exact: true })).toBeVisible();
});

test("settings: no digest delay and no booking cutoff, so the test doesn't wait", async () => {
  await admin.goto("/admin/settings");
  await admin.getByLabel("Activity digest after (minutes of quiet)").fill("0");
  await admin.getByLabel("Clients can change bookings until (hours before)").fill("0");
  await admin.getByRole("button", { name: "Save studio settings" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();
});

test("F1: upload Reference Pictures with tags and a credit; bad files are rejected", async () => {
  await admin.goto("/admin/library");
  const picker = admin.getByLabel("Choose photos");

  await picker.setInputFiles([fixture("ref1.jpg"), fixture("ref2.jpg"), fixture("ref3.jpg"), fixture("fake.jpg"), fixture("too-big.jpg")]);
  await expect(admin.getByText("Larger than 50 MB")).toBeVisible();
  await admin.getByLabel("Tags for these photos").fill("#Portrait #moody");
  await admin.getByRole("button", { name: /Upload pictures/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(3);
  await expect(admin.getByText(/fake\.jpg isn't a supported photo/)).toBeVisible();

  await picker.setInputFiles([fixture("ref4.jpg"), fixture("ref5.jpg")]);
  await admin.getByLabel("Tags for these photos").fill("#blackandwhite, portrait");
  await admin.getByLabel("Credit (pictures from the web)").fill("@someone on Instagram");
  await admin.getByRole("button", { name: /Upload pictures/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(2);

  await admin.reload();
  await expect(admin.getByText("5 pictures")).toBeVisible();
  await expect(admin.getByRole("link", { name: /#portrait\s*5/ })).toBeVisible();
});

test("F1/F13: credited pictures can't join the portfolio; the studio's own work can", async () => {
  await admin.goto("/admin/library?tags=blackandwhite");
  await admin.locator("main .jt button").first().click();
  await expect(admin.getByLabel("Credit", { exact: true })).toHaveValue("@someone on Instagram");
  await expect(admin.getByRole("checkbox", { name: /Show in portfolio/ })).toBeDisabled();
  await admin.getByLabel("Title").fill("Window light");
  await admin.getByLabel("Tags", { exact: true }).fill("#blackandwhite #portrait #window");
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();
  await admin.keyboard.press("Escape");

  await admin.goto("/admin/library?tags=moody");
  await admin.locator("main .jt button").first().click();
  await admin.getByLabel("Tags", { exact: true }).fill("#portrait #moody #golden");
  await admin.getByRole("checkbox", { name: /Show in portfolio/ }).check();
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();
  await admin.keyboard.press("Escape");
});

test("F2: search the library by tags (all tags must match)", async () => {
  await admin.goto("/admin/library?tags=blackandwhite,portrait");
  await expect(admin.getByText("2 pictures tagged #blackandwhite + #portrait")).toBeVisible();
  await admin.goto("/admin/library?tags=moody,blackandwhite");
  await expect(admin.getByText("0 pictures")).toBeVisible();
});

test("F13: the landing page shows the portfolio; search only uses portfolio tags", async () => {
  await visitor.goto("/");
  await expect(visitor.locator(".mosaic img")).toHaveCount(1);
  await expect(visitor.getByRole("link", { name: "#golden" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "#blackandwhite" })).toHaveCount(0);
  await visitor.goto("/?tags=golden");
  await expect(visitor.getByText("1 photo tagged #golden")).toBeVisible();

  const src = await visitor.locator(".mosaic img").first().getAttribute("src");
  const id = src!.split("/")[3];
  expect((await visitor.request.get(`/media/photo/${id}/preview`)).status()).toBe(200);
  expect((await visitor.request.get(`/media/photo/${id}/original`)).status()).toBe(404);
});

test("F3/F17: create a client (username arivera) and a client page with a private link", async () => {
  await admin.goto("/admin/clients");
  await admin.getByLabel("Name").fill("Alex Rivera");
  await admin.getByLabel("Email").fill("alex@example.com");
  await admin.getByRole("button", { name: "Add client" }).click();
  await expect(admin.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();
  await expect(admin.getByText("Client area: /u/arivera")).toBeVisible();

  await admin.getByLabel("Page name").fill("Engagement shoot");
  await admin.getByLabel("Shoot date").fill("2026-12-05");
  await admin.getByLabel("Notes for the client").fill("Pick the looks you love!");
  await admin.getByRole("button", { name: "Create page" }).click();
  await expect(admin).toHaveURL(/\/admin\/pages\//);
  adminPageUrl = new URL(admin.url()).pathname;

  privateLink = new URL(await admin.getByLabel("Private link").inputValue()).pathname;
  expect(privateLink).toMatch(/^\/c\/[\w-]{40,}$/);
  token = privateLink.split("/")[2];
});

test("F3/F7: admin adds Reference Pictures and the client gets one email", async () => {
  await admin.getByRole("button", { name: "Add from library" }).click();
  const dialog = admin.getByRole("dialog", { name: "Add from the library" });
  await dialog.getByRole("button", { name: /^#moody\s*3$/ }).click();
  await expect(dialog.locator(".jt button")).toHaveCount(3);
  await dialog.locator(".jt button").nth(0).click();
  await dialog.locator(".jt button").nth(1).click();
  await dialog.getByRole("button", { name: /Add 2 to the page/ }).click();
  await expect(admin.getByText(/Added 2 pictures\. The client has been emailed\./)).toBeVisible();

  const mail = await findMail(/New reference pictures/);
  expect(mail?.to).toBe("alex@example.com");
  expect(mail?.text).toContain("2 new reference pictures were added");
  expect(linkIn(mail!.text)).toBe(privateLink);
});

test("F3: client accepts/rejects without logging in; choices save immediately", async () => {
  await client.goto(privateLink);
  await expect(client.getByRole("heading", { name: "Engagement shoot" })).toBeVisible();
  await expect(client.getByRole("button", { name: /^All\s*2$/ })).toBeVisible();

  await client.getByRole("button", { name: "Accept", exact: true }).first().click();
  await client.getByRole("button", { name: "Reject", exact: true }).nth(1).click();
  await expect(client.getByRole("button", { name: /^Accepted\s*1$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*1$/ })).toBeVisible();
  await expect(client.locator(".mark-accept")).toHaveCount(1);
  await expect(client.locator(".mark-reject")).toHaveCount(1);

  await client.reload();
  await expect(client.getByRole("button", { name: /^Accepted\s*1$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*1$/ })).toBeVisible();
});

test("F3: a rejected picture can be accepted again from the Rejected pill", async () => {
  await client.getByRole("button", { name: /^Rejected\s*1$/ }).click();
  await expect(client.getByText("Changed your mind?")).toBeVisible();
  await client.getByRole("button", { name: "Accept", exact: true }).first().click();
  await expect(client.getByRole("button", { name: /^Accepted\s*2$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Rejected\s*0$/ })).toBeVisible();
});

test("F17: a browser that opened the link can reach /u/arivera; others get not found", async () => {
  await visitor.goto(privateLink);
  await expect(visitor.getByRole("heading", { name: "Engagement shoot" })).toBeVisible();
  await expect.poll(async () => (await visitor.request.get("/u/arivera")).status()).toBe(200);

  const stranger = await visitorCtx.browser()!.newContext();
  const res = await (await stranger.newPage()).goto("/u/arivera");
  expect(res?.status()).toBe(404);
  await stranger.close();
});

test("F4: client searches the whole library from their area and adds a picture", async () => {
  await expect.poll(async () => (await client.request.get("/u/arivera")).status()).toBe(200);
  await client.goto("/u/arivera");
  await expect(client.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();
  await client.getByRole("button", { name: /^#blackandwhite\s*2$/ }).click();
  await expect(client.locator(".jt")).toHaveCount(2);
  await client.getByRole("button", { name: "Add to Engagement shoot" }).first().click();
  await expect(client.getByText("Added to Engagement shoot.")).toBeVisible();

  await client.goto(privateLink);
  await expect(client.getByRole("button", { name: /^All\s*3$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /^Undecided\s*1$/ })).toBeVisible();
});

test("F8: clients can't load the original of a Reference Picture", async () => {
  // The last one is a credited picture, so it is never public.
  const src = await client.locator("main .jt img").last().getAttribute("src");
  const photoId = src!.split("/")[3];
  expect((await client.request.get(`/media/photo/${photoId}/thumb?a=t:${token}`)).status()).toBe(200);
  expect((await client.request.get(`/media/photo/${photoId}/original?a=t:${token}`)).status()).toBe(404);
  expect((await visitor.request.get(`/media/photo/${photoId}/thumb`)).status()).toBe(404);
});

test("F5: link visitors read comments but need an account to write; admins comment by name", async () => {
  await client.locator("main .jt-frame").first().click();
  await expect(client.getByText("Ask the studio for an invite to comment.")).toBeVisible();
  await client.keyboard.press("Escape");

  await admin.goto(adminPageUrl);
  await admin.locator("main .jt-frame").first().click();
  await admin.getByPlaceholder("Add a comment…").fill("Great pick, we'll do this at sunset.");
  await admin.getByRole("button", { name: "Post comment" }).click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog.getByText("Jack Photo")).toBeVisible();
  await expect(dialog.getByText("Studio", { exact: true })).toBeVisible();
  await admin.keyboard.press("Escape");

  await client.reload();
  await client.locator("main .jt-frame").first().click();
  await expect(client.getByRole("dialog").getByText("Great pick, we'll do this at sunset.")).toBeVisible();
  await client.keyboard.press("Escape");
});

test("F7: admins get activity digests for the client's choices", async () => {
  await waitForMail(/Alex Rivera was busy on "Engagement shoot"/, "admin@example.com");
  // With the delay at 0 each burst of activity is its own digest; together they cover the choices.
  const digests = (await readMail()).filter((m) => /was busy on/.test(m.subject)).map((m) => m.text).join(" ");
  expect(digests).toMatch(/accepted (a reference|references)/);
  expect(digests).toMatch(/rejected a reference/);
});

test("F6/F7/F8: Shoot Photos stay hidden until shown; showing them locks the page", async () => {
  await admin.goto(adminPageUrl);
  await admin.getByText("Page details").click();
  await admin.getByLabel("Favourites limit (optional)").fill("1");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();

  await admin.getByLabel("Choose photos").setInputFiles([fixture("shoot1.png"), fixture("shoot2.jpg")]);
  await admin.getByRole("button", { name: /Upload Shoot Photos/ }).click();
  await expect(admin.getByText("Uploaded", { exact: true })).toHaveCount(2, { timeout: 60_000 });
  expect(await findMail(/are ready/)).toBeUndefined(); // hidden: no email yet

  await admin.getByRole("button", { name: "Show to client and lock" }).click();
  await expect(admin.getByText("Visible to the client")).toBeVisible();
  const mail = await findMail(/Your photos from "Engagement shoot" are ready/);
  expect(mail?.text).toContain("2 new photos have been added");

  await client.goto(privateLink);
  await expect(client.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(client.getByRole("button", { name: /^All\s*2$/ })).toBeVisible();
  await expect(client.getByRole("button", { name: /Favourites\s*0 of 1/ })).toBeVisible();
});

test("F6: favourites respect the page's limit", async () => {
  await client.getByRole("button", { name: "♡ Favourite" }).first().click();
  await expect(client.getByRole("button", { name: /Favourites\s*1 of 1/ })).toBeVisible();
  await client.getByRole("button", { name: "♡ Favourite" }).first().click();
  await expect(client.getByText("You can choose up to 1. Remove a ♥ to choose another.")).toBeVisible();
  await client.reload();
  await expect(client.getByRole("button", { name: /Favourites\s*1 of 1/ })).toBeVisible();
});

test("F1/F8: downloads are full size with all metadata removed", async () => {
  const ids = await client.locator("main .jt img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")!.split("/")[3]));
  for (const id of ids) {
    const res = await client.request.get(`/media/shoot/${id}/original?a=t:${token}&download=1`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    expect((await res.body()).includes("SECRET-SERIAL-123")).toBe(false);
  }
  const zip = await client.request.get(`/download/${encodeURIComponent(`t:${token}`)}`);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const body = await zip.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
  expect(body.includes("SECRET-SERIAL-123")).toBe(false);
});

test("F4/F6: after the lock, accepted references are saved and marked in the client's search", async () => {
  await client.goto("/u/arivera");
  await expect(client.getByRole("heading", { name: "Your references" })).toBeVisible();
  await expect(client.getByText("Your reference", { exact: true })).toHaveCount(2);
  await expect(client.getByText("Your photos are ready, so these are for browsing only.")).toBeVisible();
});

test("F9: client accepts an invite, lands in their area, and can now comment", async () => {
  await admin.goto("/admin/clients");
  await admin.getByRole("link", { name: /Alex Rivera/ }).click();
  await admin.getByRole("button", { name: "Send account invite" }).click();
  await expect(admin.getByText("Invite sent.")).toBeVisible();

  const invite = await findMail(/invited to ReferenceMePlzQQ/);
  await client.goto(linkIn(invite!.text, "/invite/"));
  await expect(client.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await client.getByLabel(/New password/).fill("clientpass1");
  await client.getByLabel("Confirm password").fill("clientpass1");
  await client.getByRole("button", { name: "Create account" }).click();
  await expect(client).toHaveURL(/\/u\/arivera$/);

  await client.goto(privateLink);
  await client.locator("main .jt-frame").first().click();
  await client.getByPlaceholder("Add a comment…").fill("Love this one!");
  await client.getByRole("button", { name: "Post comment" }).click();
  await expect(client.getByRole("dialog").getByText("Love this one!")).toBeVisible();
  await client.keyboard.press("Escape");

  // The invite link only works once.
  await client.goto(linkIn(invite!.text, "/invite/"));
  await expect(client.getByRole("heading", { name: "Link expired" })).toBeVisible();
});

test("F10: client and admin message each other", async () => {
  await client.goto("/u/arivera/messages");
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

  await client.goto("/u/arivera/messages");
  await expect(client.getByText("Sure, 4pm works.")).toBeVisible();
  await expect(client.getByText(/Jack Photo \(Studio\)/)).toBeVisible();
});

test("F12: admin invites need the Super Admin's approval unless the Super Admin sends them", async ({ browser }) => {
  await admin.goto("/admin/team");
  await admin.getByLabel("Name", { exact: true }).fill("Bea Second");
  await admin.getByLabel("Email", { exact: true }).fill("bea@example.com");
  await admin.getByRole("button", { name: "Invite admin" }).click();
  await expect(admin.getByText("Invite sent to bea@example.com.")).toBeVisible();

  const { ctx: beaCtx, page: bea } = await newPage(browser);
  await bea.goto(linkIn((await findMail(/invited to join the studio/, "bea@example.com"))!.text, "/invite/"));
  await bea.getByLabel(/New password/).fill("beapass123");
  await bea.getByLabel("Confirm password").fill("beapass123");
  await bea.getByRole("button", { name: "Create account" }).click();
  await expect(bea).toHaveURL(/\/admin$/);

  await bea.goto("/admin/team");
  await bea.getByLabel("Name", { exact: true }).fill("Cy Third");
  await bea.getByLabel("Email", { exact: true }).fill("cy@example.com");
  await bea.getByRole("button", { name: "Invite admin" }).click();
  await expect(bea.getByText("Invite created. It goes out once the Super Admin approves it.")).toBeVisible();
  expect(await findMail(/invited to join the studio/, "cy@example.com")).toBeUndefined();
  expect((await findMail(/Bea Second wants to add Cy Third/))?.to).toBe("admin@example.com");

  await admin.goto("/admin/team");
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Cy Third (approved)", { exact: false })).toBeVisible();
  expect(await findMail(/invited to join the studio/, "cy@example.com")).toBeTruthy();

  // F14: Bea fills in her profile and shows it on Meet the Team.
  await bea.goto("/admin/team");
  await bea.getByLabel("Role").fill("Second shooter");
  await bea.getByLabel("Short bio").fill("Bea loves window light and film.");
  await bea.getByLabel("Show on the Meet the Team page").check();
  await bea.getByRole("button", { name: "Save profile" }).click();
  await expect(bea.getByText("Saved.")).toBeVisible();
  await beaCtx.close();

  await visitor.goto("/team");
  await expect(visitor.getByRole("heading", { name: "Bea Second" })).toBeVisible();
  await expect(visitor.getByText("Second shooter")).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Jack Photo" })).toHaveCount(0);
});

test("F15: admins set sessions and hours; a client books, and can cancel", async () => {
  await admin.goto("/admin/bookings");
  await admin.getByLabel("Name").fill("Portrait");
  await admin.getByLabel("Length (minutes)").fill("60");
  await admin.getByRole("button", { name: "Add session type" }).click();
  await expect(admin.getByText("Added.")).toBeVisible();

  for (const name of ["Jack Photo", "Bea Second"]) {
    if (name === "Bea Second") await admin.getByRole("link", { name: "Bea Second" }).click();
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
      await admin.getByRole("checkbox", { name: day }).check();
    }
    await admin.getByRole("button", { name: "Save hours" }).click();
    await expect(admin.getByText("Hours saved.")).toBeVisible();
  }

  // Visitors can browse who's free, but must log in to book.
  await visitor.goto("/book");
  await visitor.locator('button[aria-label*="open times"]:not([disabled])').nth(1).click();
  await expect(visitor.getByText("Free: Jack Photo, Bea Second").first()).toBeVisible();
  await visitor.getByText("Free: Jack Photo, Bea Second").first().click();
  await expect(visitor.getByRole("link", { name: "Log in to book" })).toBeVisible();

  await client.goto("/book");
  await client.locator('button[aria-label*="open times"]:not([disabled])').nth(1).click();
  await client.getByText("Free: Jack Photo, Bea Second").first().click();
  await expect(client.getByText("Anyone available")).toBeVisible();
  await client.getByRole("button", { name: "Book this time" }).click();
  await expect(client).toHaveURL(/\/u\/arivera\/bookings\?booked=1$/);
  await expect(client.getByText(/^Portrait, /)).toBeVisible();
  expect((await findMail(/^Booked: Portrait/))?.to).toBe("alex@example.com");
  expect((await findMail(/^New booking: Alex Rivera/))?.to).toBe("admin@example.com");

  await client.goto("/u/arivera");
  await expect(client.getByRole("link", { name: /^Portrait – \d{4}-\d{2}-\d{2}$/ })).toBeVisible();

  await client.goto("/u/arivera/bookings");
  await client.getByRole("button", { name: "Cancel booking" }).click();
  await expect(client.getByText(/. Cancelled$/)).toBeVisible();
  expect(await findMail(/^Alex Rivera cancelled their Portrait/)).toBeTruthy();
});

test("F16: the contact form reaches every admin and the Contact inbox", async () => {
  await visitor.goto("/contact");
  await visitor.getByLabel("Name").fill("Dana Visitor");
  await visitor.getByLabel("Email").fill("dana@example.com");
  await visitor.getByLabel("Message").fill("Do you shoot weddings?");
  await visitor.getByRole("button", { name: "Send message" }).click();
  await expect(visitor.getByText("Thanks! The studio will get back to you by email.")).toBeVisible();
  expect(await findMail(/Contact form: Dana Visitor/, "admin@example.com")).toBeTruthy();
  expect(await findMail(/Contact form: Dana Visitor/, "bea@example.com")).toBeTruthy();

  await admin.goto("/admin/inbox?tab=contact");
  await expect(admin.getByText("Do you shoot weddings?")).toBeVisible();
});

test("F3/F9/F17: turning off the link blocks it and the link visitor's area; the account still works", async () => {
  await admin.goto(adminPageUrl);
  await admin.getByRole("button", { name: "Turn off link" }).click();
  await expect(admin.getByText("The link is turned off.")).toBeVisible();

  expect((await visitor.goto(privateLink))?.status()).toBe(404);
  expect((await visitor.goto("/u/arivera"))?.status()).toBe(404);

  await client.goto("/u/arivera");
  await expect(client.getByText("Engagement shoot")).toBeVisible();
});

test("access: clients can't open admin pages; wrong password is refused", async () => {
  await client.goto("/admin");
  await expect(client).toHaveURL(/\/u\/arivera$/);

  const ctx = await clientCtx.browser()!.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await ctx.close();
});
