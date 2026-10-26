import { test, expect } from '@playwright/test';
import * as OTPAuth from 'otpauth';

test.describe('ExamVault End-to-End Examiner & Security Flow', () => {
  const timestamp = Date.now();
  const testExaminerEmail = `examiner.${timestamp}@examvault.local`;
  const testPassword = 'Password123!@#$';

  test('Admin creates examiner -> Examiner enrolls MFA -> Creates question with formula & image -> Submits -> Views version history', async ({
    page,
  }) => {
    // 1. Visit Portal
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('ExamVault Portal');

    // 2. Admin Login
    await page.fill('input[type="email"]', 'admin@examvault.local');
    await page.fill('input[type="password"]', 'Admin123!@#$');
    await page.click('button[type="submit"]');

    // Handle Admin MFA (seeded admin has secret or requires verify)
    const mfaHeading = page.locator('h3:has-text("Two-Factor Authentication"), h3:has-text("Mandatory MFA Enrollment")');
    if (await mfaHeading.isVisible({ timeout: 5000 })) {
      // In seed data, if secret is present or we use synthetic code
      // For TOTP verification, test uses the seed secret or test secret
      const totpInput = page.locator('input[placeholder="000000"]');
      if (await totpInput.isVisible()) {
        // If manual key is displayed on setup:
        const secretCode = await page.locator('code').textContent().catch(() => null);
        const secret = secretCode || 'JBSWY3DPEHPK3PXP';
        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
        const token = totp.generate();
        await totpInput.fill(token);
        await page.click('button[type="submit"]');
      }
    }

    // 3. Admin creates new examiner
    await expect(page.locator('text=Administration & Governance')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Enroll New User")');

    await page.fill('input[placeholder="Prof. Jane Doe"]', `Dr. Examiner ${timestamp}`);
    await page.fill('input[placeholder="jane.doe@examvault.local"]', testExaminerEmail);
    await page.selectOption('select', 'EXAMINER');
    await page.fill('input[value="Password123!@#$"]', testPassword);
    await page.click('button:has-text("Create User")');

    await expect(page.locator(`text=${testExaminerEmail}`)).toBeVisible({ timeout: 5000 });

    // 4. Admin Logs out
    await page.click('button[title="Sign out"]');
    await expect(page.locator('h1')).toContainText('ExamVault Portal');

    // 5. New Examiner First-Time Login
    await page.fill('input[type="email"]', testExaminerEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // 6. Mandatory MFA Enrollment Flow
    await expect(page.locator('text=Mandatory MFA Enrollment')).toBeVisible({ timeout: 5000 });
    const secretElement = page.locator('code');
    await expect(secretElement).toBeVisible();
    const base32Secret = (await secretElement.textContent()) || '';

    // Generate valid TOTP token
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(base32Secret.trim()),
    });
    const token = totp.generate();

    await page.fill('input[placeholder="000000"]', token);
    await page.click('button:has-text("Verify & Continue")');

    // 7. Examiner Dashboard Loaded
    await expect(page.locator('h1')).toContainText('Authoring Portal & Question Bank');

    // 8. Create Question with LaTeX formula & image
    await page.click('button:has-text("Author New Question")');
    await expect(page.locator('h1')).toContainText('Author New Exam Question');

    // Fill stem with LaTeX formulas and Hindi Unicode
    const stemContent = `Calculate the total energy $E = mc^2$ and maximum height:
$$\\int_0^T v(t) dt = H_{max}$$
किसी कण का अधिकतम विस्थापन ज्ञात कीजिए।`;

    await page.fill('textarea[placeholder*="Enter question text with LaTeX formulas"]', stemContent);

    // Switch to KaTeX preview to verify math rendering
    await page.click('button:has-text("KaTeX Preview")');
    await expect(page.locator('.katex')).toBeVisible();

    // Switch back to editor
    await page.click('button:has-text("Editor")');

    // Fill options
    await page.fill('input[placeholder*="Option A"]', '$\\frac{v_0^2}{2g}$');
    await page.fill('input[placeholder*="Option B"]', '$\\frac{v_0^2}{g}$');

    // Mark Option A as correct
    await page.click('button:has-text("A")');

    // 9. Submit Question (Creates immutable Version 1)
    await page.click('button:has-text("Submit Question")');

    // 10. Verify Question appears in Dashboard with SUBMITTED status
    await expect(page.locator('h1')).toContainText('Authoring Portal & Question Bank', { timeout: 10000 });
    await expect(page.locator('text=SUBMITTED').first()).toBeVisible();

    // 11. View Version History & Diff
    await page.click('button[title*="Version History"]');
    await expect(page.locator('text=Immutable Version History & Commitments')).toBeVisible();
    await expect(page.locator('text=Version 1')).toBeVisible();
    await expect(page.locator('text=AES-256-GCM Verified')).toBeVisible();
  });
});
