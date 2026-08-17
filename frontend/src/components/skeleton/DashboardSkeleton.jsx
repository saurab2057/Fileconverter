// src/components/skeletons/DashboardSkeleton.jsx
// Shown while UserDashboard JS chunk is loading.
// Mirrors: Header | Sidebar (desktop) / MobileNav (mobile) | content card with rows.

const S = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
);

// Reuse the same header skeleton shape as MainLayoutSkeleton
const HeaderSkeleton = () => (
  <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">

        <div className="flex items-center space-x-4">
          <div className="md:hidden">
            <S className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            <S className="w-7 h-7 rounded-md" />
            <S className="w-24 h-5 rounded-md" />
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1">
          <S className="w-24 h-8 rounded-md" />
          <S className="w-24 h-8 rounded-md" />
          <S className="w-24 h-8 rounded-md" />
        </nav>

        <div className="flex items-center space-x-2">
          <S className="w-8 h-8 rounded-lg" />
          <S className="hidden md:block w-24 h-8 rounded-md" />
          <S className="w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  </header>
);

// History rows inside the activity card
const HistoryRow = () => (
  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700/80 last:border-0">
    <S className="w-8 h-8 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-1.5">
      <S className="w-48 h-3.5 rounded" />
      <S className="w-32 h-3 rounded" />
    </div>
    <S className="w-20 h-3 rounded flex-shrink-0" />
  </div>
);

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 flex flex-col">

      <HeaderSkeleton />

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (desktop only) ─────────────────────── */}
        <aside className="hidden md:flex flex-col w-[200px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <nav className="flex flex-col gap-1 p-2 pt-3">
            {/* Activity */}
            <div className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-lg bg-gray-100 dark:bg-gray-700/80">
              <S className="w-3.5 h-3.5 rounded" />
              <S className="w-16 h-3.5 rounded" />
            </div>
            {/* Settings */}
            <div className="flex items-center gap-2.5 w-full px-3 py-[7px]">
              <S className="w-3.5 h-3.5 rounded" />
              <S className="w-16 h-3.5 rounded" />
            </div>
            {/* Security */}
            <div className="flex items-center gap-2.5 w-full px-3 py-[7px]">
              <S className="w-3.5 h-3.5 rounded" />
              <S className="w-16 h-3.5 rounded" />
            </div>
          </nav>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Mobile tab bar */}
          <div className="md:hidden flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 py-3">
                <S className="w-4 h-4 rounded" />
                <S className="w-12 h-3 rounded" />
              </div>
            ))}
          </div>

          <main className="flex-1 p-4 md:p-6">
            {/* Activity card */}
            <div className="max-w-3xl">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">

                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="space-y-1.5">
                    <S className="w-36 h-4 rounded" />
                    <S className="w-28 h-3 rounded" />
                  </div>
                  <S className="w-16 h-7 rounded-lg" />
                </div>

                {/* Rows */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <HistoryRow key={i} />
                ))}

                {/* Pagination row */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 dark:border-gray-700">
                  <S className="w-20 h-3 rounded" />
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <S key={i} className="w-7 h-7 rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;