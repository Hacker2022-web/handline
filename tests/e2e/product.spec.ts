import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const status = {
  local: { ready: true, installed: true, model: 'gemma4:12b', message: 'Ready on this device.', memoryGB: 16 },
  cloud: { configured: false, model: 'gemma-4-26b-a4b-it', message: 'Add GEMINI_API_KEY to .env.' },
};
async function prepare(page: Page) {
  await page.route('**/api/status', route => route.fulfill({ json: status }));
  const image = `data:image/jpeg;base64,${(await readFile(new URL('../fixtures/thumb_up.jpg', import.meta.url))).toString('base64')}`;
  const unknownImage = `data:image/jpeg;base64,${(await readFile(new URL('../fixtures/pointing_up.jpg', import.meta.url))).toString('base64')}`;
  await page.addInitScript(({ image, unknownImage }) => {
    const state = { pose: 'hand', speech: [] as string[], tracksStopped: 0 };
    Object.assign(window, { __handlineTest: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const img = new Image(); img.src = image; await img.decode();
      const unknown = new Image(); unknown.src = unknownImage; await unknown.decode();
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      const paint = () => {
        ctx.fillStyle = '#d9ded3'; ctx.fillRect(0, 0, 640, 480);
        if (state.pose !== 'blank') {
          const source = state.pose === 'unknown' ? unknown : img;
          const scale = Math.min(640 / source.width, 480 / source.height);
          ctx.drawImage(source, (640 - source.width * scale) / 2, (480 - source.height * scale) / 2, source.width * scale, source.height * scale);
        }
      };
      paint(); const interval = setInterval(paint, 70); const stream = canvas.captureStream(15);
      const track = stream.getTracks()[0], nativeStop = track.stop.bind(track);
      track.stop = () => { state.tracksStopped++; clearInterval(interval); nativeStop(); };
      return stream;
    } });
    const voice = { name: 'Test local voice', voiceURI: 'test-local', lang: 'en-IN', localService: true, default: true };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class {
      text: string; voice = null; rate = 1;
      constructor(text: string) { this.text = text; }
    } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [voice], cancel: () => {}, addEventListener: () => {}, removeEventListener: () => {},
      speak: (utterance: SpeechSynthesisUtterance) => { state.speech.push(utterance.text); },
    } });
  }, { image, unknownImage });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Yes Thumbs up', exact: true })).toBeVisible();
}
async function speechCalls(page: Page) { return page.evaluate(() => (window as unknown as { __handlineTest: { speech: string[] } }).__handlineTest.speech); }
async function pose(page: Page, next: string) { await page.evaluate(p => { (window as unknown as { __handlineTest: { pose: string } }).__handlineTest.pose = p; }, next); }
async function enroll(page: Page, name: string, phrase: string) {
  await page.getByRole('button', { name: 'Add a gesture', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Gesture name').fill(name);
  await dialog.getByLabel('Exact phrase').fill(phrase);
  if (await dialog.getByRole('button', { name: 'Start camera', exact: true }).isVisible()) await dialog.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(dialog.getByText('One hand detected', { exact: true })).toBeVisible();
  for (let i = 1; i <= 8; i++) await dialog.getByRole('button', { name: `Capture sample ${i}`, exact: true }).click();
  const acknowledge = dialog.getByRole('checkbox');
  if (await acknowledge.isVisible()) await acknowledge.check();
  await dialog.getByRole('button', { name: 'Save gesture', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('manual phrases, exact preset edits, enable switches, undo, and reload persistence', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Yes Thumbs up', exact: true }).click();
  await expect(page.locator('.message-text')).toHaveText('Yes');
  await page.getByRole('button', { name: 'Hello Open palm', exact: true }).click();
  await expect(page.locator('.message-text')).toHaveText('Hello');
  await page.getByRole('button', { name: 'Undo last message' }).click();
  await expect(page.locator('.message-text')).toHaveText('Yes');
  await page.getByRole('button', { name: 'Gesture library', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Thumbs up', exact: true }).click();
  await page.getByLabel('Exact phrase').fill('Yes, that works for me.');
  await page.getByRole('button', { name: 'Save gesture', exact: true }).click();
  await page.getByRole('switch', { name: 'Enable Thumbs down', exact: true }).uncheck();
  await expect(page.getByRole('status').getByText('Thumbs down saved on this device.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Yes, that works for me. Thumbs up', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No Thumbs down', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Yes, that works for me. Thumbs up', exact: true }).click();
  await expect(page.locator('.message-text')).toHaveText('Yes, that works for me.');
});

test('real MediaPipe preset tracking holds once, stays silent for unknown, and repeats after release', async ({ page }) => {
  await prepare(page); let modelRequests = 0;
  await page.route('**/api/verify-gesture', async route => { modelRequests++; await route.fulfill({ json: { gestureId: 'unknown' } }); });
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause recognition', exact: true })).toBeVisible();
  await expect(page.locator('.message-text')).toHaveText('Yes', { timeout: 30_000 });
  await expect.poll(async () => (await speechCalls(page)).length).toBe(1);
  await page.waitForTimeout(1700);
  expect(await speechCalls(page)).toEqual(['Yes']);
  await pose(page, 'blank');
  await expect(page.getByText('Unknown gesture', { exact: true })).toBeVisible();
  await page.waitForTimeout(850); expect(await speechCalls(page)).toEqual(['Yes']);
  await pose(page, 'hand');
  await expect.poll(async () => (await speechCalls(page)).length).toBe(2);
  await pose(page, 'unknown');
  await expect(page.getByText('Unknown gesture', { exact: true })).toBeVisible();
  await page.waitForTimeout(1200); expect(await speechCalls(page)).toEqual(['Yes', 'Yes']);
  await page.getByRole('button', { name: 'Pause recognition', exact: true }).click();
  await expect(page.getByText('Recognition is paused.', { exact: true })).toBeVisible();
  await page.waitForTimeout(1200); expect(await speechCalls(page)).toEqual(['Yes', 'Yes']);
  expect(modelRequests).toBe(0);
  await page.getByRole('button', { name: 'Turn off camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start camera', exact: true })).toBeVisible();
});

test('two custom gestures enroll, overlap warnings appear, survive reload, support editing and deletion', async ({ page }) => {
  await prepare(page);
  await enroll(page, 'A drink', 'Water, please.');
  await enroll(page, 'A rest', 'A break, please.');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Water, please. A drink', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A break, please. A rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gesture library', exact: true }).click();
  await page.getByRole('button', { name: 'Edit A drink', exact: true }).click();
  await page.getByLabel('Exact phrase').fill('A glass of water, please.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save gesture', exact: true }).click();
  await page.getByRole('button', { name: 'Delete A rest', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete gesture', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A rest', exact: true })).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'A glass of water, please. A drink', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A break, please. A rest', exact: true })).not.toBeVisible();
});

test('cloud mode requires consent, runtime settings persist, and permission resets on reload', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await expect(page.getByText('Cloud custom gestures need image permission.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Runtime & setup', exact: true }).click();
  const consent = page.getByRole('checkbox', { name: 'I allow selected hand images', exact: false });
  await expect(consent).not.toBeChecked(); await consent.check();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Online', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Runtime & setup', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'I allow selected hand images', exact: false })).not.toBeChecked();
  await expect(page.getByText('API key needed', { exact: true })).toBeVisible();
});

