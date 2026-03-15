import { useState, useEffect, useRef } from 'react';

export const useCountUp = ({ end, duration = 2000, startOnView = true, decimals = 0 }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);
  const hasAnimatedRef = useRef(false); // 🔒 Track if animation already ran

  useEffect(() => {
    // 🔒 Defined inside useEffect to avoid stale closure
    const animateCount = () => {
      const startTime = Date.now();

      const updateCount = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = end * easeOutQuart;
        setCount(Number(currentValue.toFixed(decimals)));

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        }
      };

      requestAnimationFrame(updateCount);
    };

    if (!startOnView) {
      animateCount();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 🔒 Only animate once when element first becomes visible
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          animateCount();
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [end, duration, startOnView, decimals]); // ✅ isVisible removed from deps

  return { count, ref: elementRef };
};