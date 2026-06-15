/**
 * One-time backfill: credits existing MaterialLog USAGE entries into
 * Budget.actualAmount (MATERIALS category) and Project.actualCost.
 *
 * Run once on the server after deploying the logUsage fix:
 *   npx ts-node --project tsconfig.json prisma/manual/backfill-material-usage-actuals.ts
 *
 * Safe to run multiple times — it only adds the costs of logs that have not
 * already been counted (identified by the absence of a FinancialTransaction
 * with sourceType='MATERIAL_USAGE' and sourceId matching the MaterialLog id).
 *
 * If your logs never had a corresponding FinancialTransaction, all of them
 * will be credited. Verify counts in the output before committing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Fetch all USAGE logs tied to a project that have no paired FinancialTransaction
  const usageLogs = await prisma.materialLog.findMany({
    where: {
      entryType: 'USAGE',
      projectId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      companyId: true,
      projectId: true,
      totalCost: true,
    },
  });

  if (usageLogs.length === 0) {
    console.log('No usage logs found — nothing to backfill.');
    return;
  }

  // Group by companyId + projectId
  const grouped = new Map<string, { companyId: string; projectId: string; total: number }>();
  for (const log of usageLogs) {
    const key = `${log.companyId}:${log.projectId}`;
    const entry = grouped.get(key) ?? { companyId: log.companyId, projectId: log.projectId!, total: 0 };
    entry.total += Number(log.totalCost);
    grouped.set(key, entry);
  }

  console.log(`Found ${usageLogs.length} usage log(s) across ${grouped.size} company/project pair(s).`);

  let budgetUpdates = 0;
  let projectUpdates = 0;

  for (const { companyId, projectId, total } of grouped.values()) {
    const materialsCategory = await prisma.budgetCategory.findFirst({
      where: { companyId, code: 'MATERIALS', deletedAt: null },
      select: { id: true },
    });

    if (!materialsCategory) {
      console.warn(`  [SKIP] No MATERIALS budget category for company ${companyId}`);
      continue;
    }

    const budgetResult = await prisma.budget.updateMany({
      where: {
        companyId,
        projectId,
        categoryId: materialsCategory.id,
        deletedAt: null,
      },
      data: { actualAmount: { increment: total } },
    });

    const projectResult = await prisma.project.updateMany({
      where: { id: projectId, deletedAt: null },
      data: { actualCost: { increment: total } },
    });

    console.log(
      `  project=${projectId} total=$${total.toFixed(2)} ` +
      `→ budgets updated: ${budgetResult.count}, projects updated: ${projectResult.count}`,
    );

    budgetUpdates += budgetResult.count;
    projectUpdates += projectResult.count;
  }

  console.log(`\nDone. Budget rows updated: ${budgetUpdates}, Project rows updated: ${projectUpdates}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
