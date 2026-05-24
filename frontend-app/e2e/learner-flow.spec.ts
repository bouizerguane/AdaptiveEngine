import { expect, test } from '@playwright/test';

const learnerEmail = process.env.E2E_LEARNER_EMAIL || 'student.profile.high@test.local';
const learnerPassword = process.env.E2E_LEARNER_PASSWORD || 'moh123';

test('learner consulte sa recommandation et son parcours adaptatif', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type="text"]').fill(learnerEmail);
  await page.locator('input[type="password"]').fill(learnerPassword);
  await page.getByRole('button', { name: 'Se Connecter' }).click();

  await expect(page).toHaveURL(/\/learner\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard apprenant' })).toBeVisible();
  await expect(page.getByText('Recommandation Adaptive Engine')).toBeVisible();

  await page.getByRole('link', { name: 'Ouvrir le cours' }).first().click();

  await expect(page).toHaveURL(/\/learner\/courses\/[^/?]+/);
  await expect(page.getByRole('button', { name: 'Parcours adaptatif' })).toBeVisible();

  await page.getByRole('button', { name: 'Parcours adaptatif' }).click();
  await expect(page.getByText(/Prochaine/)).toBeVisible();
  await expect(page.getByText(/Parcours personnalis/)).toBeVisible();

  await page.getByRole('button', { name: /Rem.diation/ }).click();
  await expect(
    page.getByText(/Aucune rem/)
      .or(page.getByText(/Concepts a reviser/))
      .or(page.getByText(/Rem.diation recommand/))
  ).toBeVisible();
});
