import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const reportJsonPath = path.join(__dirname, 'event-driven-refresh-test-report.json');
const reportMdPath = path.join(__dirname, 'event-driven-refresh-test-report.md');

loadDotEnv(path.join(repoRoot, '.env'));

const API_BASE_URL = process.env.ADAPTIVE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:8080/api';
const ADMIN_EMAIL = process.env.ADAPTIVE_ADMIN_EMAIL || 'admin@system.com';
const ADMIN_PASSWORD = process.env.ADAPTIVE_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const TEST_PASSWORD = 'moh123';
const LEARNER_EMAIL = 'student.refresh.runtime@test.local';

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    learnerEmail: LEARNER_EMAIL,
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
  await ensureLearner(admin.token);
  const learner = await login(LEARNER_EMAIL, TEST_PASSWORD);
  const course = await findCourse(admin.token, 'Introduction a l Algorithmique', [
    'Introduction a l Algorithmique',
    'Introduction a l Algorithmique',
    'Algorithmique',
  ]);
  await enroll(learner, course);
  const courseTree = await apiGet(`/graph/courses/${encodeURIComponent(course.id)}/tree`, learner.token);
  const concepts = flattenConcepts(courseTree);
  const firstConcept = concepts[0] || { id: course.id, label: 'Concept runtime' };

  await runQuizRefreshCase(learner, course, firstConcept, admin.token);
  await runLabRefreshCase(learner, course, firstConcept, admin.token);
}

async function runQuizRefreshCase(session, course, concept, adminToken) {
  const test = createCase('Rafraichissement apres quiz', {
    expected: {
      refreshedAfterEvent: true,
      refreshReason: 'QUIZ_COMPLETED',
      consumedOnSecondRead: true,
      trackingPendingAfterConsume: false,
    },
  });

  try {
    const initialPath = await getAdaptivePath(session, course);
    await apiPost('/traces', {
      courseId: course.id,
      targetId: concept.id,
      targetType: 'CONCEPT',
      userId: session.email,
      learnerEmail: session.email,
      studentEmail: session.email,
      evaluationId: `runtime-refresh-quiz-${Date.now()}`,
      typeEvaluation: 'FORMATIVE',
      scoreObtenu: 84,
      tempsConsultation: 180,
      horodatage: new Date().toISOString().slice(0, 19),
      feedbackGenere: 'Runtime event refresh quiz trace',
      masterySource: 'QUIZ_DIRECT',
    }, session.token);

    const refreshedPath = await waitForFreshness(session, course, 'QUIZ_COMPLETED');
    const secondPath = await getAdaptivePath(session, course);
    const pendingAfterConsume = await getPersistentPending(adminToken, session.email, course.id);

    assertEquals(test, 'refreshReason', 'QUIZ_COMPLETED', refreshedPath.pathFreshness?.refreshReason);
    assertEquals(test, 'lastEventType', 'quiz.completed', refreshedPath.pathFreshness?.lastEventType);
    assertEquals(test, 'refreshedAfterEvent', true, refreshedPath.pathFreshness?.refreshedAfterEvent);
    assertEquals(test, 'second call consumed refresh', false, Boolean(secondPath.pathFreshness?.refreshedAfterEvent));
    assertEquals(test, 'tracking pending after consume', false, Boolean(pendingAfterConsume?.pending));
    test.actual = {
      before: compactFreshness(initialPath.pathFreshness),
      afterEvent: compactFreshness(refreshedPath.pathFreshness),
      secondRead: compactFreshness(secondPath.pathFreshness),
      trackingPendingAfterConsume: pendingAfterConsume,
    };
    test.adaptivePathResponse = refreshedPath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runLabRefreshCase(session, course, concept, adminToken) {
  const test = createCase('Rafraichissement apres TP', {
    expected: {
      refreshedAfterEvent: true,
      refreshReason: 'LAB_SUBMITTED',
    },
  });

  try {
    await apiPost('/labs/submit', {
      userId: session.email,
      learnerEmail: session.email,
      studentEmail: session.email,
      courseId: course.id,
      conceptId: concept.id,
      targetId: concept.id,
      labId: `runtime-refresh-lab-${Date.now()}`,
      status: 'COMPLETED',
      githubRepoUrl: 'https://github.com/runtime/adaptive-refresh-test',
    }, session.token);

    const refreshedPath = await waitForFreshness(session, course, 'LAB_SUBMITTED');
    const pendingAfterConsume = await getPersistentPending(adminToken, session.email, course.id);

    assertEquals(test, 'refreshReason', 'LAB_SUBMITTED', refreshedPath.pathFreshness?.refreshReason);
    assertEquals(test, 'lastEventType', 'lab.submitted', refreshedPath.pathFreshness?.lastEventType);
    assertEquals(test, 'refreshedAfterEvent', true, refreshedPath.pathFreshness?.refreshedAfterEvent);
    test.actual = {
      afterEvent: compactFreshness(refreshedPath.pathFreshness),
      trackingPendingAfterConsume: pendingAfterConsume,
    };
    test.adaptivePathResponse = refreshedPath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function waitForFreshness(session, course, expectedReason) {
  const timeoutAt = Date.now() + 8000;
  let lastPath = null;
  while (Date.now() < timeoutAt) {
    await sleep(700);
    lastPath = await getAdaptivePath(session, course);
    if (lastPath.pathFreshness?.refreshedAfterEvent
        && (!expectedReason || lastPath.pathFreshness.refreshReason === expectedReason)) {
      return lastPath;
    }
  }
  throw new Error(`Refresh not observed for ${expectedReason}. Last freshness=${JSON.stringify(compactFreshness(lastPath?.pathFreshness))}`);
}

async function ensureLearner(adminToken) {
  await signupIfNeeded(LEARNER_EMAIL);
  const users = await apiGet('/admin/users', adminToken);
  const user = users.find((item) => normalize(item.email) === normalize(LEARNER_EMAIL));
  if (!user) throw new Error(`User not found after signup: ${LEARNER_EMAIL}`);
  if (!user.estApprouve) {
    await apiPut(`/admin/users/${encodeURIComponent(user.id)}/approve`, undefined, adminToken);
  }
}

async function signupIfNeeded(email) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'Refresh',
      prenom: 'Runtime',
      email,
      password: TEST_PASSWORD,
      role: 'STUDENT',
    }),
  });

  if (response.ok) return;
  const text = await response.text();
  if (response.status === 400 && normalize(text).includes('email')) return;
  throw new Error(`Signup failed for ${email}: HTTP ${response.status} ${text}`);
}

