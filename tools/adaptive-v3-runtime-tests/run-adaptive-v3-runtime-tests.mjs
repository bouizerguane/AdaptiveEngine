import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportJsonPath = path.join(__dirname, 'adaptive-v3-test-report.json');
const reportMdPath = path.join(__dirname, 'adaptive-v3-test-report.md');

loadDotEnv(path.join(repoRoot, '.env'));

const API_BASE_URL = process.env.ADAPTIVE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:8080/api';
const ADMIN_EMAIL = process.env.ADAPTIVE_ADMIN_EMAIL || 'admin@system.com';
const ADMIN_PASSWORD = process.env.ADAPTIVE_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const TEST_PASSWORD = 'moh123';

const learners = {
  strong: 'student.scoring.strong@test.local',
  strongNoGap: 'student.scoring.strong.nogap@test.local',
  weak: 'student.scoring.weak@test.local',
  external: 'student.scoring.external@test.local',
  engagement: 'student.scoring.engagement@test.local',
};

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    scoringVersionExpected: 'RULE_BASED_EXPLAINABLE',
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
  const structures = await findCourse(admin.token, 'Structures de donnees', [
    'Structures de données',
    'Structures de donnees',
  ]);

  const algorithmiqueTree = await apiGet(`/graph/courses/${encodeURIComponent(algorithmique.id)}/tree`, sessions.strong.token);
  const structuresTree = await apiGet(`/graph/courses/${encodeURIComponent(structures.id)}/tree`, sessions.external.token);
  const algoConcepts = flattenConcepts(algorithmiqueTree);
  const structuresConcepts = flattenConcepts(structuresTree);

  await runCaseA1(sessions.strong, algorithmique, algoConcepts);
  await runCaseA2(sessions.strongNoGap, algorithmique, algoConcepts);
  await runCaseB(sessions.weak, algorithmique, algoConcepts);
  await runCaseC(sessions.external, structures, structuresConcepts);
  await runCaseD(sessions.engagement, sessions.external, algorithmique, algoConcepts);
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
  const body = {
    nom: 'Runtime',
    prenom: email.split('@')[0].replace('student.scoring.', ''),
    email,
    password: TEST_PASSWORD,
    role: 'STUDENT',
  };

  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.ok) return;
  const text = await response.text();
  if (response.status === 400 && normalize(text).includes('email')) return;
  throw new Error(`Signup failed for ${email}: HTTP ${response.status} ${text}`);
}

