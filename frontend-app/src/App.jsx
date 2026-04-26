import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Sidebar from './components/Layout/Sidebar';
import CourseManager from './pages/CourseManager';
import GraphEditor from './pages/GraphEditor';
import AdminDashboard from './pages/AdminDashboard';
import LearnerDashboard from './pages/LearnerDashboard';
import LearnerCourses from './pages/LearnerCourses';
import LearnerMyCourses from './pages/LearnerMyCourses';
import Register from './pages/Register';
import ProfilePage from './pages/ProfilePage';
import UserManagementTable from './components/Admin/UserManagementTable';
import AdminSettings from './pages/AdminSettings';
import TeacherResources from './pages/TeacherResources';
import TeacherQuizzes from './pages/TeacherQuizzes';
import LabManager from './pages/LabManager';
import StudentQuiz from './pages/StudentQuiz';
import StudentLab from './pages/StudentLab';
import TeacherDashboard from './pages/TeacherDashboard';

const RoleProtectedRoute = ({ children, allowedRoles }) => {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement de la session...</div>;
    if (!isAuthenticated || !user) return <Navigate to="/" replace />;

    if (!allowedRoles.includes(user.role)) {
        if (user.role === 'ROLE_STUDENT') return <Navigate to="/learner/dashboard" />;
        if (user.role === 'ROLE_ADMIN') return <Navigate to="/admin/dashboard" />;
        return <Navigate to="/teacher/dashboard" />;
    }
    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Toaster position="top-right" />
                <Routes>
                    <Route path="/" element={<AuthPage />} />
                    <Route path="/register" element={<Register />} />
                
                {/* TEACHER ROUTES */}
                <Route path="/teacher/dashboard" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><TeacherDashboard /></RoleProtectedRoute>} />
                <Route path="/courses" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><CourseManager /></RoleProtectedRoute>} />
                <Route path="/graph" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><GraphEditor /></RoleProtectedRoute>} />
                <Route path="/teacher/resources" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><TeacherResources /></RoleProtectedRoute>} />
                <Route path="/teacher/quizzes" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><TeacherQuizzes /></RoleProtectedRoute>} />
                <Route path="/teacher/labs" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER']}><LabManager /></RoleProtectedRoute>} />

                {/* ADMIN ROUTES */}
                <Route path="/admin/dashboard" element={<RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}><AdminDashboard /></RoleProtectedRoute>} />
                <Route path="/admin/users" element={
                    <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">Gestion des Utilisateurs</h1>
                            <p className="text-slate-500 text-lg">Gestion complète des comptes enseignants et apprenants.</p>
                            <UserManagementTable />
                        </div>
                    </RoleProtectedRoute>
                } />
                <Route path="/admin/settings" element={<RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}><AdminSettings /></RoleProtectedRoute>} />
                <Route path="/admin/logs" element={
                    <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">Logs Système</h1>
                            <p className="text-slate-500 text-lg">Journaux d'activité et traces des microservices.</p>
                        </div>
                    </RoleProtectedRoute>
                } />
                <Route path="/admin/security" element={
                    <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">Sécurité</h1>
                            <p className="text-slate-500 text-lg">Politiques de sécurité, JWT et contrôle d'accès.</p>
                        </div>
                    </RoleProtectedRoute>
                } />

                {/* LEARNER ROUTES */}
                <Route path="/learner/dashboard" element={<RoleProtectedRoute allowedRoles={['ROLE_STUDENT']}><LearnerDashboard /></RoleProtectedRoute>} />
                <Route path="/learner/courses" element={<RoleProtectedRoute allowedRoles={['ROLE_STUDENT']}><LearnerCourses /></RoleProtectedRoute>} />
                <Route path="/learner/my-courses" element={<RoleProtectedRoute allowedRoles={['ROLE_STUDENT']}><LearnerMyCourses /></RoleProtectedRoute>} />
                <Route path="/student/quiz/:targetId" element={<RoleProtectedRoute allowedRoles={['ROLE_STUDENT', 'ROLE_TEACHER']}><StudentQuiz /></RoleProtectedRoute>} />
                <Route path="/student/lab/:labId" element={<RoleProtectedRoute allowedRoles={['ROLE_STUDENT', 'ROLE_TEACHER']}><StudentLab /></RoleProtectedRoute>} />

                {/* SHARED ROUTES */}
                <Route path="/profile" element={<RoleProtectedRoute allowedRoles={['ROLE_TEACHER', 'ROLE_ADMIN', 'ROLE_STUDENT']}><ProfilePage /></RoleProtectedRoute>} />

                {/* FALLBACK / LEGACY REDIRECT */}
                <Route path="/dashboard" element={<Navigate to="/teacher/dashboard" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
        </AuthProvider>
    );
}
