import apiClient from './apiClient';

export const learnerApi = {
    getAvailableCourses: () => apiClient.get('/graph/courses/available'),
    searchCourses: (query) => apiClient.get('/graph/courses/search', { params: { query } }),
    enrollInCourse: (courseId, learnerEmail) =>
        apiClient.post(`/graph/courses/${courseId}/enroll`, { learnerEmail }),
    getMyCourses: (learnerEmail) => apiClient.get(`/graph/courses/enrolled/${learnerEmail}`),
};

export default learnerApi;
