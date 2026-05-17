import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const sources = [
  {
    component: 'Scoring explicable',
    title: 'scoring explicable',
    path: 'tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.json',
  },
  {
    component: 'Profil apprenant',
    title: 'profil apprenant',
    path: 'tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.json',
  },
  {
    component: 'Strategie pedagogique',
    title: 'strategie pedagogique',
    path: 'tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.json',
  },
  {
    component: 'Feedback tutorat',
    title: 'feedback tutorat',
    path: 'tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.json',
  },
];

const outputJsonPath = path.join(__dirname, 'final-validation-report.json');
const outputMdPath = path.join(__dirname, 'final-validation-report.md');

const reports = sources.map((source) => loadReport(source));
const totalTests = sum(reports.map((item) => item.summary.total));
const totalPass = sum(reports.map((item) => item.summary.passed));
const totalFail = sum(reports.map((item) => item.summary.failed));
const totalDurationMs = sum(reports.map((item) => item.summary.durationMs).filter((value) => Number.isFinite(value)));

const finalReport = {
  metadata: {
    generatedAt: new Date().toISOString(),
    sourceReports: sources.map((source) => source.path),
    note: 'Rapport genere uniquement depuis les rapports runtime existants.',
  },
  totals: {
    totalTests,
    totalPass,
    totalFail,
    totalDurationMs,
  },
  components: reports.map((report) => ({
    component: report.component,
    scope: report.title,
    sourceReport: report.sourcePath,
    generatedAt: report.data.metadata?.generatedAt || null,
    total: report.summary.total,
    passed: report.summary.passed,
    failed: report.summary.failed,
    durationMs: report.summary.durationMs ?? null,
    cases: report.cases.map((test) => ({
      name: test.name,
      status: test.status,
      expected: test.expected || null,
      actual: compactActual(test.actual),
    })),
  })),
  importantExamples: {
    nextAction: extractNextActionExample(reports),
    learnerProfile: extractLearnerProfileExample(reports, 'Profil apprenant'),
    pedagogicalStrategy: extractPedagogicalStrategyExample(reports, 'Strategie pedagogique'),
    tutoringFeedback: extractTutoringFeedbackExample(reports),
  },
  limits: [
    'Les mecanismes valides sont rule-based.',
    'Aucun ML n est utilise.',
    'RabbitMQ reste complementaire au runtime HTTP teste.',
    'Le profil apprenant n est pas persiste comme objet dedie.',
    'Il n y a pas d orchestration automatique par evenements entre strategie et tutorat.',
  ],
  pfeInterpretation: {
    whatTestsDemonstrate: [
      'Les tests demontrent que les endpoints runtime exposent les champs attendus pour le scoring explicable, le profil apprenant, la strategie pedagogique et le feedback tutorat.',
      'Ils demontrent que les decisions, profils, strategies et feedbacks sont coherents avec les cas simules dans les rapports existants.',
      'Ils demontrent une non-regression observable sur les couches successives deja testees.',
    ],
    whatTestsDoNotDemonstrate: [
      'Ils ne demontrent pas une superiorite pedagogique statistique.',
      'Ils ne mesurent pas la performance utilisateur en conditions reelles.',
      'Ils ne prouvent pas une generalisation hors des datasets et scenarios runtime couverts.',
      'Ils ne valident pas une orchestration asynchrone RabbitMQ complete.',
    ],
    howToUseInResultsChapter: [
      'Presenter les totaux PASS/FAIL comme validation fonctionnelle runtime.',
      'Utiliser les exemples JSON pour illustrer les sorties reelles du systeme.',
      'Separer clairement la validation technique des conclusions pedagogiques.',
      'Relier chaque composant fonctionnel a son apport: scoring, profil, strategie, feedback.',
    ],
  },
  screenshotChecklist: [
    { item: 'dashboard apprenant', status: 'a capturer' },
    { item: 'adaptive path', status: 'a capturer' },
    { item: 'profil apprenant', status: 'a capturer' },
    { item: 'strategie pedagogique', status: 'a capturer' },
    { item: 'feedback tutoring', status: 'a capturer' },
    { item: 'dashboard enseignant', status: 'a capturer' },
    { item: 'dashboard admin', status: 'a capturer' },
    { item: 'RabbitMQ UI', status: 'a capturer' },
    { item: 'Consul UI', status: 'a capturer' },
  ],
};

fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(outputJsonPath, JSON.stringify(finalReport, null, 2), 'utf8');
fs.writeFileSync(outputMdPath, renderMarkdown(finalReport), 'utf8');

console.log(`Total tests: ${totalTests}`);
console.log(`Total PASS: ${totalPass}`);
console.log(`Total FAIL: ${totalFail}`);
console.log(`Duree totale: ${totalDurationMs} ms`);
console.log(`Rapport JSON: ${outputJsonPath}`);
console.log(`Rapport MD:   ${outputMdPath}`);

