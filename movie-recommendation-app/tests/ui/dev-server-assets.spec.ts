import { expect, test } from '@playwright/test';

test('direct routes and navigation load without runtime errors or missing Next assets', async ({ page }) => {
  const pageErrors: string[] = [];
  const missingAssets: string[] = [];

  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/_next/static/') && response.status() >= 400) {
      missingAssets.push(`${response.status()} ${url}`);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your Movie Watchlist' })).toBeVisible();

  await page.goto('/formula');
  await expect(page.getByRole('heading', { name: 'Taste Formula', exact: true })).toBeVisible();

  await page.goto('/movie-explorer');
  await expect(page.getByRole('heading', { name: 'Movie Explorer' })).toBeVisible();

  await page.goto('/recommendations');
  await expect(page.getByRole('heading', { name: /Personalized Recommendations|Movies to Discover/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Personalized Recommendations|Movies to Discover/ })).toBeVisible();

  expect(pageErrors, `Browser runtime errors: ${pageErrors.join('; ')}`).toEqual([]);
  expect(missingAssets, `Missing Next assets: ${missingAssets.join('; ')}`).toEqual([]);
});
