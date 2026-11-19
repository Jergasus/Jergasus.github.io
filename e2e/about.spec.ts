import { test, expect } from '@playwright/test';

// Ruling R16: the photo's width comes from a named token (--photo-max), not a
// size utility that collides with the spacing scale (max-w-xs resolved to
// --space-xs and shrank the photo to 8px on phones).
for (const { width, min, max } of [
  // Phones: the photo stands alone above the bio, readable at a glance.
  { width: 375, min: 200, max: 375 - 2 * 16 },
  // Desktop: it fills its third of the content row.
  { width: 1440, min: 280, max: (1440 - 2 * 48) / 3 },
]) {
  test(`about photo is sized for the layout at ${width}px`, async ({ page }) => {
    // Measure the settled layout, with no reveal in flight.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const photo = page.locator('#about img');
    await photo.scrollIntoViewIfNeeded();
    const box = (await photo.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(min);
    expect(box.width).toBeLessThanOrEqual(max);
    // The 800x1000 portrait keeps its proportions.
    expect(box.height / box.width).toBeCloseTo(1.25, 1);
  });
}
