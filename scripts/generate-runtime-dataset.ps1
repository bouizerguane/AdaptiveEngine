param(
    [string]$BaseUrl = "http://localhost:8080/api",
    [string]$TeacherEmail = "bouizerguane@gmail.com",
    [string]$TeacherPassword = "moh123"
)

$ErrorActionPreference = "Stop"

function Invoke-Api {
    param(
        [Parameter(Mandatory=$true)][string]$Method,
        [Parameter(Mandatory=$true)][string]$Path,
        [object]$Body = $null,
        [string]$Token = $script:Token
    )

    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $uri = if ($Path.StartsWith("http")) { $Path } else { "$BaseUrl$Path" }
    $json = $null
    if ($null -ne $Body) { $json = $Body | ConvertTo-Json -Depth 20 }

    try {
        if ($null -ne $Body) {
            return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $json
        }
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    } catch {
        $message = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $text = $reader.ReadToEnd()
                $message = "HTTP $status $text"
            } catch {
                $message = "HTTP $status"
            }
        }
        throw "API $Method $Path failed: $message"
    }
}

function New-Question {
    param(
        [string]$ConceptId,
        [string]$Text,
        [string]$Correct,
        [string[]]$Options,
        [string]$Difficulty = "MEDIUM",
        [string]$External = ""
    )
    $q = [ordered]@{
        conceptId = $ConceptId
        generalQuestion = $false
        text = $Text
        type = "QCM"
        options = $Options
        correctAnswer = $Correct
        difficulty = $Difficulty
        hintText = "Relisez la definition et l'exemple associes a ce concept."
    }
    if ($External) { $q.externalPrerequisiteLabel = $External }
    return $q
}

function New-Step {
    param([string]$Id, [string]$Title, [string]$Content, [int]$Order)
    return [ordered]@{
        id = $Id
        title = $Title
        content = $Content
        orderIndex = $Order
    }
}

function Slug {
    param([string]$Value)
    $chars = $Value.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD).ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    }
    $normalized = -join $chars
    $normalized = $normalized -replace "[^a-z0-9]+", "-"
    return $normalized.Trim("-")
}

$A_GRAVE = [string][char]0x00E0
$E_ACUTE = [string][char]0x00E9
$I_CIRC = [string][char]0x00EE
$O_CIRC = [string][char]0x00F4

