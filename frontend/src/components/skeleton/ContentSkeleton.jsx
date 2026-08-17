// src/components/skeletons/ContentSkeleton.jsx
// Shown inside MainLayout's <Outlet> Suspense while a page chunk loads.
// The header is already visible — this only covers the content area,
// preventing a full-page flash and header flicker on route changes.

const S = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const ContentSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Hero / tool section */}
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-900 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

          {/* Title */}
          <S className="w-72 h-10 rounded-xl mb-3" />
          {/* Subtitle */}
          <S className="w-96 h-6 rounded-lg mb-12" />

          {/* Upload box */}
          <div className="w-full max-w-3xl">
            <S className="w-64 h-5 rounded-lg mx-auto mb-8" />

            <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[360px] p-12 flex flex-col items-center justify-center gap-6">
              <S className="w-48 h-14 rounded-xl" />
              <S className="w-52 h-5 rounded-lg" />
              <S className="w-64 h-4 rounded-md" />
              <S className="w-44 h-4 rounded-md" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContentSkeleton;