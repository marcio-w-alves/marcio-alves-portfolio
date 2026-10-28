import { expect, test, type Locator, type Page } from '@playwright/test';

// A phone, where the navigation is a drawer that slides over the conversation.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

// Every animation runs ten times slower, so a frame sampled right after an
// action lands well inside the motion it started.
const SLOW_MOTION = 0.1;

async function slowDownAnimations(page: Page) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Animation.enable');
  await devtools.send('Animation.setPlaybackRate', { playbackRate: SLOW_MOTION });
}

function drawer(page: Page) {
  return page.getByRole('complementary', { name: 'Portfolio navigation', includeHidden: true });
}

/** Where the drawer's left edge is on the next painted frame. */
function leftEdgeNextFrame(element: Locator) {
  return element.evaluate(
    (node) =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          resolve(node.getBoundingClientRect().left);
        });
      }),
  );
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: 'Open navigation' }).click();
}

// A fast-path answer whose metrics stagger in.
async function askAboutAchievements(page: Page) {
  await page
    .getByLabel('Ask the portfolio assistant a question')
    .fill('What are his biggest technical achievements?');
  await page.keyboard.press('Enter');
}

/** Each metric's opacity on the first frame painted after the metrics appear. */
async function metricOpacitiesNextFrame(page: Page) {
  const metrics = page.getByRole('region', { name: 'Key metrics' }).getByRole('listitem');
  await expect(metrics.first()).toBeAttached();
  return metrics.evaluateAll(
    (items) =>
      new Promise<string[]>((resolve) => {
        requestAnimationFrame(() => {
          resolve(items.map((item) => getComputedStyle(item).opacity));
        });
      }),
  );
}

test.describe('with motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await slowDownAnimations(page);
  });

  test('the drawer slides in from the left edge', async ({ page }) => {
    await openDrawer(page);

    expect(await leftEdgeNextFrame(drawer(page))).toBeLessThan(0);
    await expect.poll(() => leftEdgeNextFrame(drawer(page)), { timeout: 10_000 }).toBe(0);
  });

  test('a visitor reverses the drawer mid-slide, both ways', async ({ page }) => {
    await openDrawer(page);
    await expect.poll(() => leftEdgeNextFrame(drawer(page))).toBeGreaterThan(-200);

    await page.keyboard.press('Escape');
    const whenEscaped = await leftEdgeNextFrame(drawer(page));
    await expect.poll(() => leftEdgeNextFrame(drawer(page))).toBeLessThan(whenEscaped - 20);
    const whenReopened = await leftEdgeNextFrame(drawer(page));
    expect(whenReopened).toBeGreaterThan(-300);

    await openDrawer(page);
    await expect.poll(() => leftEdgeNextFrame(drawer(page))).toBeGreaterThan(whenReopened + 20);
    await expect(drawer(page)).toBeVisible();
    await expect.poll(() => leftEdgeNextFrame(drawer(page)), { timeout: 10_000 }).toBe(0);
  });
});

test.describe('with motion, in a rich answer', () => {
  test('metrics rise one after another', async ({ page }) => {
    await page.goto('/');
    await slowDownAnimations(page);

    await askAboutAchievements(page);
    const opacities = await metricOpacitiesNextFrame(page);

    expect(Number(opacities.at(-1))).toBeLessThan(Number(opacities[0]));
  });
});

test.describe('with prefers-reduced-motion: reduce', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await slowDownAnimations(page);
  });

  test('the drawer is in place on the first frame after opening', async ({ page }) => {
    await openDrawer(page);

    expect(await leftEdgeNextFrame(drawer(page))).toBe(0);
    await expect(drawer(page)).toBeVisible();
  });

  test('the drawer is gone on the first frame after closing', async ({ page }) => {
    await openDrawer(page);
    await expect.poll(() => leftEdgeNextFrame(drawer(page))).toBe(0);

    await page.keyboard.press('Escape');

    expect(await leftEdgeNextFrame(drawer(page))).toBeLessThanOrEqual(-300);
    await expect(drawer(page)).toBeHidden();
  });

  test('staggered metrics all show on the first frame they render', async ({ page }) => {
    await askAboutAchievements(page);
    const opacities = await metricOpacitiesNextFrame(page);

    expect(opacities.length).toBeGreaterThan(1);
    expect(opacities).toEqual(opacities.map(() => '1'));
  });

  test('"Jump to latest" lands on the newest message at once', async ({ page }) => {
    const conversation = page.getByRole('list', { name: 'Conversation' });
    await page.getByRole('button', { name: 'His career' }).click();
    await expect(conversation).toHaveAttribute('aria-busy', 'false');
    await page
      .getByLabel('Ask the portfolio assistant a question')
      .fill('What are his strongest technical skills?');
    await page.keyboard.press('Enter');
    await expect(conversation).toHaveAttribute('aria-busy', 'false');

    const scroller = conversation.locator('..');
    await scroller.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.getByRole('button', { name: 'Jump to latest' }).click();

    const distanceFromBottom = await scroller.evaluate(
      (node) => node.scrollHeight - node.scrollTop - node.clientHeight,
    );
    expect(distanceFromBottom).toBeLessThan(1);
  });
});
