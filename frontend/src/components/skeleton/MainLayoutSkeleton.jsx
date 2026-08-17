// src/components/skeletons/MainLayoutSkeleton.jsx
// Shown while MainLayout JS chunk is loading (first ever visit).
// Mirrors the real header + a generic converter/hero content area so
// there is zero layout shift when the real page appears.

const S = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const MainLayoutSkeleton = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Left — hamburger (mobile) + logo */}
            <div className="flex items-center space-x-4">
              {/* Hamburger visible on mobile only */}
              <div className="md:hidden">
                <S className="w-6 h-6" />
              </div>
              {/* Logo */}
              <div className="flex items-center gap-2">
                <S className="w-7 h-7 rounded-md" />
                <S className="w-24 h-5 rounded-md" />
              </div>
            </div>

            {/* Centre — desktop nav pills */}
            <nav className="hidden md:flex items-center space-x-1">
              <S className="w-24 h-8 rounded-md" />
              <S className="w-24 h-8 rounded-md" />
              <S className="w-24 h-8 rounded-md" />
            </nav>

            {/* Right — theme toggle + dashboard + avatar */}
            <div className="flex items-center space-x-2">
              <S className="w-8 h-8 rounded-lg" />
              <S className="hidden md:block w-24 h-8 rounded-md" />
              <S className="w-8 h-8 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero / content area ─────────────────────────────── */}
      <main className="flex-grow">
        {/* Hero gradient background */}
        <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-900 py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

            {/* Page title */}
            <S className="w-64 h-10 rounded-xl mb-3" />
            <S className="w-80 h-6 rounded-lg mb-12" />

            {/* Upload box outline */}
            <div className="w-full max-w-3xl">
              {/* Subtitle */}
              <S className="w-72 h-5 rounded-lg mx-auto mb-8" />

              {/* Dashed upload area */}
              <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[360px] p-12 flex flex-col items-center justify-center gap-6">
                {/* Choose files button */}
                <S className="w-48 h-14 rounded-xl" />
                {/* Drag text */}
                <S className="w-52 h-5 rounded-lg" />
                {/* Size hint */}
                <S className="w-64 h-4 rounded-md" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer hint ─────────────────────────────────────── */}
      <div className="bg-[#165246] h-16" />
    </div>
  );
};

export default MainLayoutSkeleton;