async function runCaseA1(session, course, concepts) {
  const test = createCase('Case A1 - Apprenant fort avec lacune', {
    expected: {
      nextAction: 'REMEDIATION',
      nextConceptContains: 'Fonctions',
      explanationReasons: 'non-empty',
      decisionExplanation: 'non-empty',
    },
  });

  try {
    await enroll(session, course);
    const mastered = ['Variables', 'Types de données', 'Conditions', 'Boucles'].map((name) => findConcept(concepts, name));
    const weak = findConcept(concepts, 'Fonctions');

    await simulateDiagnostic(session, course, [
      ...mastered.map((concept) => diagnosticResult(concept, true, 92)),
      diagnosticResult(weak, false, 45),
    ]);

    const adaptivePath = await getAdaptivePath(session, course);
    assertEquals(test, 'nextAction', 'REMEDIATION', adaptivePath.nextAction);
    assertIncludes(test, 'nextConcept contains Fonctions', adaptivePath.nextConcept?.conceptName, 'Fonctions');
    assertNonEmpty(test, 'explanationReasons', adaptivePath.nextConcept?.explanationReasons);
    assertNonEmpty(test, 'decisionExplanation', adaptivePath.decisionExplanation);

    test.actual = {
      nextAction: adaptivePath.nextAction,
      nextConcept: compactConcept(adaptivePath.nextConcept),
      decisionExplanation: adaptivePath.decisionExplanation,
      scoringVersion: adaptivePath.scoringVersion,
    };
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runCaseA2(session, course, concepts) {
  const test = createCase('Case A2 - Apprenant fort sans lacune', {
    expected: {
      nextAction: 'LEARN',
      nextConcept: 'non-null',
      nextConceptStatus: 'LEARNABLE',
      adaptiveScore: 'present',
      scoreBreakdown: 'present',
      explanationReasons: 'non-empty',
      learnableConceptsSorted: 'adaptiveScore descending',
    },
  });

  try {
    await enroll(session, course);
    const mastered = ['Variables', 'Types de données', 'Conditions', 'Boucles'].map((name) => findConcept(concepts, name));

    await simulateDiagnostic(session, course, mastered.map((concept) => diagnosticResult(concept, true, 94)));

    const adaptivePath = await getAdaptivePath(session, course);
    const learnableScores = (adaptivePath.learnableConcepts || []).map((concept) => ({
      conceptName: concept.conceptName,
      adaptiveScore: concept.adaptiveScore,
      scoreBreakdown: concept.scoreBreakdown,
    }));

    assertEquals(test, 'nextAction', 'LEARN', adaptivePath.nextAction);
    assertTrue(test, 'nextConcept non null', Boolean(adaptivePath.nextConcept));
    assertEquals(test, 'nextConcept.status', 'LEARNABLE', adaptivePath.nextConcept?.status);
    assertTrue(test, 'adaptiveScore present', Number.isFinite(Number(adaptivePath.nextConcept?.adaptiveScore)));
    assertTrue(test, 'scoreBreakdown present', Boolean(adaptivePath.nextConcept?.scoreBreakdown));
    assertNonEmpty(test, 'explanationReasons', adaptivePath.nextConcept?.explanationReasons);
    assertTrue(test, 'learnableConcepts sorted by adaptiveScore desc', isSortedByAdaptiveScoreDesc(adaptivePath.learnableConcepts || []));

    test.actual = {
      nextAction: adaptivePath.nextAction,
      nextConcept: compactConcept(adaptivePath.nextConcept),
      learnableScores,
      decisionExplanation: adaptivePath.decisionExplanation,
      scoringVersion: adaptivePath.scoringVersion,
    };
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runCaseB(session, course, concepts) {
  const test = createCase('Case B - Apprenant faible', {
    expected: {
      nextAction: 'REMEDIATION',
      nextConcept: 'Variables',
      explanation: 'present',
    },
  });

  try {
    await enroll(session, course);
    const failed = ['Variables', 'Conditions', 'Boucles'].map((name) => findConcept(concepts, name));

    await simulateDiagnostic(session, course, failed.map((concept, index) => diagnosticResult(concept, false, 30 + index * 5)));

    const adaptivePath = await getAdaptivePath(session, course);
    assertEquals(test, 'nextAction', 'REMEDIATION', adaptivePath.nextAction);
    assertIncludes(test, 'nextConcept = Variables', adaptivePath.nextConcept?.conceptName, 'Variables');
    assertNonEmpty(test, 'explanationReasons', adaptivePath.nextConcept?.explanationReasons);
    assertNonEmpty(test, 'decisionExplanation', adaptivePath.decisionExplanation);

    test.actual = {
      nextAction: adaptivePath.nextAction,
      nextConcept: compactConcept(adaptivePath.nextConcept),
      decisionExplanation: adaptivePath.decisionExplanation,
    };
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runCaseC(session, course) {
  const test = createCase('Case C - Concept externe', {
    expected: {
      nextAction: 'REMEDIATION',
      nextConceptType: 'EXTERNAL',
      nextConceptName: 'Pointeurs',
      frontendRoute: '/learner/external-concepts/:conceptId',
    },
  });

  try {
    await enroll(session, course);
    const externalConcept = { id: 'external-pointeurs-runtime-test', label: 'Pointeurs' };
    await simulateDiagnostic(session, course, [diagnosticResult(externalConcept, false, 35)], { applyMastery: false });

    const adaptivePath = await getAdaptivePath(session, course);
    const route = adaptivePath.nextConcept?.conceptId
      ? `/learner/external-concepts/${adaptivePath.nextConcept.conceptId}`
      : null;

    assertEquals(test, 'nextAction', 'REMEDIATION', adaptivePath.nextAction);
    assertEquals(test, 'nextConcept.type', 'EXTERNAL', adaptivePath.nextConcept?.type);
    assertIncludes(test, 'nextConcept.name', adaptivePath.nextConcept?.conceptName, 'Pointeurs');
    assertTrue(test, 'route externe attendue', typeof route === 'string' && route.startsWith('/learner/external-concepts/'));

    test.actual = {
      nextAction: adaptivePath.nextAction,
      nextConcept: compactConcept(adaptivePath.nextConcept),
      expectedFrontendRoute: route,
      decisionExplanation: adaptivePath.decisionExplanation,
    };
    test.adaptivePathResponse = adaptivePath;
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function runCaseD(activeSession, passiveSession, course, concepts) {
  const test = createCase('Case D - Engagement influence ranking', {
    expected: {
      activeEngagementScore: '> passiveEngagementScore',
      activeAdaptiveScore: '> passiveAdaptiveScore for same recommendation context',
    },
  });

  try {
    await enroll(activeSession, course);
    await enroll(passiveSession, course);

    const mastered = ['Variables', 'Types de données'].map((name) => findConcept(concepts, name));
    const diagnosticResults = mastered.map((concept) => diagnosticResult(concept, true, 88));

    await simulateDiagnostic(activeSession, course, diagnosticResults);
    await simulateDiagnostic(passiveSession, course, diagnosticResults);

    await simulateHighEngagement(activeSession, course, concepts);

    const activePath = await getAdaptivePath(activeSession, course);
    const passivePath = await getAdaptivePath(passiveSession, course);
    const activeNext = activePath.nextConcept;
    const passiveComparable = findComparableConcept(passivePath.learnableConcepts || [], activeNext)
      || passivePath.nextConcept;

    const activeEngagement = Number(activeNext?.scoreBreakdown?.engagementScore ?? -1);
    const passiveEngagement = Number(passiveComparable?.scoreBreakdown?.engagementScore ?? -1);
    const activeScore = Number(activeNext?.adaptiveScore ?? -1);
    const passiveScore = Number(passiveComparable?.adaptiveScore ?? -1);

    assertTrue(test, 'engagementScore actif > passif', activeEngagement > passiveEngagement);
    assertTrue(test, 'adaptiveScore actif > passif', activeScore > passiveScore);

    test.actual = {
      active: {
        learnerEmail: activeSession.email,
        nextConcept: compactConcept(activeNext),
        engagementScore: activeEngagement,
        adaptiveScore: activeScore,
      },
      passive: {
        learnerEmail: passiveSession.email,
        comparedConcept: compactConcept(passiveComparable),
        engagementScore: passiveEngagement,
        adaptiveScore: passiveScore,
      },
      scoreDifference: round(activeScore - passiveScore),
    };
    test.adaptivePathResponse = {
      active: activePath,
      passive: passivePath,
    };
  } catch (error) {
    failCase(test, error);
  } finally {
    finishCase(test);
  }
}

async function simulateHighEngagement(session, course, concepts) {
  const labs = await apiGet(`/content/labs/course/${encodeURIComponent(course.id)}`, session.token).catch(() => []);
  for (const lab of labs.slice(0, 3)) {
    await apiPost('/labs/submit', {
      userId: session.email,
      learnerEmail: session.email,
      studentEmail: session.email,
      labId: lab.id,
      courseId: course.id,
      conceptId: lab.targetId,
      targetId: lab.targetId,
      githubRepoUrl: `https://github.com/adaptive-runtime/${slug(session.email)}-${slug(lab.id)}`,
      status: 'COMPLETED',
      timeSpentPerStep: JSON.stringify({ 0: 120, 1: 240, 2: 180 }),
    }, session.token);
  }

  for (const concept of concepts.slice(0, 4)) {
    await apiPost('/traces', {
      courseId: course.id,
      targetId: concept.id,
      targetType: 'CONCEPT',
      userId: session.email,
      learnerEmail: session.email,
      studentEmail: session.email,
      evaluationId: `runtime-formative-${course.id}-${concept.id}-${Date.now()}`,
      typeEvaluation: 'FORMATIVE',
      scoreObtenu: 92,
      tempsConsultation: 180,
      horodatage: new Date().toISOString().slice(0, 19),
      feedbackGenere: 'Runtime high engagement trace',
      masterySource: 'QUIZ_DIRECT',
    }, session.token);
  }
}

async function simulateDiagnostic(session, course, conceptResults, options = {}) {
  const applyMastery = options.applyMastery !== false;
  const trace = {
    courseId: course.id,
    targetId: course.id,
    targetType: 'COURSE',
    userId: session.email,
    learnerEmail: session.email,
    studentEmail: session.email,
    evaluationId: `runtime-diagnostic-${course.id}-${Date.now()}`,
    typeEvaluation: 'DIAGNOSTIC_ENTREE',
    scoreObtenu: average(conceptResults.map((item) => item.score)),
    tempsConsultation: 300,
    horodatage: new Date().toISOString().slice(0, 19),
    feedbackGenere: 'Runtime adaptive diagnostic simulation',
    masterySource: 'DIAGNOSTIC_ENTREE',
    conceptResults: JSON.stringify(conceptResults),
  };

  await apiPost('/traces', trace, session.token);

  if (applyMastery) {
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
}

async function enroll(session, course) {
  await apiPost(`/graph/courses/${encodeURIComponent(course.id)}/enroll`, {
    learnerEmail: session.email,
    nom: 'Runtime',
    prenom: session.email.split('@')[0],
  }, session.token).catch((error) => {
    if (!String(error.message).includes('404')) return;
    throw error;
  });
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
          moduleTitle: module.title,
          chapitreTitle: chapitre.title,
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

function findComparableConcept(concepts, target) {
  if (!target) return null;
  return concepts.find((concept) => concept.conceptId === target.conceptId)
    || concepts.find((concept) => normalize(concept.conceptName).includes(normalize(target.conceptName)));
}

function isSortedByAdaptiveScoreDesc(concepts) {
  for (let index = 1; index < concepts.length; index += 1) {
    const previous = Number(concepts[index - 1]?.adaptiveScore ?? Number.POSITIVE_INFINITY);
    const current = Number(concepts[index]?.adaptiveScore ?? Number.NEGATIVE_INFINITY);
    if (previous < current) return false;
  }
  return true;
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
  addAssertion(test, label, expected, actual, pass);
}

function assertIncludes(test, label, actual, expectedSubstring) {
  const pass = normalize(actual).includes(normalize(expectedSubstring));
  addAssertion(test, label, `contains ${expectedSubstring}`, actual ?? null, pass);
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

function writeReports() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(reportMdPath, renderMarkdownReport(report), 'utf8');
}

function renderMarkdownReport(data) {
  const lines = [];
  lines.push('# Scoring explicable - Runtime Test Report');
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
    lines.push('Score breakdown / explanations:');
    lines.push('```json');
    lines.push(JSON.stringify(extractExplainability(test), null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function extractExplainability(test) {
  const response = test.adaptivePathResponse;
  if (!response) return {};
  if (response.active || response.passive) {
    return {
      active: compactConcept(response.active.nextConcept),
      passive: compactConcept(response.passive.nextConcept),
    };
  }
  return {
    nextAction: response.nextAction,
    decisionExplanation: response.decisionExplanation,
    nextConcept: compactConcept(response.nextConcept),
    learnableConcepts: (response.learnableConcepts || []).map(compactConcept),
  };
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

function slug(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function serializeError(error) {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
  };
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
