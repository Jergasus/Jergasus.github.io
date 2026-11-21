import { expect, test, visit, win, openFromIcon } from './fixtures';

// Desktop Chrome default viewport.
const VP = { width: 1280, height: 720 };

// ---------------------------------------------------------------------------
// Drag
// ---------------------------------------------------------------------------

test('dragging the titlebar moves the window and it stays put after a reload in the same tab', async ({
  page,
}) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');
  const titlebar = about.locator('[data-titlebar]');

  const box0 = (await about.boundingBox())!;
  const tbBox = (await titlebar.boundingBox())!;

  // Drag 100 px right, 60 px down from the title area.
  const startX = tbBox.x + 50;
  const startY = tbBox.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 100, startY + 60, { steps: 10 });
  await page.mouse.up();

  const box1 = (await about.boundingBox())!;
  expect(box1.x).toBeGreaterThan(box0.x + 90);
  expect(box1.y).toBeGreaterThan(box0.y + 50);

  // Wait for the debounced persist (200 ms + margin).
  await page.waitForTimeout(400);

  // Reload: the position must be restored from sessionStorage.
  await visit(page, '/');
  const box2 = (await about.boundingBox())!;
  expect(Math.abs(box2.x - box1.x)).toBeLessThan(10);
  expect(Math.abs(box2.y - box1.y)).toBeLessThan(10);
});

// ---------------------------------------------------------------------------
// Bounds clamping
// ---------------------------------------------------------------------------

test('a window cannot be dragged so its titlebar leaves the desktop', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');
  const titlebar = about.locator('[data-titlebar]');
  const tbBox = (await titlebar.boundingBox())!;

  // Try to drag way off the right and bottom edges.
  const startX = tbBox.x + 50;
  const startY = tbBox.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 5000, startY + 5000, { steps: 20 });
  await page.mouse.up();

  const desktop = page.locator('[data-desktop]');
  const desktopBox = (await desktop.boundingBox())!;
  const newBox = (await about.boundingBox())!;

  // At least MIN_VISIBLE_X (64 px) of the window must be reachable.
  expect(newBox.x).toBeLessThanOrEqual(desktopBox.width - 64 + 2); // +2 px tolerance
  // The titlebar row must be reachable vertically (TITLEBAR_H = 30 px).
  expect(newBox.y).toBeLessThanOrEqual(desktopBox.height - 30 + 2);
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

test('resizing from the se corner grows the window and respects the minimum size', async ({
  page,
}) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');
  // Bring to front.
  await about.click();

  const handleSe = about.locator('[data-resize="se"]');
  const box0 = (await about.boundingBox())!;
  const h0 = (await handleSe.boundingBox())!;

  // Grow by 80 px in each direction.
  await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2);
  await page.mouse.down();
  await page.mouse.move(h0.x + h0.width / 2 + 80, h0.y + h0.height / 2 + 80, { steps: 10 });
  await page.mouse.up();

  const box1 = (await about.boundingBox())!;
  expect(box1.width).toBeGreaterThan(box0.width + 70);
  expect(box1.height).toBeGreaterThan(box0.height + 70);

  // Now try to shrink below the about minimum (300 × 220).
  const h1 = (await handleSe.boundingBox())!;
  await page.mouse.move(h1.x + h1.width / 2, h1.y + h1.height / 2);
  await page.mouse.down();
  await page.mouse.move(h1.x - 5000, h1.y - 5000, { steps: 20 });
  await page.mouse.up();

  const box2 = (await about.boundingBox())!;
  expect(box2.width).toBeGreaterThanOrEqual(300); // minSize.w
  expect(box2.height).toBeGreaterThanOrEqual(220); // minSize.h
});

// ---------------------------------------------------------------------------
// Double-click maximise
// ---------------------------------------------------------------------------

test('double-click on the titlebar maximises and restores', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');

  await expect(about).toHaveAttribute('data-maximized', 'false');

  // Double-click the title text (not the buttons).
  await about.locator('.os-title').dblclick();
  await expect(about).toHaveAttribute('data-maximized', 'true');

  // Double-click again to restore.
  await about.locator('.os-title').dblclick();
  await expect(about).toHaveAttribute('data-maximized', 'false');
});

// ---------------------------------------------------------------------------
// Maximised window – drag guard
// ---------------------------------------------------------------------------

test('dragging the titlebar of a maximised window is a no-op and restore returns to pre-maximise rect', async ({
  page,
}) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');
  const titlebar = about.locator('[data-titlebar]');

  // Record the pre-maximise rect (percentage-based default position).
  const box0 = (await about.boundingBox())!;

  // Maximise via the button — avoids the dblclick's first-click drag side-effect
  // which would start pointer capture before the maximize fires.
  await about.locator('[data-win-maximize]').click();
  await expect(about).toHaveAttribute('data-maximized', 'true');

  // Try to drag the titlebar — the window must remain maximised.
  const tbBox = (await titlebar.boundingBox())!;
  const startX = tbBox.x + 50;
  const startY = tbBox.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 100, startY + 60, { steps: 10 });
  await page.mouse.up();

  // Still maximised after the drag attempt.
  await expect(about).toHaveAttribute('data-maximized', 'true');

  // Restore via the button.
  await about.locator('[data-win-maximize]').click();
  await expect(about).toHaveAttribute('data-maximized', 'false');

  // After restore the window returns to the pre-maximise rect.
  const box1 = (await about.boundingBox())!;
  expect(Math.abs(box1.x - box0.x)).toBeLessThan(2);
  expect(Math.abs(box1.y - box0.y)).toBeLessThan(2);
  expect(Math.abs(box1.width - box0.width)).toBeLessThan(2);
  expect(Math.abs(box1.height - box0.height)).toBeLessThan(2);
});

