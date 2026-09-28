import { test, expect } from '@playwright/test';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const headers = { Origin: 'http://localhost:3000', 'X-Harmosphere': '1' };
async function latestMail(to: string, purpose: string) {
  let link = '';
  await expect.poll(async () => {
    const directory = '.tools/mailbox';
    const files = await readdir(directory).catch(() => []);
    const messages = await Promise.all(files.filter(f => f.endsWith('.json')).map(async file => ({ time: (await stat(join(directory, file))).mtimeMs, mail: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
    const result = messages.sort((a, b) => b.time - a.time).find(m => m.mail.to === to && m.mail.purpose === purpose);
    link = result?.mail.link ?? ''; return !!link;
  }, { timeout: 10000 }).toBe(true);
  return link;
}

test('public articles and resources have localized bodies and working filters', async ({ page }) => {
  await page.goto('/en/journal');
  await expect(page.getByRole('heading', { name: 'Between the notes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A melody, and two hands' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The art of listening again' })).toHaveCount(0);
  await page.getByRole('link', { name: /Read the story/ }).click();
  await expect(page.getByText('A piano arrangement does not need', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: 'Uma melodia e duas mãos' })).toBeVisible();
  await page.goto('/en/resources');
  await page.getByRole('link', { name: /Open resource/ }).click();
  await expect(page.getByRole('button', { name: 'Print / save as PDF' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.getByText('MINUTE 10', { exact: false })).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.goto('/en/journal/not-a-published-entry');
  await expect(page.getByText('This publication is not available.')).toBeVisible();
});

test('verification and password recovery use the local mailbox and revoke sessions', async ({ page }) => {
  const email = `account-${Date.now()}@example.com`;
  const registration = await page.request.post('/api/auth/register', { headers, data: { email, password: 'an initial long local test password' } });
  expect(registration.ok()).toBe(true);
  await page.goto('/en/account');
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByText('A verification message has been prepared.', { exact: false })).toBeVisible();
  await page.goto(await latestMail(email, 'VERIFY_EMAIL'));
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText('Your email has been verified.', { exact: true })).toBeVisible();
  await page.goto('/en/account'); await expect(page.getByText('Email verified', { exact: true })).toBeVisible();
  await page.goto('/en/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Request reset link' }).click();
  await expect(page.getByText('If this email belongs', { exact: false })).toBeVisible();
  const resetLink = await latestMail(email, 'RESET_PASSWORD');
  await page.goto(resetLink);
  await page.getByLabel('New password').fill('a different long local test password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Your password has been changed.', { exact: false })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect((await page.request.post('/api/auth/login', { headers, data: { email, password: 'a different long local test password' } })).ok()).toBe(true);
  await page.goto(resetLink);
  await page.getByLabel('New password').fill('yet another long local password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('This link is invalid, expired or already used.', { exact: false })).toBeVisible();
});

test('configured local editor can draft, publish and unpublish without exposing raw HTML', async ({ page }) => {
  const email = process.env.LOCAL_EDITOR_EMAIL;
  test.skip(!email, 'Set LOCAL_EDITOR_EMAIL on both the local API and this test command.');
  const password = 'local editor test password with enough length';
  const registration = await page.request.post('/api/auth/register', { headers, data: { email, password } });
  if (registration.status() === 409) expect((await page.request.post('/api/auth/login', { headers, data: { email, password } })).ok()).toBe(true);
  else expect(registration.ok()).toBe(true);
  await page.goto('/en/account');
  await expect(page.getByRole('heading', { name: email!, exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Send verification link' }).count()) {
    await page.getByRole('button', { name: 'Send verification link' }).click();
    await page.goto(await latestMail(email!, 'VERIFY_EMAIL'));
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page.getByText('Your email has been verified.', { exact: true })).toBeVisible();
  }
  await page.goto('/en/studio');
  const slug = `local-editor-${Date.now()}`;
  await page.getByLabel('URL identifier').fill(slug);
  for (const language of ['en', 'pt-BR', 'es']) {
    await page.getByLabel('Translation language').selectOption(language);
    await page.getByLabel('Title', { exact: true }).fill(`A local studio test ${language}`);
    await page.getByLabel('Introduction', { exact: true }).fill('An introductory paragraph written in the local studio.');
    await page.getByLabel('Body — separate paragraphs with a blank line').fill('A complete paragraph for a local publication.\n\n<script>window.editorInjected = true</script>');
  }
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  expect((await page.request.get(`/api/content/entry/${slug}`)).status()).toBe(404);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Open publication' }).click();
  await expect(page.getByText('<script>window.editorInjected = true</script>', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { editorInjected?: boolean }).editorInjected)).toBeUndefined();
  await page.goto('/en/studio');
  await page.getByRole('button', { name: /A local studio test en/ }).first().click();
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  expect((await page.request.get(`/api/content/entry/${slug}`)).status()).toBe(404);
});