test('trial recording distinguishes misses and unknown rejections; manual phrases never count', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Practice log', exact: true }).click();
  await page.getByLabel('Expected gesture').selectOption('preset-yes');
  await page.getByRole('button', { name: 'Start trial', exact: true }).click();
  await page.getByRole('button', { name: 'Yes Thumbs up', exact: true }).click();
  await page.getByRole('button', { name: 'Finish trial', exact: true }).click();
  await expect(page.getByText('Missed gesture', { exact: true })).toBeVisible();
  await page.getByLabel('Expected gesture').selectOption('unknown');
  await page.getByRole('button', { name: 'Start trial', exact: true }).click();
  await page.getByRole('button', { name: 'Finish trial', exact: true }).click();
  await expect(page.getByText('Correct rejection', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Practice log', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('desktop and mobile views stay within viewport; static assets have no remote dependency', async ({ page }) => {
  const remote: string[] = [];
  page.on('request', request => { if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:5173')) remote.push(request.url()); });
  await prepare(page);
  await page.screenshot({ path: 'docs/handline-desktop.png', fullPage: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Communicate', 'Gesture library', 'Practice log', 'Runtime & setup']) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} at ${width}px`).toBe(true);
    }
    if (width === 390) { await page.getByRole('button', { name: 'Communicate', exact: true }).click(); await page.screenshot({ path: 'docs/handline-mobile.png', fullPage: true }); }
  }
  expect(remote).toEqual([]);
});

test('live local Gemma verifies an enrolled custom pose through the real app endpoint', async ({ page }) => {
  test.skip(process.env.HANDLINE_LIVE_MODEL !== '1', 'Opt in with HANDLINE_LIVE_MODEL=1; requires the installed local Gemma model.');
  test.setTimeout(150_000);
  await prepare(page);
  await enroll(page, 'A drink', 'Water, please.');
  const remoteRequests: string[] = [];
  page.on('request', request => { if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:5173')) remoteRequests.push(request.url()); });
  await page.locator('.paused-overlay').getByRole('button', { name: 'Resume recognition', exact: true }).click();
  await expect(page.locator('.message-text')).toHaveText('Water, please.', { timeout: 125_000 });
  await expect.poll(async () => (await speechCalls(page)).length).toBe(1);
  expect(await speechCalls(page)).toEqual(['Water, please.']);
  expect(remoteRequests).toEqual([]);
});
