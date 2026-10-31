import { expect, test } from '@playwright/test';

test.describe('3D Interactive Landmark & Gesture Showcase (Three.js)', () => {
  test('renders 3D canvas, loads Three.js, and responds to pose switching and dual hand toggle', async ({ page }) => {
    // Navigate to the interactive Three.js showcase
    await page.goto('/showcase/');

    // Verify page header and studio title
    await expect(page.locator('h1')).toContainText('Articulated in 3D');

    // Verify 3D canvas is mounted
    const canvas = page.locator('#stage-canvas');
    await expect(canvas).toBeVisible();

    // Verify the pose buttons are rendered
    const namasteBtn = page.getByRole('button', { name: 'Dual Namaste' });
    const victoryBtn = page.getByRole('button', { name: 'Victory Sign' });
    const thumbsUpBtn = page.getByRole('button', { name: 'Thumbs Up' });

    await expect(namasteBtn).toBeVisible();
    await expect(victoryBtn).toBeVisible();
    await expect(thumbsUpBtn).toBeVisible();

    // Switch to Dual Namaste pose
    await namasteBtn.click();
    await expect(page.locator('#hud-pose-title')).toContainText('DUAL NAMASTE');

    // Switch to Victory pose
    await victoryBtn.click();
    await expect(page.locator('#hud-pose-title')).toContainText('VICTORY');

    // Toggle dual hand button off
    const dualToggleBtn = page.locator('#toggle-hands-btn');
    await expect(dualToggleBtn).toBeVisible();
    await dualToggleBtn.click();
    await expect(page.locator('#hud-pose-title')).toContainText('21 LANDMARKS');

    // Toggle dual hand button back on
    await dualToggleBtn.click();
    await expect(page.locator('#hud-pose-title')).toContainText('42 LANDMARKS (DUAL)');

    // Verify Inspector Card element exists
    await expect(page.locator('#joint-card')).toBeAttached();

    // Verify Return to Communicator App link exists
    const returnLink = page.getByRole('link', { name: /Back to Communicator/i });
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute('href', '/');
  });

  test('topbar in main app contains 3D View showcase link', async ({ page }) => {
    await page.goto('/');
    const link = page.getByTitle('Open interactive 3D hand and landmark showcase');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/showcase/');
  });
});
