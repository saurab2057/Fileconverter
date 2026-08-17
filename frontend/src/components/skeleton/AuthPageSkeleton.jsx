// src/components/skeletons/AuthPageSkeleton.jsx
// Shown while Login / Signup / PasskeyLogin JS chunks are loading.
// Uses the same dark-gradient background as the auth pages so the
// transition is invisible — user just sees the card fill in.

const S = ({ className = '' }) => (
  <div
    className={`rounded animate-pulse bg-white/20 ${className}`}
  />
);

const AuthPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">

        {/* Frosted card shell */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 space-y-5">

          {/* Title */}
          <div className="flex flex-col items-center gap-2 mb-2">
            <S className="w-48 h-7 rounded-lg" />
            <S className="w-36 h-4 rounded-md" />
          </div>

          {/* Input fields */}
          <S className="w-full h-11 rounded-xl" />
          <S className="w-full h-11 rounded-xl" />
          <S className="w-full h-11 rounded-xl" />

          {/* Submit button */}
          <S className="w-full h-11 rounded-xl" />

          {/* Divider row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/20" />
            <S className="w-6 h-4 rounded" />
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* OAuth button */}
          <S className="w-full h-10 rounded-xl" />

          {/* Footer text */}
          <S className="w-40 h-4 rounded-md mx-auto" />
        </div>
      </div>
    </div>
  );
};

export default AuthPageSkeleton;