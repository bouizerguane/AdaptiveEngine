import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportJsonPath = path.join(__dirname, 'tutoring-v6-test-report.json');
const reportMdPath = path.join(__dirname, 'tutoring-v6-test-report.md');

loadDotEnv(path.join(repoRoot, '.env'));

const API_BASE_URL = process.env.ADAPTIVE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:8080/api';
const ADMIN_EMAIL = process.env.ADAPTIVE_ADMIN_EMAIL || 'admin@system.com';
const ADMIN_PASSWORD = process.env.ADAPTIVE_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    endpoint: 'POST /api/tutoring/feedback',
  },
  cases: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  },
};

const startedAt = performance.now();

main()
  .catch((error) => {
    report.summary.errors.push(serializeError(error));
    console.error(`FATAL: ${error.message}`);
  })
  .finally(() => {
    report.summary.total = report.cases.length;
    report.summary.passed = report.cases.filter((item) => item.status === 'PASS').length;
    report.summary.failed = report.cases.filter((item) => item.status === 'FAIL').length;
    report.summary.durationMs = Math.round(performance.now() - startedAt);
    writeReports();
    printSummary();
  });

async function main() {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  await runStrategyCase(admin.token, {
    name: 'Feedback tutorat - RECOVERY',
    strategyType: 'RECOVERY',
    expectedFeedbackType: 'REMEDIATION_FEEDBACK',
    nextAction: 'REMEDIATION',
    profileType: 'NEEDS_REMEDIATION',
    sequence: ['RESOURCE', 'REVIEW', 'LAB', 'FORMATIVE'],
    knowledgeGaps: ['Variables'],
    eventType: 'DIAGNOSTIC_FAILED',
  });
  await runStrategyCase(admin.token, {
    name: 'Feedback tutorat - SUPPORTIVE',
    strategyType: 'SUPPORTIVE',
    expectedFeedbackType: 'GUIDED_SUPPORT',
    nextAction: 'PASS_DIAGNOSTIC',
    profileType: 'DATA_INSUFFICIENT',
    sequence: ['RESOURCE', 'LAB', 'FORMATIVE'],
    eventType: 'GENERAL',
  });
  await runStrategyCase(admin.token, {
    name: 'Feedback tutorat - STANDARD',
    strategyType: 'STANDARD',
    expectedFeedbackType: 'STANDARD_GUIDANCE',
    nextAction: 'LEARN',
    profileType: 'PROGRESSING',
    sequence: ['RESOURCE', 'LAB', 'FORMATIVE'],
    eventType: 'GENERAL',
  });
  await runStrategyCase(admin.token, {
    name: 'Feedback tutorat - ADVANCED',
    strategyType: 'ADVANCED',
    expectedFeedbackType: 'ENRICHMENT_FEEDBACK',
    nextAction: 'COMPLETED',
    profileType: 'HIGH_PERFORMING',
    sequence: ['RESOURCE', 'CHALLENGE', 'FORMATIVE'],
    eventType: 'CONCEPT_MASTERED',
  });
  await runFallbackCase(admin.token);
}