function loadReport(source) {
  const absolutePath = path.join(repoRoot, source.path);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing source report: ${source.path}`);
  }
  const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return {
    ...source,
    sourcePath: source.path,
    data,
    cases: Array.isArray(data.cases) ? data.cases : [],
    summary: {
      total: Number(data.summary?.total ?? 0),
      passed: Number(data.summary?.passed ?? 0),
      failed: Number(data.summary?.failed ?? 0),
      durationMs: Number(data.summary?.durationMs ?? 0),
    },
  };
}

function extractNextActionExample(loadedReports) {
  for (const report of loadedReports) {
    for (const test of report.cases) {
      const response = test.adaptivePathResponse;
      if (response?.nextAction) {
        return {
          sourceComponent: report.component,
          caseName: test.name,
          nextAction: response.nextAction,
          nextConcept: compactConcept(response.nextConcept),
          decisionExplanation: response.decisionExplanation,
        };
      }
      if (test.actual?.nextAction) {
        return {
          sourceComponent: report.component,
          caseName: test.name,
          nextAction: test.actual.nextAction,
          nextConcept: compactConcept(test.actual.nextConcept),
          decisionExplanation: test.actual.decisionExplanation,
        };
      }
    }
  }
  return null;
}

function extractLearnerProfileExample(loadedReports, preferredComponent) {
  return findFirstExample(preferComponent(loadedReports, preferredComponent), (test) =>
    test.actual?.learnerProfile || test.adaptivePathResponse?.learnerProfile
  );
}

function extractPedagogicalStrategyExample(loadedReports, preferredComponent) {
  return findFirstExample(preferComponent(loadedReports, preferredComponent), (test) =>
    test.actual?.pedagogicalStrategy || test.adaptivePathResponse?.pedagogicalStrategy
  );
}

function extractTutoringFeedbackExample(loadedReports) {
  return findFirstExample(loadedReports, (test) => {
    if (test.actual?.feedbackType || test.actual?.learningSequence) return test.actual;
    return null;
  });
}

function findFirstExample(loadedReports, selector) {
  for (const report of loadedReports) {
    for (const test of report.cases) {
      const value = selector(test);
      if (value) {
        return {
          sourceComponent: report.component,
          caseName: test.name,
          value,
        };
      }
    }
  }
  return null;
}

function preferComponent(loadedReports, component) {
  return [
    ...loadedReports.filter((report) => report.component === component),
    ...loadedReports.filter((report) => report.component !== component),
  ];
}

function compactActual(actual) {
  if (!actual || typeof actual !== 'object') return actual ?? null;
  return {
    nextAction: actual.nextAction,
    nextConcept: compactConcept(actual.nextConcept),
    learnerProfile: actual.learnerProfile,
    pedagogicalStrategy: actual.pedagogicalStrategy,
    feedbackType: actual.feedbackType,
    eventType: actual.eventType,
  };
}

function compactConcept(concept) {
  if (!concept) return null;
  return {
    conceptName: concept.conceptName,
    type: concept.type,
    status: concept.status,
    adaptiveScore: concept.adaptiveScore,
    scoreBreakdown: concept.scoreBreakdown,
    explanationReasons: concept.explanationReasons,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Rapport final de validation AdaptiveEngine');
  lines.push('');
  lines.push(`Genere le: ${report.metadata.generatedAt}`);
  lines.push('');
  lines.push('## Synthese globale');
  lines.push('');
  lines.push(`- Total tests: ${report.totals.totalTests}`);
  lines.push(`- Total PASS: ${report.totals.totalPass}`);
  lines.push(`- Total FAIL: ${report.totals.totalFail}`);
  lines.push(`- Duree totale disponible: ${report.totals.totalDurationMs} ms`);
  lines.push('');
  lines.push('## Resume par composant fonctionnel');
  lines.push('');
  lines.push('| Composant | Portee | Tests | PASS | FAIL | Duree | Rapport source |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const component of report.components) {
    lines.push(`| ${component.component} | ${component.scope} | ${component.total} | ${component.passed} | ${component.failed} | ${component.durationMs ?? ''} ms | ${component.sourceReport} |`);
  }
  lines.push('');
  lines.push('## Exemples de reponses importantes');
  lines.push('');
  appendJson(lines, 'nextAction', report.importantExamples.nextAction);
  appendJson(lines, 'learnerProfile', report.importantExamples.learnerProfile);
  appendJson(lines, 'pedagogicalStrategy', report.importantExamples.pedagogicalStrategy);
  appendJson(lines, 'tutoring feedback', report.importantExamples.tutoringFeedback);
  lines.push('## Limites');
  lines.push('');
  for (const limit of report.limits) lines.push(`- ${limit}`);
  lines.push('');
  lines.push('## Interpretation pour le rapport PFE');
  lines.push('');
  lines.push('### Ce que les tests demontrent');
  lines.push('');
  for (const item of report.pfeInterpretation.whatTestsDemonstrate) lines.push(`- ${item}`);
  lines.push('');
  lines.push('### Ce qu ils ne demontrent pas');
  lines.push('');
  for (const item of report.pfeInterpretation.whatTestsDoNotDemonstrate) lines.push(`- ${item}`);
  lines.push('');
  lines.push('### Comment les utiliser dans le chapitre resultats');
  lines.push('');
  for (const item of report.pfeInterpretation.howToUseInResultsChapter) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## Checklist screenshots');
  lines.push('');
  for (const entry of report.screenshotChecklist) {
    lines.push(`- [ ] ${entry.item} (${entry.status})`);
  }
  lines.push('');
  return lines.join('\n');
}

function appendJson(lines, title, value) {
  lines.push(`### ${title}`);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(value, null, 2));
  lines.push('```');
  lines.push('');
}

function sum(values) {
  return values.reduce((acc, value) => acc + Number(value || 0), 0);
}
