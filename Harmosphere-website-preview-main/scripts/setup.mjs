import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try {
  const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const content = template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`);
  await writeFile(new URL('../.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a random local secret. Payments remain disabled.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('.env already exists; no changes made.');
  else throw error;
}