$courses = @(
    [ordered]@{
        id = "ae-runtime-course-algo"
        title = "Introduction $A_GRAVE l'Algorithmique"
        description = "Cours progressif pour apprendre a formaliser un probleme, manipuler des donnees simples et raisonner avec des structures de controle."
        objectifs = "Ecrire des algorithmes lisibles; choisir les structures de controle adaptees; decomposer un traitement en fonctions."
        prerequisTextuels = "Logique de base; lecture d'enonces; notions elementaires de calcul."
        modules = @(
            [ordered]@{
                id = "ae-runtime-module-algo-bases"
                title = "Bases de l'algorithmique"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-algo-bases"
                    title = "Representer et manipuler les donnees"
                    concepts = @("Variables", "Types de donn${E_ACUTE}es", "Entr${E_ACUTE}es/Sorties")
                }
            },
            [ordered]@{
                id = "ae-runtime-module-algo-control"
                title = "Structures de contr${O_CIRC}le"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-algo-control"
                    title = "Decider, repeter et organiser"
                    concepts = @("Conditions", "Boucles", "Tableaux", "Fonctions")
                }
            }
        )
        relations = @(
            @("Variables", "Types de donn${E_ACUTE}es"),
            @("Types de donn${E_ACUTE}es", "Conditions"),
            @("Conditions", "Boucles"),
            @("Boucles", "Tableaux"),
            @("Tableaux", "Fonctions")
        )
        externalPrereqs = @("Raisonnement logique", "Lecture attentive d'un enonce")
    },
    [ordered]@{
        id = "ae-runtime-course-c"
        title = "Programmation en C"
        description = "Mise en pratique des bases algorithmiques avec la syntaxe C, la compilation et la programmation procedurale."
        objectifs = "Traduire un algorithme en C; utiliser tableaux et fonctions; introduire les pointeurs de maniere progressive."
        prerequisTextuels = "Variables, conditions, boucles et fonctions en algorithmique."
        modules = @(
            [ordered]@{
                id = "ae-runtime-module-c-syntax"
                title = "Syntaxe du langage C"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-c-syntax"
                    title = "Ecrire des instructions C correctes"
                    concepts = @("Variables en C", "Types primitifs", "Conditions en C")
                }
            },
            [ordered]@{
                id = "ae-runtime-module-c-proc"
                title = "Programmation proc${E_ACUTE}durale"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-c-proc"
                    title = "Organiser un programme C"
                    concepts = @("Boucles en C", "Tableaux en C", "Fonctions en C", "Pointeurs")
                }
            }
        )
        relations = @(
            @("Variables en C", "Types primitifs"),
            @("Types primitifs", "Conditions en C"),
            @("Conditions en C", "Boucles en C"),
            @("Boucles en C", "Tableaux en C"),
            @("Tableaux en C", "Fonctions en C"),
            @("Fonctions en C", "Pointeurs")
        )
        externalPrereqs = @("Compilation", "Utilisation simple d'un terminal")
    },
    [ordered]@{
        id = "ae-runtime-course-ds"
        title = "Structures de Donn${E_ACUTE}es"
        description = "Cours oriente choix de structures, representation memoire et parcours pour construire des programmes plus efficaces."
        objectifs = "Comparer des structures lineaires; comprendre arbres et graphes; choisir un parcours adapte au probleme."
        prerequisTextuels = "Pointeurs, tableaux et fonctions en C."
        modules = @(
            [ordered]@{
                id = "ae-runtime-module-ds-linear"
                title = "Structures lin${E_ACUTE}aires"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-ds-linear"
                    title = "Chainage et acces sequentiel"
                    concepts = @("Listes cha${I_CIRC}n${E_ACUTE}es", "Piles", "Files")
                }
            },
            [ordered]@{
                id = "ae-runtime-module-ds-advanced"
                title = "Structures avanc${E_ACUTE}es"
                chapter = [ordered]@{
                    id = "ae-runtime-chapter-ds-advanced"
                    title = "Hierarchies, reseaux et parcours"
                    concepts = @("Arbres", "Graphes", "Algorithmes de parcours")
                }
            }
        )
        relations = @(
            @("Listes cha${I_CIRC}n${E_ACUTE}es", "Piles"),
            @("Piles", "Files"),
            @("Files", "Arbres"),
            @("Arbres", "Graphes"),
            @("Graphes", "Algorithmes de parcours")
        )
        externalPrereqs = @("Complexite intuitive", "Representation en memoire")
    }
)

$interCourseRelations = @(
    @("Variables", "Variables en C"),
    @("Boucles", "Boucles en C"),
    @("Fonctions", "Fonctions en C"),
    @("Pointeurs", "Listes cha${I_CIRC}n${E_ACUTE}es"),
    @("Tableaux en C", "Piles"),
    @("Fonctions en C", "Algorithmes de parcours")
)

Write-Host "Connexion enseignant $TeacherEmail..."
$login = Invoke-Api -Method "POST" -Path "/auth/login" -Body @{ email = $TeacherEmail; password = $TeacherPassword } -Token ""
$script:Token = $login.token
if (-not $script:Token) { throw "JWT absent dans la reponse de login." }
Write-Host "JWT recupere. Role: $($login.role)"

Write-Host "Nettoyage API des cours de test existants..."
foreach ($course in $courses) {
    try { Invoke-Api -Method "DELETE" -Path "/graph/courses/$($course.id)" | Out-Null } catch { Write-Host "  Ignore: $($_)" }
}

$conceptByLabel = @{}
$courseIds = @()
$moduleCount = 0
$chapterCount = 0
$conceptCount = 0
$createdRelations = @()
$createdLabs = @()
$createdEvaluations = @()
$createdDiagnostics = @()
$errors = @()

