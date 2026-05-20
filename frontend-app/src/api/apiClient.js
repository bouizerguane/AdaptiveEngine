import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor des requêtes : injecter le token JWT s'il existe
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));

// Interceptor des réponses : purge locale sur une 401 Unauthorized
apiClient.interceptors.response.use(response => response, error => {
    if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    }
    return Promise.reject(error);
});


export const authApi = {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    register: (userData) => apiClient.post('/auth/signup', userData)
};

export const adminApi = {
    getPendingUsers: () => apiClient.get('/admin/users/pending'),
    approveUser: (id) => apiClient.put(`/admin/users/${id}/approve`),
    getAllUsers: () => apiClient.get('/admin/users'),
    deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
    updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data),
    getSettings: () => apiClient.get('/admin/settings'),
    getSettingByKey: (key) => apiClient.get(`/admin/settings/${key}`),
    updateSettings: (data) => apiClient.put('/admin/settings', data),
};

export const userApi = {
    getProfile: () => apiClient.get('/user/me'),
    updateProfile: (data) => apiClient.put('/user/me', data)
};

export const courseApi = {
    getCourses: () => apiClient.get('/graph/courses'),
    createCourse: (data) => apiClient.post('/graph/courses', data),
    updateCourse: (id, data) => apiClient.put(`/graph/courses/${id}`, data),
    deleteCourse: (id) => apiClient.delete(`/graph/courses/${id}`),
    getCourseTree: (id) => apiClient.get(`/graph/courses/${id}/tree`),
};

export const graphApi = {
    getTeacherCourses: (email) => apiClient.get(`/graph/courses/teacher/${email}`),
    getAdminCourses: () => apiClient.get('/graph/admin/courses'),
    deleteCoursesBulk: (courseIds) => apiClient.delete('/graph/admin/courses/bulk', { data: { courseIds } }),
    getCoursePrerequisiteConcepts: (courseId) => apiClient.get(`/graph/courses/${courseId}/prerequisite-concepts`),
    getConceptContext: (conceptId, currentCourseId) =>
        apiClient.get(`/graph/concepts/${conceptId}/context`, { params: { currentCourseId } }),
    getCourseEnrollments: (courseId) =>
        apiClient.get(`/graph/courses/${courseId}/enrollments`),
    unenrollLearner: (courseId, learnerEmail) =>
        apiClient.delete(`/graph/courses/${courseId}/enrollments/${encodeURIComponent(learnerEmail)}`),
    // --- MODULES ---
    getModules: () => apiClient.get('/graph/modules'),
    createModule: (courseId, data) => apiClient.post(`/graph/modules${courseId ? `?courseId=${courseId}` : ''}`, data),
    updateModule: (id, data) => apiClient.put(`/graph/modules/${id}`, data),
    deleteModule: (id) => apiClient.delete(`/graph/modules/${id}`),
    reorderModules: (ids) => apiClient.put('/graph/modules/reorder', ids),

    // --- CHAPITRES ---
    createChapitre: (moduleId, data) => apiClient.post(`/graph/modules/${moduleId}/chapitres`, data),
    updateChapitre: (id, data) => apiClient.put(`/graph/chapitres/${id}`, data),
    deleteChapitre: (id) => apiClient.delete(`/graph/chapitres/${id}`),
    reorderChapitres: (ids) => apiClient.put('/graph/chapitres/reorder', ids),

    // --- CONCEPTS (A l'intérieur d'un Chapitre) ---
    getConcepts: () => apiClient.get('/graph/concepts'),
    createConceptInChapitre: (chapitreId, data) => apiClient.post(`/graph/chapitres/${chapitreId}/concepts`, data),
    updateConcept: (id, data) => apiClient.put(`/graph/concepts/${id}`, data),
    deleteConcept: (id) => apiClient.delete(`/graph/concepts/${id}`),
    reorderConcepts: (ids) => apiClient.put('/graph/concepts/reorder', ids),

    // --- RELATIONS DAG (Exigences) ---
    addExigence: (sourceId, targetId) => apiClient.post(`/graph/concepts/${sourceId}/exige/${targetId}`),
    removeExigence: (sourceId, targetId) => apiClient.delete(`/graph/concepts/${sourceId}/exige/${targetId}`),

    // --- POSITIONS ---
    updatePositions: (positions) => apiClient.put('/graph/nodes/positions', positions)
};

