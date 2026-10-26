import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-admin-password";

// Each test acts as a different visitor so the per-IP rate limiter doesn't couple tests together.
let ipCounter = 0;
const nextIp = () =>
  `10.${Math.floor(Date.now() / 1000) % 250}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`;
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });
});

function watch(page: Page) {
  const problems: string[] = [];
  page.on(
    "console",
    (m) => m.type() === "error" && problems.push(`console: ${m.text()}`),
  );
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on(
    "requestfailed",
    (r) =>
      r.failure()?.errorText !== "net::ERR_ABORTED" &&
      problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on(
    "response",
    (r) =>
      r.status() >= 400 &&
      r.status() !== 404 &&
      problems.push(`http ${r.status()}: ${r.url()}`),
  );
  return problems;
}

// Mon–Thu only: full-length days, so tests don't depend on which weekday they run on.
const dayLinks = (page: Page) =>
  page.getByRole("link", { name: /^(Mon|Tue|Wed|Thu) \w{3} \d+$/ });
const slotLinks = (page: Page) =>
  page.getByRole("link", { name: /^\d{1,2}:\d{2} (AM|PM)$/ });

/** Opens /book for a service and picks the nth open day (so the day is a full, future one). */
async function openDay(page: Page, service: string, dayIndex: number) {
  await page.goto(`/book?service=${service}`);
  await dayLinks(page).nth(dayIndex).click();
  await expect(
    page.getByRole("heading", { name: "3. Pick a time" }),
  ).toBeVisible();
  await expect(slotLinks(page).first()).toBeVisible();
}

async function book(page: Page, name: string, email: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Confirm booking" }).click();
}

test.describe("public pages", () => {
  for (const path of ["/", "/book?service=maths-60", "/admin"]) {
    test(`${path}: no console errors, no axe violations, no horizontal scroll`, async ({
      page,
    }) => {
      const problems = watch(page);
      await page.goto(path, { waitUntil: "networkidle" });
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        axe.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });
  }

  test("footer labels the site as a sample project", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText("Sample project");
  });
});

test.describe("booking flow", () => {
  test("book a session end to end, then the slot is gone", async ({
    page,
  }, info) => {
    const problems = watch(page);
    await page.goto("/");
    await page.getByRole("link", { name: "Book Maths tutoring" }).click();
    await expect(page).toHaveURL(/service=maths-60/);
    await dayLinks(page).nth(2).click();

    const slot = slotLinks(page).nth(
      info.project.name.startsWith("mobile") ? 1 : 3,
    );
    const label = (await slot.textContent())!.trim();
    await slot.click();
    await expect(
      page.getByRole("heading", { name: "Your details" }),
    ).toBeVisible();

    await book(page, "Flow Tester", "flow@example.com");
    await expect(
      page.getByRole("heading", { name: /You.re booked/ }),
    ).toBeVisible();
    const ref = (await page.getByTestId("reference").textContent())!.trim();
    expect(ref).toMatch(/^[A-Z2-9]{8}$/);
    await expect(page.getByText("Flow Tester")).toBeVisible();

    const ics = await page.request.get(`/booking/${ref}/calendar.ics`);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VEVENT");

    await openDay(page, "maths-60", 2);
    await expect(
      slotLinks(page).filter({ hasText: new RegExp(`^${label}$`) }),
    ).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("shows validation errors and keeps the user on the form", async ({
    page,
  }) => {
    await openDay(page, "maths-60", 3);
    await slotLinks(page).first().click();
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByText("Please enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page).toHaveURL(/book\/details/);
  });

  test("double booking is prevented: second person gets a clear message", async ({
    browser,
  }, info) => {
    const project = info.project.use;
    const ctxA = await browser.newContext({
      viewport: project.viewport,
      isMobile: project.isMobile,
    });
    const ctxB = await browser.newContext({
      viewport: project.viewport,
      isMobile: project.isMobile,
    });
    const [a, b] = [await ctxA.newPage(), await ctxB.newPage()];
    await a.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });
    await b.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });

    await openDay(a, "maths-60", 4);
    const href = await slotLinks(a).nth(5).getAttribute("href");
    await a.goto(href!);
    await b.goto(href!); // both people are looking at the same slot
    await book(a, "First Person", "first@example.com");
    await expect(
      a.getByRole("heading", { name: /You.re booked/ }),
    ).toBeVisible();

    await book(b, "Second Person", "second@example.com");
    await expect(b.locator("main [role=alert]")).toContainText("just taken");
    await expect(
      b.getByRole("link", { name: "Choose another time" }),
    ).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });

  test("overlapping times from a different service are also blocked", async ({
    page,
  }) => {
    await openDay(page, "maths-60", 5);
    const first = slotLinks(page).nth(2);
    const label = (await first.textContent())!.trim();
    await first.click();
    await book(page, "Overlap Tester", "overlap@example.com");
    await expect(
      page.getByRole("heading", { name: /You.re booked/ }),
    ).toBeVisible();

    await openDay(page, "test-prep-90", 5);
    const offered = await slotLinks(page).allTextContents();
    expect(offered).not.toContain(label);
    expect(offered.length).toBeGreaterThan(0);
  });

  test("tampered or unknown inputs are rejected", async ({ page }) => {
    await page.goto(
      "/book/details?service=maths-60&start=2020-01-06T15:00:00.000Z",
    );
    await expect(
      page.getByRole("heading", { name: /isn.t available/ }),
    ).toBeVisible();
    await page.goto("/book/details?service=nope&start=garbage");
    await expect(
      page.getByRole("heading", { name: /isn.t available/ }),
    ).toBeVisible();
    expect((await page.goto("/booking/ZZZZZZZZ"))?.status()).toBe(404);
    expect((await page.goto("/booking/bad"))?.status()).toBe(404);
    await page.goto("/book?service=%27%3Bdrop&date=2026-02-30");
    await expect(
      page.getByRole("heading", { name: "Book a session" }),
    ).toBeVisible();
  });
});