foreach ($course in $courses) {
    Write-Host "Creation cours: $($course.title)"
    $savedCourse = Invoke-Api -Method "POST" -Path "/graph/courses" -Body @{
        id = $course.id
        title = $course.title
        description = $course.description
        objectifs = $course.objectifs
        prerequisTextuels = $course.prerequisTextuels
        authorEmail = $TeacherEmail
        authorName = "Bouizerguane"
        status = "PUBLISHED"
    }
    $courseIds += $savedCourse.id

    for ($moduleIndex = 0; $moduleIndex -lt $course.modules.Count; $moduleIndex++) {
        $module = $course.modules[$moduleIndex]
        $savedModule = Invoke-Api -Method "POST" -Path "/graph/modules?courseId=$($course.id)" -Body @{
            id = $module.id
            title = $module.title
            description = "Module $($moduleIndex + 1) du cours $($course.title)."
            orderIndex = $moduleIndex
            authorEmail = $TeacherEmail
        }
        $moduleCount++

        $chapter = $module.chapter
        $savedChapter = Invoke-Api -Method "POST" -Path "/graph/modules/$($savedModule.id)/chapitres" -Body @{
            id = $chapter.id
            title = $chapter.title
            description = "Chapitre de mise en pratique progressive."
            orderIndex = 0
        }
        $chapterCount++

        for ($conceptIndex = 0; $conceptIndex -lt $chapter.concepts.Count; $conceptIndex++) {
            $label = $chapter.concepts[$conceptIndex]
            $conceptId = "ae-runtime-concept-$(Slug $label)"
            $difficultyWeight = [math]::Round(0.25 + (($conceptCount % 5) * 0.15), 2)
            $savedConcept = Invoke-Api -Method "POST" -Path "/graph/chapitres/$($savedChapter.id)/concepts" -Body @{
                id = $conceptId
                labelPedagogique = $label
                description = "Concept cle pour progresser dans $($course.title): $label."
                poidsCognitif = $difficultyWeight
                estVerrouille = $false
                orderIndex = $conceptIndex
            }
            $conceptByLabel[$label] = [ordered]@{
                id = $savedConcept.id
                label = $label
                courseId = $course.id
                courseTitle = $course.title
            }
            $conceptCount++

            $html = "<h2>$label</h2><p>Objectif: comprendre le role de <strong>$label</strong> dans le parcours $($course.title).</p><p>Exemple guide: identifier la situation, appliquer la regle, puis verifier le resultat.</p><ul><li>Definition courte</li><li>Exemple contextualise</li><li>Erreur frequente et remediation</li></ul>"
            Invoke-Api -Method "POST" -Path "/content/save" -Body @{
                conceptId = $savedConcept.id
                htmlContent = $html
            } | Out-Null

            $lab = Invoke-Api -Method "POST" -Path "/content/labs" -Body @{
                targetId = $savedConcept.id
                courseId = $course.id
                title = "TP - $label"
                difficulty = if ($difficultyWeight -lt 0.55) { "EASY" } elseif ($difficultyWeight -lt 0.85) { "MEDIUM" } else { "HARD" }
                estimatedTime = 35 + (($conceptCount % 3) * 10)
                requireGithub = $true
                steps = @(
                    (New-Step -Id "$($savedConcept.id)-step-1" -Title "Analyse" -Order 0 -Content "<p>Reformulez le probleme et listez les donnees liees a $label.</p>"),
                    (New-Step -Id "$($savedConcept.id)-step-2" -Title "Implementation" -Order 1 -Content "<p>Produisez une solution minimale, testable et commentee.</p>"),
                    (New-Step -Id "$($savedConcept.id)-step-3" -Title "Validation" -Order 2 -Content "<p>Ajoutez deux jeux d'essai, dont un cas limite.</p>")
                )
            }
            $createdLabs += $lab

            $eval = Invoke-Api -Method "POST" -Path "/content/evaluations" -Body @{
                courseId = $course.id
                targetId = $savedConcept.id
                targetType = "CONCEPT"
                typeEvaluation = "FORMATIVE"
                seuilReussite = 70
                nbrTentativesMax = 3
                tempsImparti = 12
                allowBacktrack = $true
                shuffleQuestions = $false
                showImmediateFeedback = $true
                retryDelayHours = 0
                coefficient = 1
                nbQuestionsATirer = 0
                equilibrerDifficulte = $false
                questions = @(
                    (New-Question -ConceptId $savedConcept.id -Text "Quel est le role principal de $label dans ce parcours ?" -Correct "Structurer la resolution du probleme" -Options @("Structurer la resolution du probleme", "Remplacer tous les autres concepts", "Ignorer les contraintes", "Garantir une solution sans test") -Difficulty "EASY"),
                    (New-Question -ConceptId $savedConcept.id -Text "Quelle pratique aide a maitriser $label ?" -Correct "Tester sur un cas simple puis un cas limite" -Options @("Tester sur un cas simple puis un cas limite", "Eviter les exemples", "Changer de syntaxe au hasard", "Supprimer les commentaires") -Difficulty "MEDIUM")
                )
            }
            $createdEvaluations += $eval
        }
    }
}