async function enroll(session, course) {
  await apiPost(`/graph/courses/${encodeURIComponent(course.id)}/enroll`, {
    learnerEmail: session.email,
    nom: 'Refresh',
    prenom: 'Runtime',
  }, session.token).catch((error) => {
    if (!String(error.message).includes('404')) return;
    throw error;
  });
}

async function getAdaptivePath(session, course) {
  return apiGet(`/adaptive/path?courseId=${encodeURIComponent(course.id)}`, session.token);
}

async function getPersistentPending(token, learnerEmail, courseId) {
  return apiGet(`/tracking/adaptive-refresh/pending?learnerEmail=${encodeURIComponent(learnerEmail)}&courseId=${encodeURIComponent(courseId)}`, token);
}

async function findCourse(token, label, candidates) {
  const allCourses = await apiGet('/graph/courses', token);
  const course = allCourses.find((item) => candidates.some((candidate) => normalize(item.title).includes(normalize(candidate))));
  if (!course) {
    throw new Error(`Course not found for ${label}. Available: ${allCourses.map((item) => item.title).join(', ')}`);
  }
  return course;
}

function flattenConcepts(courseTree) {
  const result = [];
  for (const module of courseTree.modules || []) {
    for (const chapitre of module.chapitres || []) {
      for (const concept of chapitre.concepts || []) {
        result.push({
          id: concept.id,
          label: concept.labelPedagogique || concept.title || concept.name || 'Concept inconnu',
        });
      }
    }
  }
  return result;
}

async function login(email, password) {
  const response = await apiPost('/auth/login', { email, password }, null);
  return {
    email,
    token: response.token,
    role: response.role,
  };
}

async function apiGet(endpoint, token) {
  return apiRequest('GET', endpoint, undefined, token);
}

async function apiPost(endpoint, body, token) {
  return apiRequest('POST', endpoint, body, token);
}

async function apiPut(endpoint, body, token) {
  return apiRequest('PUT', endpoint, body, token);
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
  return {
    name,
    status: 'PASS',
    assertions: [],
    errors: [],
    ...extra,
  };
}

function assertEquals(test, label, expected, actual) {
  const pass = expected === actual;
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

function compactFreshness(pathFreshness) {
  if (!pathFreshness) return null;
  return {
    refreshedAfterEvent: Boolean(pathFreshness.refreshedAfterEvent),
    lastEventType: pathFreshness.lastEventType || null,
    lastEventAt: pathFreshness.lastEventAt || null,
    refreshReason: pathFreshness.refreshReason || null,
    message: pathFreshness.message || null,
  };
}

function writeReports() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(reportMdPath, renderMarkdownReport(report), 'utf8');
}

function renderMarkdownReport(data) {
  const lines = [];
  lines.push('# Rafraichissement evenementiel persistant - Runtime Test Report');
  lines.push('');
  lines.push(`Generated at: ${data.metadata.generatedAt}`);
  lines.push(`API: ${data.metadata.apiBaseUrl}`);
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
      lines.push(`- ${assertion.status} ${assertion.label}: expected \`${escapeMd(String(assertion.expected))}\`, actual \`${escapeMd(String(assertion.actual))}\``);
    }
    lines.push('');
    lines.push('Path freshness:');
    lines.push('```json');
    lines.push(JSON.stringify(compactFreshness(test.adaptivePathResponse?.pathFreshness), null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function printSummary() {
  console.log('');
  for (const test of report.cases) {
    console.log(`${test.name}: ${test.status}`);
  }
  console.log(`Temps total: ${report.summary.durationMs} ms`);
  if (report.summary.errors.length > 0) {
    console.log('Erreurs globales:');
    for (const error of report.summary.errors) console.log(`- ${error.message}`);
  }
  console.log(`Rapport JSON: ${reportJsonPath}`);
  console.log(`Rapport MD:   ${reportMdPath}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function serializeError(error) {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
  };
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
