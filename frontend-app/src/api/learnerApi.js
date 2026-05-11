import apiClient from './apiClient';

export const learnerApi = {
    getAvailableCourses: () => apiClient.get('/graph/courses/available'),
    searchCourses: (query) => apiClient.get('/graph/courses/search', { params: { query } }),
    enrollInCourse: (courseId, learner) =>
        apiClient.post(`/graph/courses/${courseId}/enroll`, {
            learnerEmail: typeof learner === 'string' ? learner : learner?.email,
            nom: typeof learner === 'string' ? '' : learner?.nom,
            prenom: typeof learner === 'string' ? '' : learner?.prenom,
        }),
    getMyCourses: (learnerEmail) => apiClient.get(`/graph/courses/enrolled/${learnerEmail}`),
    getCourseDiagnostics: (courseId) => apiClient.get(`/content/evaluations/course/${courseId}/diagnostics`),
    getLearningStatus: (learnerEmail, courseId) =>
        apiClient.get(`/graph/courses/${courseId}/learning-status`, { params: { learnerEmail } }),
    getNextRecommendation: (learnerEmail, courseId) =>
        apiClient.get('/graph/recommendations/next', { params: { learnerEmail, courseId } }),
    getAdaptivePath: (courseId) => apiClient.get('/adaptive/path', { params: { courseId } }),
};

export default learnerApi;