Write-Host "Creation relations internes..."
foreach ($course in $courses) {
    foreach ($rel in $course.relations) {
        try {
            $source = $conceptByLabel[$rel[0]].id
            $target = $conceptByLabel[$rel[1]].id
            Invoke-Api -Method "POST" -Path "/graph/concepts/$source/exige/$target" | Out-Null
            $createdRelations += "$($rel[0]) -> $($rel[1])"
        } catch { $errors += $_.ToString() }
    }
}

Write-Host "Creation relations inter-cours..."
foreach ($rel in $interCourseRelations) {
    try {
        $source = $conceptByLabel[$rel[0]].id
        $target = $conceptByLabel[$rel[1]].id
        Invoke-Api -Method "POST" -Path "/graph/concepts/$source/exige/$target" | Out-Null
        $createdRelations += "$($rel[0]) -> $($rel[1])"
    } catch { $errors += $_.ToString() }
}

Write-Host "Creation diagnostics d'entree..."
foreach ($course in $courses) {
    $courseConcepts = @()
    foreach ($module in $course.modules) {
        foreach ($label in $module.chapter.concepts) { $courseConcepts += $conceptByLabel[$label] }
    }
    $questions = @()
    foreach ($concept in $courseConcepts) {
        $questions += (New-Question -ConceptId $concept.id -Text "Diagnostic: quel signe montre que le concept '$($concept.label)' est compris ?" -Correct "Je peux l'expliquer et l'appliquer sur un exemple" -Options @("Je peux l'expliquer et l'appliquer sur un exemple", "Je connais seulement son nom", "Je le saute systematiquement", "Je l'utilise sans verifier") -Difficulty "MEDIUM")
    }
    foreach ($external in $course.externalPrereqs) {
        $questions += (New-Question -ConceptId "" -External $external -Text "Prerequis externe: pourquoi '$external' aide-t-il a commencer ce cours ?" -Correct "Il facilite la comprehension des enonces et des choix de solution" -Options @("Il facilite la comprehension des enonces et des choix de solution", "Il remplace toutes les evaluations", "Il evite la pratique", "Il n'a aucun lien avec le cours") -Difficulty "EASY")
    }
    $diag = Invoke-Api -Method "POST" -Path "/content/evaluations" -Body @{
        courseId = $course.id
        targetId = $course.id
        targetType = "COURSE"
        typeEvaluation = "DIAGNOSTIC_ENTREE"
        seuilReussite = 65
        nbrTentativesMax = 2
        tempsImparti = 25
        allowBacktrack = $true
        shuffleQuestions = $false
        showImmediateFeedback = $false
        retryDelayHours = 0
        coefficient = 1
        nbQuestionsATirer = 0
        equilibrerDifficulte = $true
        questions = $questions
    }
    $createdDiagnostics += $diag
}

