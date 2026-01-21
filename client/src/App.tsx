import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import FeedbackButton from './components/FeedbackButton';
import { Suspense, lazy } from 'react';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetails = lazy(() => import('./pages/CourseDetails'));
const OpenRooms = lazy(() => import('./pages/OpenRooms'));
const RoutineMaker = lazy(() => import('./pages/RoutineMaker'));
const Profile = lazy(() => import('./pages/Profile'));
const CGPACalculator = lazy(() => import('./pages/CGPACalculator'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Loading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses"
                element={<Courses />}
              />
              <Route
                path="/courses/:id"
                element={<CourseDetails />}
              />
              <Route
                path="/open-rooms"
                element={<OpenRooms />}
              />
              <Route
                path="/routine-maker"
                element={
                  <ProtectedRoute>
                    <RoutineMaker />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cgpa-calculator"
                element={
                  <ProtectedRoute>
                    <CGPACalculator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <AdminUsers />
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin/feedback"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <AdminFeedback />
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
            </Routes>
            <FeedbackButton />
          </Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
