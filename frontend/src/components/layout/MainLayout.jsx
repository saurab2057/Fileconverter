// src/components/layout/MainLayout.jsx
import { Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer';
import HelpChatbot from '@/components/layout/chatbot/HelpChatbot';

// ContentSkeleton is tiny and eagerly imported.
// It fires whenever a child page chunk (HomePage, DynamicConverterPage,
// DynamicCompressorPage, PdfToSummary) is being downloaded.
// Because it only replaces the <main> region, the header and footer
// are already visible — there is no full-page flash.
import ContentSkeleton from '@/components/skeleton/ContentSkeleton';

const MainLayout = () => {
  const { user, isAuthenticated } = useAuth();

  // Admins hitting a public route get redirected immediately.
  if (isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="overflow-hidden flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <Header />

      {/*
        Inner Suspense boundary — catches lazy child pages.
        The outer Suspense in App.jsx (which shows MainLayoutSkeleton)
        only fires the very first time the MainLayout chunk itself loads.
        After that, every subsequent navigation to a child route only
        triggers THIS boundary, keeping the header perfectly stable.
      */}
      <main className="flex-grow">
        <Suspense fallback={<ContentSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      <HelpChatbot />
    </div>
  );
};

export default MainLayout;