export const contentApi = {
    getRessourcesByConcept: (conceptId) => apiClient.get(`/content/concept/${conceptId}`),
    getConceptContent: (conceptId) => apiClient.get(`/content/concept/${conceptId}`),
    saveContent: (data) => apiClient.post('/content/save', data),
    uploadMedia: (formData) => apiClient.post('/content/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
};

export const evaluationApi = {
    getEvaluation: (targetId, typeEvaluation) =>
        apiClient.get(`/content/evaluations/${targetId}`, {
            params: typeEvaluation ? { typeEvaluation } : {}
        }),
    getCourseEvaluations: (courseId) => apiClient.get(`/content/evaluations/course/${courseId}`),
    getCourseDiagnostics: (courseId) => apiClient.get(`/content/evaluations/course/${courseId}/diagnostics`),
    saveEvaluation: (data) => apiClient.post('/content/evaluations', data),
};

export const trackingApi = {
    saveTrace: (trace) => apiClient.post('/traces', trace),
    getTracesByUser: (userId) => apiClient.get(`/traces/user/${userId}`),
    getTracesByUserAndEvaluation: (userId, evaluationId) =>
        apiClient.get(`/traces/user/${userId}/evaluation/${evaluationId}`),
    getLatestDiagnostic: (learnerEmail, courseId) =>
        apiClient.get('/traces/diagnostics/latest', { params: { learnerEmail, courseId } }),
    getDashboardSummary: () =>
        apiClient.get('/tracking/dashboard/summary')
};

export const masteryApi = {
    /** Valide tous les concepts d'un module (DIAGNOSTIC_POSITIONNEMENT réussi). */
    validateModule: (moduleId) =>
        apiClient.post('/graph/mastery/validate-module', { moduleId }),

    /**
     * Valide un concept unique avec un basis spécifique.
     *   basis='LAB'        → Capacité d'Application (TP + GitHub soumis)
     *   basis='QUIZ_DIRECT' → Connaissance (quiz réussi)
     */
    validateConcept: (conceptId, basis = 'QUIZ_DIRECT') =>
        apiClient.post('/graph/mastery/validate-concept', { conceptId, basis }),
    isConceptMastered: (conceptId, learnerEmail) =>
        apiClient.get(`/graph/mastery/concepts/${conceptId}`, { params: { learnerEmail } }),
};

export const adaptiveApi = {
    submitDiagnostic: (data) => apiClient.post('/graph/adaptive/diagnostic', data),
};

export const tutoringApi = {
    getFeedback: (data) => apiClient.post('/tutoring/feedback', data),
};

/** API Labs (Travaux Pratiques) — content-service */
export const labApi = {
    getLabById:      (id)       => apiClient.get(`/content/labs/id/${id}`),
    getLabByTarget:  (targetId) => apiClient.get(`/content/labs/${targetId}`),
    getLabsByCourse: (courseId) => apiClient.get(`/content/labs/course/${courseId}`),
    saveLab:         (data)     => apiClient.post('/content/labs', data),
    deleteLab:       (id)       => apiClient.delete(`/content/labs/${id}`),
};

/** API Suivi des Labs — tracking-service */
export const labTrackingApi = {
    /** Démarre ou met à jour une soumission (status: STARTED | COMPLETED). */
    submit:          (data)              => apiClient.post('/labs/submit', data),
    getByUser:       (userId)            => apiClient.get(`/labs/user/${userId}`),
    getByLabAndUser: (labId, userId)     => apiClient.get(`/labs/${labId}/user/${userId}`),
    getLabStats:     (labId)             => apiClient.get(`/labs/${labId}/submissions`),
};

export default apiClient;