Write-Host "Creation de traces enseignant de test dans PostgreSQL et publication RabbitMQ..."
$firstConcepts = @(
    $conceptByLabel["Variables"],
    $conceptByLabel["Variables en C"],
    $conceptByLabel["Listes cha${I_CIRC}n${E_ACUTE}es"]
)
foreach ($concept in $firstConcepts) {
    $eval = $createdEvaluations | Where-Object { $_.targetId -eq $concept.id } | Select-Object -First 1
    $lab = $createdLabs | Where-Object { $_.targetId -eq $concept.id } | Select-Object -First 1
    if ($eval) {
        Invoke-Api -Method "POST" -Path "/traces" -Body @{
            courseId = $concept.courseId
            targetId = $concept.id
            targetType = "CONCEPT"
            studentEmail = $TeacherEmail
            learnerEmail = $TeacherEmail
            userId = $TeacherEmail
            evaluationId = $eval.id
            typeEvaluation = "FORMATIVE"
            scoreObtenu = 82
            tempsConsultation = 420
            feedbackGenere = "Trace de test enseignant pour verifier dashboard, RabbitMQ et tutoring."
            tabSwitchesCount = 0
            masterySource = "QUIZ_DIRECT"
            conceptResults = "[{`"conceptId`":`"$($concept.id)`",`"mastered`":true,`"score`":82}]"
        } | Out-Null
    }
    if ($lab) {
        Invoke-Api -Method "POST" -Path "/labs/submit" -Body @{
            userId = $TeacherEmail
            learnerEmail = $TeacherEmail
            studentEmail = $TeacherEmail
            labId = $lab.id
            courseId = $concept.courseId
            conceptId = $concept.id
            targetId = $concept.id
            githubRepoUrl = "https://github.com/example/adaptiveengine-dataset-test"
            status = "COMPLETED"
            timeSpentPerStep = "{`"0`":120,`"1`":300,`"2`":180}"
            teacherTest = $true
        } | Out-Null
    }
}

$dashboardLabConcepts = @(
    $conceptByLabel["Conditions"],
    $conceptByLabel["Boucles en C"],
    $conceptByLabel["Piles"]
)
foreach ($concept in $dashboardLabConcepts) {
    $lab = $createdLabs | Where-Object { $_.targetId -eq $concept.id } | Select-Object -First 1
    if ($lab) {
        Invoke-Api -Method "POST" -Path "/labs/submit" -Body @{
            userId = $TeacherEmail
            learnerEmail = $TeacherEmail
            studentEmail = $TeacherEmail
            labId = $lab.id
            courseId = $concept.courseId
            conceptId = $concept.id
            targetId = $concept.id
            githubRepoUrl = "https://github.com/example/adaptiveengine-dashboard-sample"
            status = "COMPLETED"
            timeSpentPerStep = "{`"0`":150,`"1`":360,`"2`":210}"
        } | Out-Null
    }
}

Write-Host "Verification via gateway..."
$teacherCourses = Invoke-Api -Method "GET" -Path "/graph/courses/teacher/$TeacherEmail"
$availableCourses = Invoke-Api -Method "GET" -Path "/graph/courses/available"
$treeChecks = @()
$diagnosticChecks = @()
$contentChecks = @()
$labChecks = @()
$quizChecks = @()
$externalChecks = @()

foreach ($course in $courses) {
    $tree = Invoke-Api -Method "GET" -Path "/graph/courses/$($course.id)/tree"
    $treeChecks += $tree
    $diagnostics = Invoke-Api -Method "GET" -Path "/content/evaluations/course/$($course.id)/diagnostics"
    $diagnosticChecks += @{ courseId = $course.id; count = @($diagnostics).Count }
    $externalPrereqs = Invoke-Api -Method "GET" -Path "/graph/courses/$($course.id)/prerequisite-concepts"
    $externalChecks += @{ courseId = $course.id; count = @($externalPrereqs).Count; labels = @($externalPrereqs | ForEach-Object { $_.labelPedagogique }) }
}

foreach ($concept in $conceptByLabel.Values) {
    try { Invoke-Api -Method "GET" -Path "/content/concept/$($concept.id)" | Out-Null; $contentChecks += $concept.id } catch { $errors += $_.ToString() }
    try { Invoke-Api -Method "GET" -Path "/content/labs/$($concept.id)" | Out-Null; $labChecks += $concept.id } catch { $errors += $_.ToString() }
    try { Invoke-Api -Method "GET" -Path "/content/evaluations/$($concept.id)" | Out-Null; $quizChecks += $concept.id } catch { $errors += $_.ToString() }
}

$summary = [ordered]@{
    generatedAt = (Get-Date).ToString("s")
    teacherEmail = $TeacherEmail
    courseIds = $courseIds
    modules = $moduleCount
    chapters = $chapterCount
    concepts = $conceptCount
    formativeEvaluations = @($createdEvaluations).Count
    diagnostics = @($createdDiagnostics).Count
    resources = @($contentChecks).Count
    labs = @($labChecks).Count
    interCourseRelations = @($interCourseRelations | ForEach-Object { "$($_[0]) -> $($_[1])" })
    totalRelationsRequested = @($createdRelations).Count
    teacherCoursesVisible = @($teacherCourses | Where-Object { $courseIds -contains $_.id }).Count
    learnerCoursesVisible = @($availableCourses | Where-Object { $courseIds -contains $_.id }).Count
    diagnosticsByCourse = $diagnosticChecks
    externalPrerequisitesByCourse = $externalChecks
    cleanup = "Supprimer via admin/interface ou via API DELETE /api/graph/courses/{id} pour: $($courseIds -join ', '). Les contenus Mongo sont upsertes par conceptId/targetId et seront remplaces si le script est relance."
    errors = $errors
}

$summary | ConvertTo-Json -Depth 20

