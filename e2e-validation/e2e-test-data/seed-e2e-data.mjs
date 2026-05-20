import fs from 'node:fs';

const API_BASE_URL = process.env.E2E_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:8080/api';
const ADMIN_EMAIL = process.env.ADAPTIVE_ADMIN_EMAIL || 'admin@system.com';
const ADMIN_PASSWORD = process.env.ADAPTIVE_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'moh123';
const REPORT_PATH = 'e2e-validation/e2e-test-data/e2e_seed_report.json';

const learners = {
  repeatedFailure: 'student.repeated.failure@test.local',
  remediationSuccess: 'student.remediation.success@test.local',
  highMasteryReady: 'student.high.mastery.ready@test.local',
  lowData: 'student.low.data@test.local',
  mlFallback: 'student.ml.fallback@test.local',
};

const report = {
  generatedAt: new Date().toISOString(),
  apiBaseUrl: API_BASE_URL,
  learners,
  course: null,
  tracesCreated: [],
  actions: [],
};

async function main() {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await ensureLearners(admin.token);

  const sessions = {};
  for (const [key, email] of Object.entries(learners)) {
    sessions[key] = await login(email, TEST_PASSWORD);
  }

  const course = await findCourse(admin.token, [
    'Introduction a l Algorithmique',
    'Introduction à l Algorithmique',
    'Introduction à l’Algorithmique',
    'Algorithmique',
  ]);
  report.course = course;

  const courseTree = await apiGet(`/graph/courses/${encodeURIComponent(course.id)}/tree`, admin.token);
  const concepts = flattenConcepts(courseTree);
  const variables = findConcept(concepts, 'Variables');
  const types = findConcept(concepts, 'Types');
  const conditions = findConcept(concepts, 'Conditions');

  await seedRepeatedFailure(sessions.repeatedFailure, course, variables);
  await seedRemediationSuccess(sessions.remediationSuccess, course, variables);
  await seedHighMasteryReady(sessions.highMasteryReady, course, [variables, types, conditions]);
  await seedLowData(sessions.lowData, course);
  await seedLowData(sessions.mlFallback, course);

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    status: 'OK',
    report: REPORT_PATH,
    courseId: course.id,
    learners,
    tracesCreated: report.tracesCreated.length,
  }, null, 2));
}

async function ensureLearners(adminToken) {
  for (const email of Object.values(learners)) {
    await signupIfNeeded(email);
  }
  const users = await apiGet('/admin/users', adminToken);
  for (const email of Object.values(learners)) {
    const user = users.find(item => normalize(item.email) === normalize(email));
    if (!user) throw new Error(`User not found after signup: ${email}`);
    if (!user.estApprouve) {
      await apiPut(`/admin/users/${encodeURIComponent(user.id)}/approve`, undefined, adminToken);
      report.actions.push({ type: 'approve-user', email });
    }
  }
}

async function signupIfNeeded(email) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'E2E',
      prenom: email.split('@')[0].replace('student.', '').replaceAll('.', '-'),
      email,
      password: TEST_PASSWORD,
      role: 'STUDENT',
    }),
  });
  if (response.ok) {
    report.actions.push({ type: 'signup-user', email });
    return;
  }
  const text = await response.text();
  if (response.status === 400 && normalize(text).includes('email')) {
    report.actions.push({ type: 'signup-skip-existing', email });
    return;
  }
  throw new Error(`Signup failed for ${email}: HTTP ${response.status} ${text}`);
}

async function seedRepeatedFailure(session, course, concept) {
  await enroll(session, course);
  await ensureDiagnosticTrace(session, course, [
    diagnosticResult(concept, false, 35),
  ], 'e2e-repeated-failure-diagnostic');
  await applyDiagnostic(session, course, [
    diagnosticResult(concept, false, 35),
  ]);
  for (let index = 1; index <= 3; index += 1) {
    await ensureConceptTrace(session, course, concept, 42, `e2e-repeated-failure-formative-${index}`);
  }
}

async function seedRemediationSuccess(session, course, concept) {
  await enroll(session, course);
  await ensureDiagnosticTrace(session, course, [
    diagnosticResult(concept, false, 38),
  ], 'e2e-remediation-success-diagnostic');
  await applyDiagnostic(session, course, [
    diagnosticResult(concept, false, 38),
  ]);
  for (let index = 1; index <= 3; index += 1) {
    await ensureConceptTrace(session, course, concept, 40, `e2e-remediation-success-failure-${index}`);
  }
  await ensureConceptTrace(session, course, concept, 88, 'e2e-remediation-success-formative-pass');
  await validateConcept(session, concept.id, 'QUIZ_DIRECT');
}

