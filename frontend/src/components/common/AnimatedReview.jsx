import React from 'react';
// Added Zap to the import list for the new icon
import { Star, Quote, Zap } from 'lucide-react'; 
import { useIntersectionObserver } from '@/hooks/useInteractionObserver';

export const AnimatedTestimonials = ({ testimonials }) => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section ref={ref} className="py-20 bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors duration-300 ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-20 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          {/* Main Heading with new animation and colors */}
          <div className="relative">
            <h2 className="text-6xl md:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 leading-none">
              <span className={`block transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`} style={{ transitionDelay: '400ms' }}>
                LOVED BY
              </span>
              
              {/* GRADIENT CHANGED HERE to a "black-green" theme */}
              <span className={`block bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 bg-clip-text text-transparent transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`} style={{ transitionDelay: '600ms' }}>
                THOUSANDS
              </span>
            </h2>
          </div>

          {/* New Paragraph style with updated text */}
          <p className={`text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '700ms' }}>
            Join the community of professionals who've transformed their workflow with our cutting-edge platform
          </p>
        </div>

        {/* Testimonials grid with staggered animations (No changes needed below) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 hover:shadow-xl hover:-translate-y-2 hover:scale-105 transition-all duration-500 transform ${isVisible
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-12 scale-95'
                }`}
              style={{
                transitionDelay: isVisible ? `${index * 200}ms` : '0ms'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-sm"></div>
              <div className="absolute inset-[1px] bg-white dark:bg-gray-800 rounded-2xl -z-10"></div>
              
              <div className="flex items-center space-x-1 mb-6">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 text-yellow-400 fill-current transition-all duration-300 hover:scale-110 ${isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
                      }`}
                    style={{
                      transitionDelay: isVisible ? `${(index * 200) + (i * 100)}ms` : '0ms'
                    }}
                  />
                ))}
              </div>

              <blockquote className="text-gray-700 dark:text-gray-300 mb-6 text-lg leading-relaxed relative transition-colors duration-300">
                <p className="relative z-10 italic font-medium">{testimonial.content}</p>
              </blockquote>

              <div className={`flex items-center space-x-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}
                style={{ transitionDelay: `${(index * 200) + 300}ms` }}>
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 dark:from-green-500 dark:to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-lg transition-colors duration-300">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-lg transition-colors duration-300">{testimonial.name}</div>
                  <div className="text-green-600 dark:text-green-400 font-medium transition-colors duration-300">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};