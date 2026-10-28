import { expect, test, type JSHandle, type Locator, type Page } from '@playwright/test';
import { answers, holdNextAnswer } from './support/assistant';

// A phone, where the navigation is a drawer that slides over the conversation.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/*
 * Motion is observed through recordings: a loop in the page reads a value on
 * every animation frame until the motion settles, and the test asserts on the
 * whole recording. What the runner happens to see when its next command lands
 * never decides a result.
 */

// Every animation runs ten times slower, so each one spans many recorded frames.
const SLOW_MOTION = 0.1;
const DRAWER_OPEN_AT = 0;
const DRAWER_WIDTH = 300;
const DRAWER_CLOSED_AT = -DRAWER_WIDTH;

async function slowDownAnimations(page: Page) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Animation.enable');
  await devtools.send('Animation.setPlaybackRate', { playbackRate: SLOW_MOTION });
}

function drawer(page: Page) {
  return page.getByRole('complementary', { name: 'Portfolio navigation', includeHidden: true });
}

function menuButton(page: Page) {
  return page.getByRole('button', { name: 'Open navigation' });
}

function conversation(page: Page) {
  return page.getByRole('list', { name: 'Conversation' });
}

/** A recording in progress; `settled` waits for its last frame and returns every reading. */
interface Recording<Reading> {
  readonly settled: () => Promise<Reading[]>;
}

function recording<Reading>(handle: JSHandle<{ done: Promise<Reading[]> }>): Recording<Reading> {
  return { settled: () => handle.evaluate((running) => running.done) };
}