async function seedHighMasteryReady(session, course, masteredConcepts) {
  await enroll(session, course);
  const results = masteredConcepts.map(concept => diagnosticResult(concept, true, 94));
  await ensureDiagnosticTrace(session, course, results, 'e2e-high-mastery-diagnostic');
  await applyDiagnostic(session, course, results);
  for (const [index, concept] of masteredConcepts.entries()) {
    await ensureConceptTrace(session, course, concept, 92 + index, `e2e-high-mastery-formative-${index + 1}`);
    await validateConcept(session, concept.id, 'QUIZ_DIRECT');
  }
}

async function seedLowData(session, course) {
  await enroll(session, course);
}

async function enroll(session, course) {
  await apiPost(`/graph/courses/${encodeURIComponent(course.id)}/enroll`, {
    learnerEmail: session.email,
    nom: 'E2E',
    prenom: session.email.split('@')[0],
  }, session.token);
  report.actions.push({ type: 'enroll', email: session.email, courseId: course.id });
}

async function ensureDiagnosticTrace(session, course, conceptResults, marker) {
  const existing = await existingTraceByEvaluation(session, marker);
  if (existing) {
    report.actions.push({ type: 'trace-skip-existing', email: session.email, marker });
    return;
  }
  await apiPost('/traces', {
    courseId: course.id,
    targetId: course.id,
    targetType: 'COURSE',
    userId: session.email,
    learnerEmail: session.email,
    studentEmail: session.email,
    evaluationId: marker,
    typeEvaluation: 'DIAGNOSTIC_ENTREE',
    scoreObtenu: average(conceptResults.map(item => item.score)),
    tempsConsultation: 300,
    horodatage: new Date().toISOString().slice(0, 19),
    feedbackGenere: marker,
    masterySource: 'DIAGNOSTIC_ENTREE',
    conceptResults: JSON.stringify(conceptResults),
  }, session.token);
  report.tracesCreated.push({ email: session.email, marker, type: 'diagnostic' });
}

async function ensureConceptTrace(session, course, concept, score, marker) {
  const existing = await existingTraceByEvaluation(session, marker);
  if (existing) {
    report.actions.push({ type: 'trace-skip-existing', email: session.email, marker });
    return;
  }
  await apiPost('/traces', {
    courseId: course.id,
    targetId: concept.id,
    targetType: 'CONCEPT',
    userId: session.email,
    learnerEmail: session.email,
    studentEmail: session.email,
    evaluationId: marker,
    typeEvaluation: 'FORMATIVE',
    scoreObtenu: score,
    tempsConsultation: 240,
    horodatage: new Date().toISOString().slice(0, 19),
    feedbackGenere: marker,
    masterySource: 'QUIZ_DIRECT',
  }, session.token);
  report.tracesCreated.push({ email: session.email, marker, conceptId: concept.id, score, type: 'formative' });
}

async function existingTraceByEvaluation(session, evaluationId) {
  const response = await apiGet(`/traces/user/${encodeURIComponent(session.email)}/evaluation/${encodeURIComponent(evaluationId)}`, session.token);
  return Array.isArray(response) && response.length > 0;
}

async function applyDiagnostic(session, course, conceptResults) {
  await apiPost('/graph/adaptive/diagnostic', {
    learnerEmail: session.email,
    courseId: course.id,
    typeEvaluation: 'DIAGNOSTIC_ENTREE',
    conceptResults: conceptResults.map(item => ({
      conceptId: item.conceptId,
      conceptName: item.conceptName,
      mastered: item.mastered,
      score: item.score,
    })),
  }, session.token);
  report.actions.push({ type: 'apply-diagnostic', email: session.email, courseId: course.id });
}

async function validateConcept(session, conceptId, basis) {
  await apiPost('/graph/mastery/validate-concept', { conceptId, basis }, session.token);
  report.actions.push({ type: 'validate-concept', email: session.email, conceptId, basis });
}

async function findCourse(token, labels) {
  const courses = await apiGet('/graph/courses', token);
  const course = courses.find(item => labels.some(label => normalize(item.title).includes(normalize(label))));
  if (!course) {
    throw new Error(`Runtime course not found. Run scripts/generate-runtime-dataset.ps1 first. Available=${courses.map(item => item.title).join(', ')}`);
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

function findConcept(concepts, label) {
  const concept = concepts.find(item => normalize(item.label).includes(normalize(label)));
  if (!concept) {
    throw new Error(`Concept not found: ${label}. Available=${concepts.map(item => item.label).join(', ')}`);
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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function average(values) {
  return Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, values.length));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

main().catch(error => {
  fs.mkdirSync('e2e-validation/e2e-test-data', { recursive: true });
  report.error = error.stack || error.message;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.error(error);
  process.exit(1);
});
