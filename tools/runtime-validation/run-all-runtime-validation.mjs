import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const steps = [
  {
    label: 'Scoring explicable',
    script: 'tools/adaptive-v3-runtime-tests/run-adaptive-v3-runtime-tests.mjs',
  },
  {
    label: 'Profil apprenant',
    script: 'tools/adaptive-v4-runtime-tests/run-adaptive-v4-runtime-tests.mjs',
  },
  {
    label: 'Strategie pedagogique',
    script: 'tools/adaptive-v5-runtime-tests/run-adaptive-v5-runtime-tests.mjs',
  },
  {
    label: 'Feedback tutorat',
    script: 'tools/tutoring-v6-runtime-tests/run-tutoring-v6-runtime-tests.mjs',
  },
  {
    label: 'Validation fonctionnelle finale',
    script: 'tools/final-validation-report/run-final-validation.mjs',
  },
];

const startedAt = Date.now();

for (const step of steps) {
  console.log(`\n=== ${step.label} ===`);
  const result = spawnSync('node', [step.script], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`\nValidation echouee: ${step.label}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nToutes les validations runtime sont terminees en ${Date.now() - startedAt} ms.`);