test.describe("admin", () => {
  test("rejects a wrong password, requires login, lists, filters and cancels", async ({
    page,
  }, info) => {
    const problems = watch(page);

    const email = `admin-${info.project.name}@example.com`;
    await openDay(page, "intro-chat", 6);
    await slotLinks(page)
      .nth(info.project.name.startsWith("mobile") ? 0 : 2)
      .click();
    await book(page, "Admin Target", email);
    await expect(
      page.getByRole("heading", { name: /You.re booked/ }),
    ).toBeVisible();
    const ref = (await page.getByTestId("reference").textContent())!.trim();

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Admin sign in" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);

    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect password.")).toBeVisible();

    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

    await page.getByLabel("Search").fill(ref.toLowerCase());
    await page.getByRole("button", { name: "Filter" }).click();
    const rows = page.getByTestId("booking-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(email);
    await expect(rows.first()).toHaveAttribute("data-status", "CONFIRMED");

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await rows.first().getByText("Cancel").first().click();
    await rows
      .first()
      .getByRole("button", { name: /Confirm cancel/ })
      .click();
    await expect(rows.first()).toHaveAttribute("data-status", "CANCELLED");
    await expect(
      rows.first().getByRole("button", { name: /Confirm cancel/ }),
    ).toHaveCount(0);

    await page.goto("/admin?status=CONFIRMED&q=" + ref);
    await expect(page.getByText("No bookings match.")).toBeVisible();
    await page.goto("/admin?status=CANCELLED&q=" + ref);
    await expect(rows).toHaveCount(1);

    await page.goto(`/booking/${ref}`);
    await expect(
      page.getByRole("heading", { name: "This booking was cancelled" }),
    ).toBeVisible();
    expect(
      (await page.request.get(`/booking/${ref}/calendar.ics`)).status(),
    ).toBe(404);

    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Admin sign in" }),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a forged session cookie does not grant access", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: "admin_session",
        value: `${Date.now() + 1e7}.deadbeef`,
        url: baseURL!,
      },
    ]);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Admin sign in" }),
    ).toBeVisible();
  });
});

test("booking form is rate limited per visitor", async ({ page }, info) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": info.project.name.startsWith("mobile")
      ? "203.0.113.77"
      : "203.0.113.78",
  });
  await openDay(page, "maths-60", 3);
  await slotLinks(page).first().click();
  for (let i = 0; i < 11; i++) {
    await page.getByLabel("Email").fill("bad");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    if (i < 10)
      await expect(page.getByText("Please enter your name.")).toBeVisible();
  }
  await expect(page.locator("main [role=alert]")).toContainText(
    "Too many attempts",
  );
});
