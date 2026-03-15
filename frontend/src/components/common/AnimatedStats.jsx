import React from 'react';
import { Users, FileText, Clock, Shield } from 'lucide-react'; // Removed Shield
import { useCountUp } from '@/hooks/useCountUp';

// --- StatCard component is now defined directly in this file ---
// Notice there is no 'export' keyword here. It's a local component.
const StatCard = ({
  value,
  suffix = '',
  label,
  description,
  decimals = 0,
  delay = 0,
  icon
}) => {
  const { count, ref } = useCountUp({ 
    end: value, 
    duration: 2000 + delay, 
    decimals,
    startOnView: true 
  });

  return (
    <div 
      ref={ref}
      className="text-center group transform transition-all duration-500 hover:scale-105"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/20 group-hover:bg-gray-200 dark:group-hover:bg-white/20 transition-all duration-300">
        <div className="text-gray-900 dark:text-white text-2xl">
          {icon}
        </div>
      </div>
      <div className="mb-3">
        <span className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
          {decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}
        </span>
        <span className="text-4xl lg:text-5xl font-bold text-gray-800 dark:text-white/90">
          {suffix}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {label}
      </h3>
      <p className="text-gray-600 dark:text-blue-100 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
};


// --- The main AnimatedStats component that is exported ---
export const AnimatedStats = () => {
  const stats = [
    { value: 10, suffix: 'M+', label: 'Happy Users', description: 'Trusted by millions worldwide', icon: <Users size={32} />, delay: 0 },
    { value: 500, suffix: 'M+', label: 'Files Converted', description: 'Processed with precision', icon: <FileText size={32} />, delay: 200 },
    { value: 99.9, suffix: '%', label: 'Uptime', description: 'Always available when you need', decimals: 1, icon: <Clock size={32} />, delay: 400 },
    {value: 256, suffix: '-bit',label: 'SSL Encryption',description: 'Enterprise-grade security',icon: <Shield size={32} />,delay: 600}
    // SSL stat has been removed from the array
  ];

  return (
    <section className="relative py-16 lg:py-20 overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Trusted by{' '}
            <span className="relative">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Millions
              </span>
              <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 200 12" fill="none">
                <path d="M2 10C50 2 150 2 198 10" stroke="url(#testimonial_gradient)" strokeWidth="3" strokeLinecap="round" />
                <defs>
                  <linearGradient id="testimonial_gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-blue-100 max-w-2xl mx-auto">
            Join the community of users who rely on FileTools for their daily conversion needs
          </p>
        </div>
        
        {/* We now have 3 columns instead of 4 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <StatCard
              key={index}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              description={stat.description}
              decimals={stat.decimals}
              delay={stat.delay}
              icon={stat.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
};