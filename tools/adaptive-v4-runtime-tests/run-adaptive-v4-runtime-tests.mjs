import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportJsonPath = path.join(__dirname, 'adaptive-v4-test-report.json');
const reportMdPath = path.join(__dirname, 'adaptive-v4-test-report.md');

loadDotEnv(path.join(repoRoot, '.env'));

const API_BASE_URL = process.env.ADAPTIVE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:8080/api';
const ADMIN_EMAIL = process.env.ADAPTIVE_ADMIN_EMAIL || 'admin@system.com';
const ADMIN_PASSWORD = process.env.ADAPTIVE_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const TEST_PASSWORD = 'moh123';

const learners = {
  noData: 'student.profile.nodata@test.local',
  gaps: 'student.profile.gaps@test.local',
  progressing: 'student.profile.progressing@test.local',
  high: 'student.profile.high@test.local',
};

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    kmsFormula: 'KMS_u = sum(W_i * S_u,i) / sum(W_i), W_i = poidsCognitif if available else 1',
  },
  learners,
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
  await ensureLearners(admin.token);

  const sessions = {};
  for (const [key, email] of Object.entries(learners)) {
    sessions[key] = await login(email, TEST_PASSWORD);
  }

  const algorithmique = await findCourse(admin.token, 'Introduction a l Algorithmique', [
    'Introduction à l’Algorithmique',
    'Introduction à l Algorithmique',
    'Algorithmique',
  ]);
  const courseTree = await apiGet(`/graph/courses/${encodeURIComponent(algorithmique.id)}/tree`, sessions.noData.token);
  const concepts = flattenConcepts(courseTree);

  await runNoDataCase(sessions.noData, algorithmique);
  await runNeedsRemediationCase(sessions.gaps, algorithmique, concepts);
  await runProgressingCase(sessions.progressing, algorithmique, concepts);
  await runHighPerformingCase(sessions.high, algorithmique, concepts);
}

