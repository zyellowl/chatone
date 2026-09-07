import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('long pasted text survives sending and the thinking animation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /TypeError|React Router caught/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.addInitScript(() => localStorage.setItem('navVisible', 'false'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/c/new', { waitUntil: 'domcontentloaded' });
  const input = page.getByTestId('text-input');
  await expect(page.getByTestId('model-selector-button')).toContainText('E2E Soft Default');
  await expect(input).toBeEditable();
  const text = `E2E_SLOW_REPLY:long-paste\n${'Long pasted text with 中文, numbers 12345, and punctuation.\n'.repeat(1000)}`;
  await input.fill(text);
  await expect(input).toHaveValue(text);
  const sendBackground = await page
    .getByTestId('send-button')
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  await page.route(/\/api\/(ask|agents)/, async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.continue();
  });
  await page.getByTestId('send-button').click();
  await page.mouse.move(10, 200);
  const orb = page.locator('.chatone-thinking canvas').first();
  await expect(orb).toBeVisible();
  await expect(orb).toHaveCSS('width', '24px');
  const stopButton = page.getByTestId('stop-generation-button');
  await expect(stopButton).toHaveCSS('background-color', sendBackground);
  await expect(stopButton).toHaveCSS('width', '44px');
  await expect(stopButton).toHaveCSS('height', '44px');
  const frame = await orb.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await expect
    .poll(() => orb.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()))
    .not.toBe(frame);
  await page.screenshot({ path: '/tmp/chatone-long-paste-thinking.png' });
  await expect(page.getByText(/E2E slow reply long-paste/).first()).toBeVisible();
  await expect(page.getByTestId('stop-generation-button')).not.toBeVisible({ timeout: 45000 });
  await expect(input).toBeVisible();
  await expect(input).toBeEmpty();
  expect(errors).toEqual([]);
});

test('mobile history swipe opens and closes without losing the draft', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('navVisible', 'false'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/c/new', { waitUntil: 'domcontentloaded' });
  const input = page.getByTestId('text-input');
  await expect(input).toBeVisible();
  await input.fill('Keep my draft');
  const panel = page.getByTestId('mobile-history-panel');
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (from: [number, number], to: [number, number]) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from[0], y: from[1], id: 1 }],
    });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from[0] + ((to[0] - from[0]) * step) / 8,
            y: from[1] + ((to[1] - from[1]) * step) / 8,
            id: 1,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe([16, 350], [18, 220]);
  await expect(panel).toHaveAttribute('inert', '');
  await swipe([16, 350], [240, 350]);
  await expect(panel).not.toHaveAttribute('inert');
  await expect(input).not.toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Chat History' })).toBeInViewport();
  await page.screenshot({ path: '/tmp/chatone-history-swipe-open.png' });
  await swipe([220, 350], [55, 350]);
  await expect(panel).toHaveAttribute('inert', '');
  await expect(input).toHaveValue('Keep my draft');
  await cdp.detach();
});

for (const theme of ['light', 'dark']) {
  test(`Libraries effects preserve chat actions in ${theme} mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((mode) => {
      localStorage.setItem('color-theme', mode);
      localStorage.setItem('i18nextLng', 'en-US');
      localStorage.setItem('navVisible', 'false');
    }, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/c/new', { waitUntil: 'domcontentloaded' });
    const input = page.getByTestId('text-input');
    await expect(input).toBeVisible();
    await expect(page.locator('.chatone-beam[data-beam]')).toBeVisible();
    await expect(page.locator('.chatone-liquid-tools [data-gooey-svg]')).toBeAttached();
    await input.fill('测试一下模型选择后，输入是否保留');
    await expect(page.getByTestId('send-button')).toBeEnabled();
    await expect(page.locator('.chatone-metal canvas')).toBeAttached();
    const sendButton = page.getByTestId('send-button');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toHaveCSS('z-index', '1');
    await expect(page.locator('.chatone-metal-decoration .metal-fx-inner')).toHaveCSS(
      'display',
      'none',
    );
    await expect(
      sendButton.locator('xpath=ancestor::*[contains(@class,"metal-fx-root")]'),
    ).toHaveCount(0);
    const stalledEffect = await page.addStyleTag({
      content:
        '.chatone-metal-decoration { visibility: hidden !important; opacity: 0 !important; }',
    });
    await expect(sendButton).toBeVisible();
    const centerHitsSend = await sendButton.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return button.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      );
    });
    expect(centerHitsSend).toBe(true);
    await stalledEffect.evaluate((style) => style.remove());
    const before = await input.inputValue();
    await page.getByTestId('model-selector-button').click();
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByRole('combobox')).not.toBeFocused();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/tmp/chatone-effects-${theme}-mobile-menu.png` });
    await page.getByRole('button', { name: /Close Menu|关闭菜单/, exact: true }).click();
    await expect(page.getByRole('combobox')).not.toBeVisible();
    await expect(input).toHaveValue(before);
    await expect(page.getByTestId('send-button')).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await input.focus();
    await expect(page.locator('.chatone-beam')).toHaveAttribute('data-active', '');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/chatone-effects-${theme}-mobile.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/tmp/chatone-effects-${theme}-desktop.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.chatone-beam')).not.toHaveAttribute('data-active', '');
    await expect(page.getByTestId('send-button')).toBeEnabled();
    if (theme === 'dark') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.route(/\/api\/(ask|agents)/, async (route) => {
        if (route.request().method() === 'POST' && !route.request().url().endsWith('/abort')) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        await route.continue();
      });
      await input.fill('E2E_SLOW_REPLY:libraries-effects');
      await page.getByTestId('send-button').click();
      await expect(page.locator('.chatone-thinking canvas').first()).toBeVisible();
      const orb = page.locator('.chatone-thinking canvas').first();
      await expect(orb).toHaveCSS('width', '24px');
      const frame = await orb.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
      await expect
        .poll(() => orb.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()))
        .not.toBe(frame);
      await page.screenshot({ path: '/tmp/chatone-effects-thinking.png' });
      const aborted = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/agents/chat/abort') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Stop generating', exact: true }).click();
      await expect(page.locator('.chatone-thinking')).not.toBeVisible({ timeout: 1000 });
      const abortResponse = await aborted;
      expect(abortResponse.ok()).toBe(true);
      const body = abortResponse.request().postDataJSON();
      expect(body.streamId ?? body.conversationId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(errors).toEqual([]);
  });
}