/** Records the element's left edge on every frame until it rests at `restsAt`. */
async function recordLeftEdge(element: Locator, restsAt: number): Promise<Recording<number>> {
  const handle = await element.evaluateHandle((node, target) => {
    const readings: number[] = [];
    const done = new Promise<number[]>((resolve) => {
      const read = () => {
        const left = node.getBoundingClientRect().left;
        readings.push(left);
        if (left === target) resolve(readings);
        else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    return { done };
  }, restsAt);
  return recording(handle);
}

/**
 * Records the element's left edge on every frame until its slide crosses
 * `holdAt`, and pauses the slide right there, so the visitor's next action
 * lands mid-slide however fast or slow the runner is. The slide is the
 * `translate` transition that moves the element; the transition sits on the
 * drawer's wrapper, so it is found by what it moves rather than on the node.
 */
async function recordLeftEdgeHoldingAt(
  element: Locator,
  holdAt: number,
): Promise<Recording<number>> {
  const handle = await element.evaluateHandle((node, target) => {
    const readings: number[] = [];
    const done = new Promise<number[]>((resolve) => {
      const read = () => {
        const left = node.getBoundingClientRect().left;
        readings.push(left);
        const [first = left] = readings;
        const slide = document
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === 'translate' &&
              animation.effect instanceof KeyframeEffect &&
              animation.effect.target?.contains(node) === true,
          );
        if (slide && Math.sign(left - target) !== Math.sign(first - target)) {
          slide.pause();
          resolve(readings);
        } else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    return { done };
  }, holdAt);
  return recording(handle);
}

/**
 * Records every metric's opacity on each frame they are on screen, from the
 * first frame they render until all of them are fully shown.
 */
async function recordMetricOpacities(page: Page): Promise<Recording<number[]>> {
  const handle = await page.evaluateHandle(() => {
    const frames: number[][] = [];
    const done = new Promise<number[][]>((resolve) => {
      const read = () => {
        const metrics = [...document.querySelectorAll('[aria-label="Key metrics"] li')];
        const opacities = metrics.map((metric) => Number(getComputedStyle(metric).opacity));
        if (opacities.length > 0) frames.push(opacities);
        if (opacities.length > 1 && opacities.every((opacity) => opacity === 1)) resolve(frames);
        else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    return { done };
  });
  return recording(handle);
}

/** Records how far the element is scrolled, on every frame, until it reaches the bottom. */
async function recordScrollTop(scroller: Locator): Promise<Recording<number>> {
  const handle = await scroller.evaluateHandle((node) => {
    const readings: number[] = [];
    const bottom = () => node.scrollHeight - node.clientHeight;
    const done = new Promise<number[]>((resolve) => {
      const read = () => {
        readings.push(node.scrollTop);
        if (bottom() - node.scrollTop < 1) resolve(readings);
        else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    return { done };
  });
  return recording(handle);
}

interface AnswerFrame {
  readonly thinking: boolean;
  readonly length: number;
}

/**
 * Records, on every frame until the conversation is no longer busy, whether
 * the answer is still thinking (its shimmer runs) and how much text it shows.
 */
async function recordAnswer(answer: Locator): Promise<Recording<AnswerFrame>> {
  const handle = await answer.evaluateHandle((article) => {
    const frames: AnswerFrame[] = [];
    const list = article.closest('[aria-busy]');
    const shimmering = () =>
      article
        .getAnimations({ subtree: true })
        .some(
          (animation) => animation instanceof CSSAnimation && animation.animationName === 'shimmer',
        );
    const done = new Promise<AnswerFrame[]>((resolve) => {
      const read = () => {
        frames.push({ thinking: shimmering(), length: article.textContent.length });
        if (list?.getAttribute('aria-busy') === 'false') resolve(frames);
        else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    return { done };
  });
  return recording(handle);
}

function isNonDecreasing(readings: readonly number[]) {
  return readings.every((reading, index) => reading >= (readings[index - 1] ?? reading));
}

function isNonIncreasing(readings: readonly number[]) {
  return isNonDecreasing(readings.map((reading) => -reading));
}

function between(low: number, high: number) {
  return (reading: number) => reading > low && reading < high;
}

async function openDrawer(page: Page) {
  await menuButton(page).click();
}

async function ask(page: Page, question: string) {
  await page.getByLabel('Ask the portfolio assistant a question').fill(question);
  await page.keyboard.press('Enter');
}

// A fast-path answer whose metrics stagger in.
async function askAboutAchievements(page: Page) {
  await ask(page, 'What are his biggest technical achievements?');
}

test.describe('with motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await slowDownAnimations(page);
  });

  test('the drawer slides in from the left edge', async ({ page }) => {
    const slide = await recordLeftEdge(drawer(page), DRAWER_OPEN_AT);
    await openDrawer(page);
    const readings = await slide.settled();

    expect(readings[0]).toBe(DRAWER_CLOSED_AT);
    expect(readings.some(between(DRAWER_CLOSED_AT, DRAWER_OPEN_AT))).toBe(true);
    expect(isNonDecreasing(readings)).toBe(true);
  });

  test('a visitor reverses the drawer mid-slide, both ways', async ({ page }) => {
    const halfway = (from: number, to: number) => (from + to) / 2;

    const opening = await recordLeftEdgeHoldingAt(
      drawer(page),
      halfway(DRAWER_CLOSED_AT, DRAWER_OPEN_AT),
    );
    await openDrawer(page);
    const openingReadings = await opening.settled();
    const heldOpening = openingReadings.at(-1) ?? DRAWER_CLOSED_AT;
    expect(heldOpening).toBeGreaterThan(DRAWER_CLOSED_AT);
    expect(heldOpening).toBeLessThan(DRAWER_OPEN_AT);

    const closing = await recordLeftEdgeHoldingAt(
      drawer(page),
      halfway(heldOpening, DRAWER_CLOSED_AT),
    );
    await page.keyboard.press('Escape');
    const closingReadings = await closing.settled();
    const heldClosing = closingReadings.at(-1) ?? DRAWER_CLOSED_AT;
    expect(closingReadings[0]).toBe(heldOpening);
    expect(isNonIncreasing(closingReadings)).toBe(true);
    expect(heldClosing).toBeGreaterThan(DRAWER_CLOSED_AT);
    expect(heldClosing).toBeLessThan(heldOpening);

    // The drawer now covers the menu button, which closing gave focus to.
    await expect(menuButton(page)).toBeFocused();
    const reopening = await recordLeftEdge(drawer(page), DRAWER_OPEN_AT);
    await page.keyboard.press('Enter');
    const reopeningReadings = await reopening.settled();
    expect(reopeningReadings[0]).toBe(heldClosing);
    expect(reopeningReadings.some(between(heldClosing, DRAWER_OPEN_AT))).toBe(true);
    expect(isNonDecreasing(reopeningReadings)).toBe(true);
    await expect(drawer(page)).toBeVisible();
  });

  test('an answer thinks, then types itself out', async ({ page }) => {
    const releaseAnswer = await holdNextAnswer(page);
    await ask(page, 'What are his strongest technical skills?');
    const answer = answers(page).last();
    await expect(conversation(page)).toHaveAttribute('aria-busy', 'true');

    const reveal = await recordAnswer(answer);
    releaseAnswer();
    const frames = await reveal.settled();

    const typed = frames.filter((frame) => !frame.thinking).map((frame) => frame.length);
    const fullLength = typed.at(-1) ?? 0;
    expect(frames[0]?.thinking).toBe(true);
    expect(typed.some(between(0, fullLength))).toBe(true);
    expect(new Set(typed).size).toBeGreaterThan(10);
    // Not strictly growing: a markdown marker shows until its closing half is
    // typed, then renders away, so the text can dip by a character.
    expect(Math.max(...typed)).toBe(fullLength);
    await expect(conversation(page)).toHaveAttribute('aria-busy', 'false');
  });
});

test.describe('with motion, in a rich answer', () => {
  test('metrics rise one after another', async ({ page }) => {
    await page.goto('/');
    await slowDownAnimations(page);

    const rise = await recordMetricOpacities(page);
    await askAboutAchievements(page);
    const frames = await rise.settled();

    const firstShownAt = frames.findIndex((opacities) => opacities[0] === 1);
    const lastShownAt = frames.findIndex((opacities) => opacities.at(-1) === 1);
    expect(firstShownAt).toBeGreaterThanOrEqual(0);
    expect(lastShownAt).toBeGreaterThan(firstShownAt);
  });
});

test.describe('with prefers-reduced-motion: reduce', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await slowDownAnimations(page);
  });

  test('the drawer is in place on the first frame after opening', async ({ page }) => {
    const slide = await recordLeftEdge(drawer(page), DRAWER_OPEN_AT);
    await openDrawer(page);
    const readings = await slide.settled();

    expect(readings.filter((left) => left !== DRAWER_CLOSED_AT)).toEqual([DRAWER_OPEN_AT]);
    await expect(drawer(page)).toBeVisible();
  });

  test('the drawer is gone on the first frame after closing', async ({ page }) => {
    const opening = await recordLeftEdge(drawer(page), DRAWER_OPEN_AT);
    await openDrawer(page);
    await opening.settled();

    const slide = await recordLeftEdge(drawer(page), DRAWER_CLOSED_AT);
    await page.keyboard.press('Escape');
    const readings = await slide.settled();

    expect(readings.filter((left) => left !== DRAWER_OPEN_AT)).toEqual([DRAWER_CLOSED_AT]);
    await expect(drawer(page)).toBeHidden();
  });

  test('staggered metrics all show on the first frame they render', async ({ page }) => {
    const rise = await recordMetricOpacities(page);
    await askAboutAchievements(page);
    const [firstFrame] = await rise.settled();

    expect(firstFrame?.length).toBeGreaterThan(1);
    expect(firstFrame).toEqual(firstFrame?.map(() => 1));
  });

  test('"Jump to latest" lands on the newest message at once', async ({ page }) => {
    await page.getByRole('button', { name: 'His career' }).click();
    await expect(conversation(page)).toHaveAttribute('aria-busy', 'false');
    await ask(page, 'What are his strongest technical skills?');
    await expect(conversation(page)).toHaveAttribute('aria-busy', 'false');

    const scroller = conversation(page).locator('..');
    await scroller.evaluate((node) => {
      node.scrollTop = 0;
    });
    const jump = await recordScrollTop(scroller);
    await page.getByRole('button', { name: 'Jump to latest' }).click();
    const readings = await jump.settled();

    expect(readings.filter((scrollTop) => scrollTop !== 0)).toHaveLength(1);
  });
});