// ---------------------------------------------------------------------------
// Keyboard move + resize
// ---------------------------------------------------------------------------

test('keyboard: arrow keys move the window, Alt+arrows resize it', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  const about = win(page, 'about');
  const moveBtn = about.locator('[data-win-move]');

  const box0 = (await about.boundingBox())!;

  // Focus the move handle.
  await moveBtn.focus();

  // ArrowRight moves 16 px right.
  await page.keyboard.press('ArrowRight');
  const box1 = (await about.boundingBox())!;
  expect(box1.x).toBeCloseTo(box0.x + 16, 0);

  // Alt+ArrowDown grows height by 16 px.
  await page.keyboard.press('Alt+ArrowDown');
  const box2 = (await about.boundingBox())!;
  expect(box2.height).toBeCloseTo(box1.height + 16, 0);
});

// ---------------------------------------------------------------------------
// Arrange
// ---------------------------------------------------------------------------

test('Ordenar ventanas cascades every open window', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  // Open an extra window so there are three to arrange.
  await openFromIcon(page, 'activity');
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');

  // Right-click the desktop and pick "Ordenar ventanas".
  await page.locator('[data-desktop]').click({ button: 'right', position: { x: 400, y: 600 } });
  await page
    .locator('[data-context-menu]')
    .getByRole('menuitem', { name: /Ordenar ventanas/i })
    .click();

  // After cascade all visible windows must have distinct y positions.
  const boxes = await page
    .locator('[data-win-state="open"]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));

  expect(boxes.length).toBeGreaterThan(1);
  expect(new Set(boxes.map(Math.round)).size).toBe(boxes.length);
});

// ---------------------------------------------------------------------------
// Viewport shrink — Review Focus 1
// ---------------------------------------------------------------------------

test('windows stay reachable after the viewport shrinks', async ({ page }) => {
  // Open windows at a wide viewport.
  await page.setViewportSize({ width: 1440, height: 800 });
  await visit(page, '/');

  // Bring both initial windows to front to ensure they have px rects.
  await win(page, 'about').click();
  await win(page, 'projects').click();

  // Shrink the viewport so windows would overflow without reclamp.
  await page.setViewportSize({ width: 1024, height: 600 });

  // Allow the ResizeObserver → reclamp dispatch to settle.
  await page.waitForTimeout(150);

  const vp = page.viewportSize()!;
  const openWindows = page.locator('[data-win-state="open"]');
  const count = await openWindows.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const box = await openWindows.nth(i).boundingBox();
    if (!box) continue;
    // Titlebar (top 30 px) must be reachable vertically.
    expect(box.y, `window[${i}].y`).toBeLessThanOrEqual(vp.height - 30 + 2);
    // At least 64 px must be reachable horizontally.
    expect(box.x, `window[${i}].x`).toBeLessThanOrEqual(vp.width - 64 + 2);
  }
});

// ---------------------------------------------------------------------------
// Focus restore — Review Focus 5
// ---------------------------------------------------------------------------

test('close returns focus to the opener', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');

  // Open activity from its desktop icon (the icon becomes the opener).
  await openFromIcon(page, 'activity');
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');

  // Close the activity window.
  await win(page, 'activity').locator('[data-win-close]').click();
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'closed');

  // Focus must have returned to the icon that opened the window.
  await expect(page.locator('[data-icon="activity"]')).toBeFocused();
});

// ---------------------------------------------------------------------------
// Touch and assistive tech
// ---------------------------------------------------------------------------

// A tablet in landscape gets the desktop: a finger on a titlebar or an edge
// drags the window instead of panning the page (which would cancel the drag).
test('the titlebar and the resize handles keep a touch drag for themselves', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/');
  const about = win(page, 'about');
  const touchAction = (selector: string) =>
    about.locator(selector).evaluateAll((elements) => elements.map((element) => getComputedStyle(element).touchAction));
  expect(await touchAction('[data-titlebar]')).toEqual(['none']);
  expect(await touchAction('[data-resize]')).toEqual(new Array(8).fill('none'));
  // The window's content still scrolls by touch.
  expect(await touchAction('.os-win-body')).not.toEqual(['none']);
});

// A body that scrolls takes focus (for keyboard scrolling) and is a region
// named by its window's title; one that does not scroll is neither.
test('a window body that scrolls is a named region; one that does not is plain', async ({ page }) => {
  await page.setViewportSize(VP);
  await visit(page, '/work/questday/');
  await page.evaluate(() => document.fonts.ready);
  const bodies = await page.locator('[data-app] .os-win-body').evaluateAll((elements) =>
    elements
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({
        app: element.closest('[data-app]')!.getAttribute('data-app'),
        scrolls: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
        tabIndex: element.getAttribute('tabindex'),
        role: element.getAttribute('role'),
        name: element.getAttribute('aria-labelledby'),
      })),
  );
  expect(bodies.some((body) => body.scrolls)).toBe(true);
  for (const body of bodies) {
    const expected = body.scrolls
      ? { tabIndex: '0', role: 'region', name: `${body.app}-title` }
      : { tabIndex: '-1', role: null, name: null };
    expect({ tabIndex: body.tabIndex, role: body.role, name: body.name }, body.app!).toEqual(expected);
  }
  await expect(page.getByRole('region', { name: 'QuestDay' })).toHaveCount(2);
});