test('installed iOS shell styles do not shift the beam or square the controls', async ({
  page,
}) => {
  const source = readFileSync('custom/ios/ChatOne/Sources/WebView.swift', 'utf8');
  const nativeStyle = source.match(/style\.textContent = `([\s\S]*?)`;/)?.[1];
  expect(nativeStyle).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/c/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('text-input')).toBeVisible();
  await page.addStyleTag({ content: nativeStyle! });
  await page.evaluate(() => document.documentElement.classList.add('chatone-ios', 'chatone-app'));
  await page.getByTestId('text-input').fill('iOS effect bounds');
  await expect(page.locator('.chatone-metal canvas')).toBeAttached();
  await expect(page.getByTestId('chat-composer')).toHaveCSS('margin-bottom', '0px');
  await expect(page.getByTestId('send-button')).toHaveCSS('border-radius', '999px');
  const send = page.getByTestId('send-button');
  const icon = send.locator('svg');
  const microphone = page.getByRole('button', { name: 'Use microphone', exact: true });
  for (const text of ['Aligned send button', '']) {
    await page.getByTestId('text-input').fill(text);
    const [buttonBox, iconBox, micBox] = await Promise.all([
      send.boundingBox(),
      icon.boundingBox(),
      microphone.boundingBox(),
    ]);
    expect(
      Math.abs(buttonBox!.x + buttonBox!.width / 2 - iconBox!.x - iconBox!.width / 2),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(buttonBox!.y + buttonBox!.height / 2 - iconBox!.y - iconBox!.height / 2),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(buttonBox!.y + buttonBox!.height / 2 - micBox!.y - micBox!.height / 2),
    ).toBeLessThan(0.5);
  }
  await page.getByTestId('text-input').fill('Aligned send button');
  const composer = await page.getByTestId('chat-composer').boundingBox();
  const beam = await page.locator('.chatone-beam').boundingBox();
  expect(Math.abs(composer!.height - beam!.height)).toBeLessThan(1);
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/chatone-effects-native-layout.png' });
});

test('mobile settings, attachments, history and new chat preserve navigation state', async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(8000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en-US');
    localStorage.setItem('navVisible', 'false');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/c/new', { waitUntil: 'domcontentloaded' });
  const input = page.getByTestId('text-input');
  await expect(input).toBeVisible();
  await input.fill('Retain this draft through settings');
  await page.locator('#attach-file-menu-button').click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('Retain this draft through settings');

  await page.getByTestId('open-sidebar-button').click();
  await page.getByTestId('nav-user').click();
  await page.getByTestId('nav-settings').click();
  const dialog = page.getByRole('dialog');
  for (const tab of ['General', 'Chat', 'Speech', 'Data & Privacy', 'Account', 'About']) {
    await dialog.getByRole('tab', { name: tab, exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Close Settings', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).first().click();
  await expect(input).toHaveValue('Retain this draft through settings');
  await input.fill('E2E_REPLY:mobile-navigation');
  await page.getByTestId('send-button').click();
  await expect(
    page.getByTestId('messages-view').getByText('E2E reply mobile-navigation', { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const conversationURL = page.url();
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).navigationAudit = 'retained';
  });
  await page.getByTestId('open-sidebar-button').click();
  await page.getByTestId('chatone-new-chat').click();
  await expect(page).toHaveURL(/\/c\/new$/);
  await expect(page.getByTestId('chatone-new-chat')).not.toBeInViewport();
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).navigationAudit),
  ).toBe('retained');
  await page.getByTestId('open-sidebar-button').click();
  await page.getByTestId('convo-item').first().click();
  await expect(page).toHaveURL(conversationURL);
  await expect(page.getByTestId('chatone-new-chat')).not.toBeInViewport();
  await expect(
    page.getByTestId('messages-view').getByText('E2E reply mobile-navigation', { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
});
