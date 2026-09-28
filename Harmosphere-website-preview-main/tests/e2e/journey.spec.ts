import { test, expect } from '@playwright/test';

test('anonymous quiz, reload recovery, login gate, and locked full result', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HARMOSPHERE');
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
  await page.getByRole('link', { name: /Discover my musical compass/ }).click();
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.getByRole('radio', { name: '4 Agree', exact: false }).check();
  await expect(page.getByText('Progress saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Question 2 of 30')).toBeVisible();
  for (let n = 2; n <= 30; n++) {
    await expect(page.getByText(`Question ${n} of 30`)).toBeVisible();
    await page.getByRole('radio', { name: /4 Agree/ }).check();
    await expect(page.getByText('Progress saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: n === 30 ? /Discover my profile/ : /^Next/ }).click();
  }
  await expect(page).toHaveURL(/\/en\/signin\?claim=1/);
  await page.getByLabel('Email address').fill(`journey-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('a long unique test password 42');
  await page.getByRole('button', { name: /Create account/ }).click();
  await expect(page).toHaveURL(/\/en\/results\/[a-f0-9-]+/);
  await expect(page.getByText('YOUR FREE PROFILE', { exact: true })).toBeVisible();
  await expect(page.getByText('Checkout is not available yet.', { exact: false })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const denied = await page.request.get(`/api/quiz/results/${id}/full`);
  expect(denied.status()).toBe(404);
  await page.reload(); await expect(page.getByText('YOUR FREE PROFILE', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/result-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('translations and mobile landing do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HARMOSPHERE');
  await expect(page.getByRole('link', { name: /Descobrir minha bússola musical/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('es');
  await expect(page.getByText('Piano · Manos · Sonido')).toBeVisible();
});

test('a failed save survives reload and cannot silently advance', async ({ page }) => {
  await page.goto('/en/quiz');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.route('**/api/quiz/current/answer', route => route.abort('failed'));
  await page.getByRole('radio', { name: /4 Agree/ }).check();
  await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Question 1 of 30')).toBeVisible();
  await expect(page.getByRole('radio', { name: /4 Agree/ })).toBeChecked();
  await page.unroute('**/api/quiz/current/answer');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Progress saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Question 2 of 30')).toBeVisible();
  await page.goto('/en/signin?claim=1');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR');
  await expect(page).toHaveURL(/\/pt-BR\/signin\?claim=1/);
});
