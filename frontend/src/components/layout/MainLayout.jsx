import { Outlet } from 'react-router-dom';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer';
import HelpChatbot from '@/components/layout/chatbot/HelpChatbot';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const MainLayout = () => {
  const { user, isAuthenticated } = useAuth();

  // If authenticated and role is admin, redirect to admin dashboard
  if (isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return (
    // Use a div as the main container to apply flexbox layout
    <div className="overflow-hidden flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <Header />
      {/* The "flex-grow" class tells this element to expand and fill available space */}
      <main className="flex-grow">
        <Outlet /> {/* Render child routes here */}
      </main>
      <Footer />
      <HelpChatbot />
    </div>
  );
};

export default MainLayout;