async function runNoDataCase(session, course) {
  const test = createCase('Profil apprenant - Apprenant sans donnees', {
    expected: { profileType: 'DATA_INSUFFICIENT', profileExplanation: 'present' },
  });

  try {
    await enroll(session, course);
    const adaptivePath = await getAdaptivePath(session, course);
    const profile = adaptivePath.learnerProfile;
    assertEquals(test, 'profileType', 'DATA_INSUFFICIENT', profile?.profileType);
    assertEquals(test, 'tracesCount', 0, profile?.tracesCount);
    assertEquals(test, 'completedLabsCount', 0, profile?.completedLabsCount);
    assertNonEmpty(test, 'profileExplanation', profile?.profileExplanation);
    test.actual = compactProfile(profile);
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runNeedsRemediationCase(session, course, concepts) {
  const test = createCase('Profil apprenant - Apprenant avec lacunes', {
    expected: { profileType: 'NEEDS_REMEDIATION', knowledgeGaps: 'non-empty' },
  });

  try {
    await enroll(session, course);
    const variables = findConcept(concepts, 'Variables');
    const conditions = findConcept(concepts, 'Conditions');
    await simulateDiagnostic(session, course, [
      diagnosticResult(variables, false, 35),
      diagnosticResult(conditions, false, 42),
    ]);
    const adaptivePath = await getAdaptivePath(session, course);
    const profile = adaptivePath.learnerProfile;
    assertEquals(test, 'profileType', 'NEEDS_REMEDIATION', profile?.profileType);
    assertNonEmpty(test, 'knowledgeGaps', profile?.knowledgeGaps);
    assertTrue(test, 'weakConceptsCount > 0', Number(profile?.weakConceptsCount || 0) > 0);
    assertNonEmpty(test, 'profileExplanation', profile?.profileExplanation);
    test.actual = compactProfile(profile);
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runProgressingCase(session, course, concepts) {
  const test = createCase('Profil apprenant - Apprenant actif sans lacunes', {
    expected: { profileType: 'PROGRESSING', knowledgeGaps: 'empty', masteryScore: 'calculable' },
  });

  try {
    await enroll(session, course);
    const mastered = ['Variables', 'Types de données'].map((name) => findConcept(concepts, name));
    await simulateDiagnostic(session, course, mastered.map((concept) => diagnosticResult(concept, true, 82)));
    await simulateConceptTrace(session, course, mastered[0], 78);
    const adaptivePath = await getAdaptivePath(session, course);
    const profile = adaptivePath.learnerProfile;
    assertEquals(test, 'profileType', 'PROGRESSING', profile?.profileType);
    assertEquals(test, 'weakConceptsCount', 0, profile?.weakConceptsCount);
    assertTrue(test, 'masteryScore calculable', Number.isFinite(Number(profile?.masteryScore)));
    assertTrue(test, 'tracesCount > 0', Number(profile?.tracesCount || 0) > 0);
    test.actual = compactProfile(profile);
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runHighPerformingCase(session, course, concepts) {
  const test = createCase('Profil apprenant - Apprenant avec tres bonnes performances', {
    expected: { profileType: 'HIGH_PERFORMING', nextAction: 'COMPLETED', masteryScore: 'calculable' },
  });

  try {
    await enroll(session, course);
    await simulateDiagnostic(session, course, concepts.map((concept) => diagnosticResult(concept, true, 95)));
    for (const concept of concepts.slice(0, 3)) {
      await simulateConceptTrace(session, course, concept, 96);
    }
    const adaptivePath = await getAdaptivePath(session, course);
    const profile = adaptivePath.learnerProfile;
    assertEquals(test, 'nextAction', 'COMPLETED', adaptivePath.nextAction);
    assertEquals(test, 'profileType', 'HIGH_PERFORMING', profile?.profileType);
    assertTrue(test, 'masteryScore calculable', Number.isFinite(Number(profile?.masteryScore)));
    assertNonEmpty(test, 'profileExplanation', profile?.profileExplanation);
    test.actual = { nextAction: adaptivePath.nextAction, learnerProfile: compactProfile(profile) };
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function ensureLearners(adminToken) {
  for (const email of Object.values(learners)) {
    await signupIfNeeded(email);
  }

  const users = await apiGet('/admin/users', adminToken);
  for (const email of Object.values(learners)) {
    const user = users.find((item) => normalize(item.email) === normalize(email));
    if (!user) throw new Error(`User not found after signup: ${email}`);
    if (!user.estApprouve) {
      await apiPut(`/admin/users/${encodeURIComponent(user.id)}/approve`, undefined, adminToken);
    }
  }
}

async function signupIfNeeded(email) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'Profil',
      prenom: email.split('@')[0].replace('student.profile.', ''),
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

async function simulateDiagnostic(session, course, conceptResults) {
  await apiPost('/traces', {
    courseId: course.id,
    targetId: course.id,
    targetType: 'COURSE',
    userId: session.email,
    learnerEmail: session.email,
    studentEmail: session.email,
    evaluationId: `runtime-profile-diagnostic-${course.id}-${Date.now()}`,
    typeEvaluation: 'DIAGNOSTIC_ENTREE',
    scoreObtenu: average(conceptResults.map((item) => item.score)),
    tempsConsultation: 300,
    horodatage: new Date().toISOString().slice(0, 19),
    feedbackGenere: 'Runtime adaptive diagnostic simulation',
    masterySource: 'DIAGNOSTIC_ENTREE',
    conceptResults: JSON.stringify(conceptResults),
  }, session.token);

  await apiPost('/graph/adaptive/diagnostic', {
    learnerEmail: session.email,
    courseId: course.id,
    typeEvaluation: 'DIAGNOSTIC_ENTREE',
    conceptResults: conceptResults.map((item) => ({
      conceptId: item.conceptId,
      conceptName: item.conceptName,
      mastered: item.mastered,
      score: item.score,
    })),
  }, session.token);
}

async function simulateConceptTrace(session, course, concept, score) {
  await apiPost('/traces', {
    courseId: course.id,
    targetId: concept.id,
    targetType: 'CONCEPT',
    userId: session.email,
    learnerEmail: session.email,
    studentEmail: session.email,
    evaluationId: `runtime-profile-formative-${course.id}-${concept.id}-${Date.now()}`,
    typeEvaluation: 'FORMATIVE',
    scoreObtenu: score,
    tempsConsultation: 240,
    horodatage: new Date().toISOString().slice(0, 19),
    feedbackGenere: 'Runtime adaptive formative simulation',
    masterySource: 'QUIZ_DIRECT',
  }, session.token);
}

async function enroll(session, course) {
  await apiPost(`/graph/courses/${encodeURIComponent(course.id)}/enroll`, {
    learnerEmail: session.email,
    nom: 'Profil',
    prenom: session.email.split('@')[0],
  }, session.token);
}

async function getAdaptivePath(session, course) {
  return apiGet(`/adaptive/path?courseId=${encodeURIComponent(course.id)}`, session.token);
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
          poidsCognitif: concept.poidsCognitif,
        });
      }
    }
  }
  return result;
}

function findConcept(concepts, label) {
  const concept = concepts.find((item) => normalize(item.label).includes(normalize(label)));
  if (!concept) {
    throw new Error(`Concept not found: ${label}. Available: ${concepts.map((item) => item.label).join(', ')}`);
  }
  return concept;
}

function diagnosticResult(concept, mastered, score) {
  return {
    conceptId: concept.id,
    conceptName: concept.label,
    name: concept.label,
    mastered,
    score,
  };
}

async function login(email, password) {
  const response = await apiPost('/auth/login', { email, password }, null);
  return { email, token: response.token, role: response.role };
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

function compactProfile(profile) {
  if (!profile) return null;
  return {
    learnerEmail: profile.learnerEmail,
    masteryScore: profile.masteryScore,
    knowledgeGaps: profile.knowledgeGaps,
    masteredConceptsCount: profile.masteredConceptsCount,
    weakConceptsCount: profile.weakConceptsCount,
    tracesCount: profile.tracesCount,
    completedLabsCount: profile.completedLabsCount,
    averageAssessmentScore: profile.averageAssessmentScore,
    totalLearningTime: profile.totalLearningTime,
    profileType: profile.profileType,
    profileExplanation: profile.profileExplanation,
  };
}

function writeReports() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(reportMdPath, renderMarkdownReport(report), 'utf8');
}

function renderMarkdownReport(data) {
  const lines = [];
  lines.push('# Profil apprenant - Runtime Test Report');
  lines.push('');
  lines.push(`Generated at: ${data.metadata.generatedAt}`);
  lines.push(`API: ${data.metadata.apiBaseUrl}`);
  lines.push(`KMS: ${data.metadata.kmsFormula}`);
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
    lines.push('Learner profile:');
    lines.push('```json');
    lines.push(JSON.stringify(compactProfile(test.adaptivePathResponse?.learnerProfile), null, 2));
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

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function average(values) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function serializeError(error) {
  return { message: error?.message || String(error), stack: error?.stack };
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
