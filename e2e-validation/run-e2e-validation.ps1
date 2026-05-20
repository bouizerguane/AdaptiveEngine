param(
    [string]$ApiBaseUrl = $env:E2E_API_BASE_URL,
    [string]$MlServiceUrl = $env:E2E_ML_SERVICE_URL,
    [string]$FrontendUrl = $env:E2E_FRONTEND_URL,
    [string]$LearnerEmail = $env:E2E_LEARNER_EMAIL,
    [string]$LearnerPassword = $env:E2E_LEARNER_PASSWORD,
    [string]$CourseId = $env:E2E_COURSE_ID
)

if ($ApiBaseUrl) { $env:E2E_API_BASE_URL = $ApiBaseUrl }
if ($MlServiceUrl) { $env:E2E_ML_SERVICE_URL = $MlServiceUrl }
if ($FrontendUrl) { $env:E2E_FRONTEND_URL = $FrontendUrl }
if ($LearnerEmail) { $env:E2E_LEARNER_EMAIL = $LearnerEmail }
if ($LearnerPassword) { $env:E2E_LEARNER_PASSWORD = $LearnerPassword }
if ($CourseId) { $env:E2E_COURSE_ID = $CourseId }

Write-Host "Running AdaptiveEngine E2E validation..."
node e2e-validation/run-e2e-validation.mjs