async function runStrategyCase(token, config) {
  const test = createCase(config.name, {
    expected: { strategyType: config.strategyType, feedbackType: config.expectedFeedbackType },
  });

  try {
    const response = await postFeedback(token, {
      eventType: config.eventType,
      learnerEmail: 'student.tutoring.runtime@test.local',
      courseId: 'runtime-tutoring-course',
      courseTitle: 'Runtime tutoring course',
      conceptId: 'runtime-tutoring-concept',
      conceptName: 'Variables',
      score: config.strategyType === 'RECOVERY' ? 38 : 92,
      evaluationType: config.eventType === 'DIAGNOSTIC_FAILED' ? 'DIAGNOSTIC_ENTREE' : 'FORMATIVE',
      strategyType: config.strategyType,
      nextAction: config.nextAction,
      profileType: config.profileType,
      masteryScore: config.strategyType === 'SUPPORTIVE' ? null : 82,
      knowledgeGaps: config.knowledgeGaps || [],
      recommendedSequence: config.sequence,
      tutoringMessageHint: 'Runtime tutoring hint',
    });

    assertEquals(test, 'feedbackType', config.expectedFeedbackType, response.feedbackType);
    assertEquals(test, 'eventType', normalizeEvent(config.eventType), response.eventType);
    assertNonEmpty(test, 'message', response.message);
    assertNonEmpty(test, 'recommendedActions', response.recommendedActions);
    assertSequence(test, 'learningSequence', config.sequence, response.learningSequence);
    assertNonEmpty(test, 'motivationalMessage', response.motivationalMessage);
    assertNonEmpty(test, 'explanation', response.explanation);
    test.actual = compactFeedback(response);
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runFallbackCase(token) {
  const test = createCase('Feedback tutorat - Fallback sans strategyType', {
    expected: { eventType: 'DIAGNOSTIC_FAILED', message: 'eventType historique' },
  });

  try {
    const response = await postFeedback(token, {
      eventType: 'DIAGNOSTIC_FAILED',
      learnerEmail: 'student.tutoring.runtime@test.local',
      courseId: 'runtime-tutoring-course',
      courseTitle: 'Runtime tutoring course',
      conceptId: 'runtime-tutoring-concept',
      conceptName: 'Variables',
      score: 35,
      evaluationType: 'DIAGNOSTIC_ENTREE',
    });

    assertEquals(test, 'eventType', 'DIAGNOSTIC_FAILED', response.eventType);
    assertTrue(test, 'fallback feedbackType absent', !response.feedbackType);
    assertNonEmpty(test, 'message', response.message);
    assertNonEmpty(test, 'actions', response.actions);
    test.actual = compactFeedback(response);
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function login(email, password) {
  const response = await apiRequest('POST', '/auth/login', { email, password }, null);
  return { email, token: response.token, role: response.role };
}

async function postFeedback(token, body) {
  return apiRequest('POST', '/tutoring/feedback', body, token);
}

async function apiRequest(method, endpoint, body, token) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: HTTP ${response.status} ${text}`);
  }
  return data;
}

function createCase(name, extra = {}) {
  return { name, status: 'PASS', assertions: [], errors: [], ...extra };
}

function assertEquals(test, label, expected, actual) {
  const pass = expected === actual;
  addAssertion(test, label, expected, actual, pass);
}

function assertTrue(test, label, actual) {
  addAssertion(test, label, true, Boolean(actual), Boolean(actual));
}

function assertNonEmpty(test, label, actual) {
  const pass = Array.isArray(actual) ? actual.length > 0 : typeof actual === 'string' ? actual.trim().length > 0 : Boolean(actual);
  addAssertion(test, label, 'non-empty', actual ?? null, pass);
}

function assertSequence(test, label, expected, actual) {
  const normalizedActual = Array.isArray(actual) ? actual : [];
  const pass = expected.join('|') === normalizedActual.join('|');
  addAssertion(test, label, expected, normalizedActual, pass);
}

function addAssertion(test, label, expected, actual, pass) {
  test.assertions.push({ label, expected, actual, status: pass ? 'PASS' : 'FAIL' });
  if (!pass) test.status = 'FAIL';
}

function failCase(test, error) {
  test.status = 'FAIL';
  test.errors.push(serializeError(error));
}

function finishCase(test) {
  report.cases.push(test);
  console.log(`${test.status} ${test.name}`);
}

function compactFeedback(response) {
  if (!response) return null;
  return {
    eventType: response.eventType,
    feedbackType: response.feedbackType,
    message: response.message,
    actions: response.actions,
    recommendedActions: response.recommendedActions,
    learningSequence: response.learningSequence,
    motivationalMessage: response.motivationalMessage,
    explanation: response.explanation,
  };
}

function writeReports() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(reportMdPath, renderMarkdownReport(report), 'utf8');
}

function renderMarkdownReport(data) {
  const lines = [];
  lines.push('# Feedback tutorat - Runtime Test Report');
  lines.push('');
  lines.push(`Generated at: ${data.metadata.generatedAt}`);
  lines.push(`API: ${data.metadata.apiBaseUrl}`);
  lines.push(`Endpoint: ${data.metadata.endpoint}`);
  lines.push(`Duration: ${data.summary.durationMs} ms`);
  lines.push('');
  lines.push('| Case | Status | Expected | Actual |');
  lines.push('| --- | --- | --- | --- |');
  for (const test of data.cases) {
    lines.push(`| ${escapeMd(test.name)} | ${test.status} | ${escapeMd(JSON.stringify(test.expected || {}))} | ${escapeMd(JSON.stringify(test.actual || test.errors || {}))} |`);
  }
  lines.push('');
  for (const test of data.cases) {
    lines.push(`## ${test.name} - ${test.status}`);
    lines.push('');
    if (test.errors?.length) {
      lines.push('Errors:');
      for (const error of test.errors) lines.push(`- ${escapeMd(error.message)}`);
      lines.push('');
    }
    lines.push('Assertions:');
    for (const assertion of test.assertions || []) {
      lines.push(`- ${assertion.status} ${assertion.label}: expected \`${escapeMd(JSON.stringify(assertion.expected))}\`, actual \`${escapeMd(JSON.stringify(assertion.actual))}\``);
    }
    lines.push('');
    lines.push('Feedback response:');
    lines.push('```json');
    lines.push(JSON.stringify(test.actual || null, null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function printSummary() {
  console.log('');
  for (const test of report.cases) console.log(`${test.name}: ${test.status}`);
  console.log(`Temps total: ${report.summary.durationMs} ms`);
  if (report.summary.errors.length > 0) {
    console.log('Erreurs globales:');
    for (const error of report.summary.errors) console.log(`- ${error.message}`);
  }
  console.log(`Rapport JSON: ${reportJsonPath}`);
  console.log(`Rapport MD:   ${reportMdPath}`);
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = parts.join('=');
  }
}

function normalizeEvent(value) {
  return String(value || 'GENERAL').trim().toUpperCase();
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function serializeError(error) {
  return { message: error?.message || String(error), stack: error?.stack };
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
