import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

const errorData = {
  404: { title: 'Page Not Found',        message: 'The page you are looking for does not exist.',             code: '404' },
  403: { title: 'Access Forbidden',      message: 'You do not have permission to access this page.',          code: '403' },
  500: { title: 'Internal Server Error', message: 'Something went wrong on our end. Please try again later.', code: '500' },
  503: { title: 'Under Maintenance',     message: 'We are down for maintenance. Please check back shortly.',  code: '503' },
};

export default function NotFound({ errorCode }) {
  const [error, setError] = useState(errorData[404]);
  const { code: routeCode } = useParams();
  const canvasRef = useRef(null);

  useEffect(() => {
    // Priority: prop > route param > default 404
    const raw = errorCode || routeCode;
    const parsed = parseInt(raw, 10);
    // unknown 5xx → map to 500, anything else → 404
    const normalized = errorData[parsed] ? parsed : parsed >= 500 ? 500 : 404;
    setError(errorData[normalized]);
  }, [errorCode, routeCode]);

  // Canvas starfield — same logic as the HTML version
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildStars();
    }
    function buildStars() {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 5000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.4 + 0.2,
          alpha: Math.random(),
          speed: Math.random() * 0.005 + 0.001,
          dir: Math.random() > 0.5 ? 1 : -1,
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.alpha += s.speed * s.dir;
        if (s.alpha >= 1 || s.alpha <= 0.1) s.dir *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(246,245,188,${s.alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (!error) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

        .nf-root {
          background-color: #0a1821;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: visible;
          font-family: 'Space Mono', monospace;
          color: #fff;
          box-sizing: border-box;
        }

        /* ── Canvas ── */
        .nf-canvas {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        /* moon glow removed */

        /* ── Sparkles ── */
        .nf-sparkle {
          position: fixed;
          pointer-events: none;
          z-index: 2;
          animation: nf-blink 7s linear infinite;
        }
        .nf-sp2 { animation-delay: -1.4s; }
        .nf-sp3 { animation-delay: -3.2s; }
        .nf-sp4 { animation-delay: -5.0s; }
        .nf-sp5 { animation-delay: -2.1s; }
        @keyframes nf-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.08; }
        }

        /* ── Fade-up entrance ── */
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ══════════════════════════════════════
           DESKTOP / TABLET-LANDSCAPE (> 768px)
           Moon LEFT  |  Content RIGHT
        ══════════════════════════════════════ */
        .nf-inner {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 60px;
          padding: 40px 60px;
          max-width: 1100px;
          width: 100%;
          animation: nf-fade-up 0.8s cubic-bezier(.22,.68,0,1.2) both;
        }

        /* Moon */
        .nf-moon-wrap {
          flex-shrink: 0;
          width: 300px;
          height: 300px;
          filter: drop-shadow(0 10px 40px rgba(180,190,200,0.18));
        }
        @keyframes nf-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-18px); }
        }

        /* Content block */
        .nf-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          overflow: visible;
        }

        /* Error code number */
        .nf-code-wrap {
          position: relative;
          display: inline-block;
          margin-bottom: 4px;
        }
        .nf-code {
          font-family: 'Syne', sans-serif;
          font-size: clamp(90px, 11vw, 160px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -4px;
          color: #fff;
          position: relative;
          z-index: 2;
          text-shadow: 0 0 80px rgba(255,255,255,0.12);
          display: block;
        }
        .nf-code-shadow {
          font-family: 'Syne', sans-serif;
          font-size: clamp(90px, 11vw, 160px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -4px;
          color: #3B3D3D;
          opacity: 0.45;
          position: absolute;
          top: 8px; left: 6px;
          z-index: 1;
          user-select: none;
          display: block;
        }

        /* Divider */
        .nf-divider {
          width: 60px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          margin: 20px 0;
        }

        /* Title */
        .nf-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 3vw, 38px);
          font-weight: 700;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
          color: #f0f4f8;
          line-height: 1.4;
          padding-bottom: 6px;
          overflow: visible;
          text-transform: uppercase;      
        }

        /* Message */
        .nf-message {
          font-family: 'Space Mono', monospace;
          font-size: clamp(12px, 1.3vw, 15px);
          font-weight: 400;
          color: rgba(255,255,255,0.6);
          line-height: 1.8;
          max-width: 380px;
          margin: 0 0 32px;
        }

        /* Button */
        .nf-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #2D6147 0%, #1a3d2d 100%);
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 14px;
          font-weight: 700;
          padding: 14px 32px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.25s;
          box-shadow: 0 4px 24px rgba(45,97,71,0.35);
          letter-spacing: 0.5px;
        }
        .nf-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(45,97,71,0.55);
          background: linear-gradient(135deg, #3E8562 0%, #2D6147 100%);
        }
        .nf-btn-outline {
          background: transparent;
          border: 2px solid rgba(255,255,255,0.25);
          box-shadow: none;
        }
        .nf-btn-outline:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.5);
          box-shadow: none;
        }

        /* ══════════════════════════════════════
           TABLET PORTRAIT (641px – 900px)
           Slightly smaller moon, tighter gap
        ══════════════════════════════════════ */
        @media (max-width: 900px) {
          .nf-inner {
            gap: 36px;
            padding: 40px 32px;
          }
          .nf-moon-wrap {
            width: 220px;
            height: 220px;
          }
        }

        /* ══════════════════════════════════════
           MOBILE (≤ 640px)
           Stack: moon TOP, content BOTTOM
           Everything centered
        ══════════════════════════════════════ */
        @media (max-width: 640px) {
          .nf-inner {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 32px 20px;
            gap: 8px;
          }
          .nf-moon-wrap {
            width: 160px;
            height: 160px;
          }
          .nf-content {
            align-items: center;
          }
          .nf-divider {
            margin: 14px auto;
          }
          .nf-message {
            text-align: center;
            max-width: 320px;
          }
          .nf-content > div {
            justify-content: center;
          }
        }
      `}</style>

      {/* Canvas starfield */}
      <canvas ref={canvasRef} className="nf-canvas" />

      {/* Moon glow removed */}

      {/* Sparkle stars */}
      <svg className="nf-sparkle"      style={{ top: '14%', left: '18%', width: 22 }} viewBox="0 0 20 20"><path fill="#F6F5BC" d="M10 0c-.3.3-.4.6-.4 1 0 .4.1.7.4 1C11.6 6.9 16.2 8.2 16.2 8.2c.3.3.4.6.4 1s-.1.7-.4 1C11.3 11.8 10 16.3 10 16.3c-.3.3-.6.4-1 .4s-.7-.1-1-.4C6.4 11.4 1.8 10 1.8 10c-.3-.3-.4-.6-.4-1s.1-.7.4-1C6.7 6.4 8 1.8 8 1.8c.3-.3.6-.4 1-.4s.7.1 1 .4C10 1.8 10 0 10 0z"/></svg>
      <svg className="nf-sparkle nf-sp2" style={{ top: '72%', left: '82%', width: 18 }} viewBox="0 0 20 20"><path fill="#F6F5BC" d="M10 0c-.3.3-.4.6-.4 1 0 .4.1.7.4 1C11.6 6.9 16.2 8.2 16.2 8.2c.3.3.4.6.4 1s-.1.7-.4 1C11.3 11.8 10 16.3 10 16.3c-.3.3-.6.4-1 .4s-.7-.1-1-.4C6.4 11.4 1.8 10 1.8 10c-.3-.3-.4-.6-.4-1s.1-.7.4-1C6.7 6.4 8 1.8 8 1.8c.3-.3.6-.4 1-.4s.7.1 1 .4C10 1.8 10 0 10 0z"/></svg>
      <svg className="nf-sparkle nf-sp3" style={{ top: '40%', left:  '8%', width: 14 }} viewBox="0 0 20 20"><path fill="#F6F5BC" d="M10 0c-.3.3-.4.6-.4 1 0 .4.1.7.4 1C11.6 6.9 16.2 8.2 16.2 8.2c.3.3.4.6.4 1s-.1.7-.4 1C11.3 11.8 10 16.3 10 16.3c-.3.3-.6.4-1 .4s-.7-.1-1-.4C6.4 11.4 1.8 10 1.8 10c-.3-.3-.4-.6-.4-1s.1-.7.4-1C6.7 6.4 8 1.8 8 1.8c.3-.3.6-.4 1-.4s.7.1 1 .4C10 1.8 10 0 10 0z"/></svg>
      <svg className="nf-sparkle nf-sp4" style={{ top: '85%', left: '35%', width: 16 }} viewBox="0 0 20 20"><path fill="#F6F5BC" d="M10 0c-.3.3-.4.6-.4 1 0 .4.1.7.4 1C11.6 6.9 16.2 8.2 16.2 8.2c.3.3.4.6.4 1s-.1.7-.4 1C11.3 11.8 10 16.3 10 16.3c-.3.3-.6.4-1 .4s-.7-.1-1-.4C6.4 11.4 1.8 10 1.8 10c-.3-.3-.4-.6-.4-1s.1-.7.4-1C6.7 6.4 8 1.8 8 1.8c.3-.3.6-.4 1-.4s.7.1 1 .4C10 1.8 10 0 10 0z"/></svg>
      <svg className="nf-sparkle nf-sp5" style={{ top: '20%', left: '90%', width: 20 }} viewBox="0 0 20 20"><path fill="#F6F5BC" d="M10 0c-.3.3-.4.6-.4 1 0 .4.1.7.4 1C11.6 6.9 16.2 8.2 16.2 8.2c.3.3.4.6.4 1s-.1.7-.4 1C11.3 11.8 10 16.3 10 16.3c-.3.3-.6.4-1 .4s-.7-.1-1-.4C6.4 11.4 1.8 10 1.8 10c-.3-.3-.4-.6-.4-1s.1-.7.4-1C6.7 6.4 8 1.8 8 1.8c.3-.3.6-.4 1-.4s.7.1 1 .4C10 1.8 10 0 10 0z"/></svg>

      <div className="nf-root">
        <div className="nf-inner">

          {/* ── LEFT: Moon ── */}
          <div className="nf-moon-wrap">
            <svg viewBox="60 262 310 360" width="100%" height="100%" overflow="visible" xmlns="http://www.w3.org/2000/svg">
              <path opacity=".5" fill="#3B3D3D" d="M122.7 373.9L-237.1 744l283.8 269.4 279.9-492.8z"/>
              <g fill="#D1D5D6">
                <path d="M209 340.6c-70.9 0-128.4 57.5-128.4 128.4S138.1 597.4 209 597.4 337.4 539.9 337.4 469 279.9 340.6 209 340.6zm-41.9 176.1c0 10.9-8.9 19.8-19.8 19.8s-19.8-8.9-19.8-19.8c0-1.4.1-2.7.4-4-18.3-1.7-32.6-17-32.6-35.7 0-19.8 16.1-35.9 35.9-35.9 19.8 0 35.9 16.1 35.9 35.9 0 8.9-3.3 17.1-8.6 23.3 5.1 3.7 8.6 9.7 8.6 16.4zm20.2 3.9c0-8.8 7.1-16 16-16 8.8 0 16 7.1 16 16 0 8.8-7.1 16-16 16-8.9-.1-16-7.2-16-16zm5.8-43.5c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.8-24-24zm72.7 86.4c-4.2 0-8.2-.7-11.9-2-.5 12.8-11 23.1-24 23.1-13.3 0-24-10.7-24-24s10.7-24 24-24h1.1c-.7-2.9-1.1-5.8-1.1-8.9 0-19.8 16.1-35.9 35.9-35.9 19.8 0 35.9 16.1 35.9 35.9s-16.1 35.8-35.9 35.8zm10.9-91.1c0 2.6-2.1 4.6-4.6 4.6-2.6 0-4.6-2.1-4.6-4.6 0-2.6 2.1-4.6 4.6-4.6 2.5 0 4.6 2.1 4.6 4.6z"/>
              </g>
              <g fill="#FFF">
                <circle cx="217.1" cy="477.1" r="24"/>
                <path d="M265.8 491.7c-19.8 0-35.9 16.1-35.9 35.9 0 3.1.4 6.1 1.1 8.9h-1.1c-13.3 0-24 10.7-24 24s10.7 24 24 24c12.9 0 23.5-10.2 24-23.1 3.7 1.3 7.7 2 11.9 2 19.8 0 35.9-16.1 35.9-35.9s-16.1-35.8-35.9-35.8zM131.2 441.2c-19.8 0-35.9 16.1-35.9 35.9 0 18.7 14.3 34.1 32.6 35.7-.3 1.3-.4 2.6-.4 4 0 10.9 8.9 19.8 19.8 19.8s19.8-8.9 19.8-19.8c0-6.8-3.4-12.8-8.6-16.3 5.4-6.3 8.6-14.4 8.6-23.3 0-20-16.1-36-35.9-36z"/>
                <path d="M331 467.9c0-66.3-53.8-120.1-120.1-120.1-54.9 0-101.3 36.9-115.6 87.2 11.8-14.1 26.9-25.4 43.9-32.8.6-11.7 10.2-21 22.1-21 8.2 0 15.4 4.5 19.2 11.2 2.2-.1 4.3-.2 6.5-.2-1.6 2.4-2.9 5.1-3.8 7.9-1 3-1.5 6.3-1.5 9.6 0 .7 0 1.3.1 2 1 16.5 14.7 29.5 31.4 29.5 17.4 0 31.5-14.1 31.5-31.5 0-1-.1-2.1-.2-3.1 5.5 3 10.7 6.4 15.7 10.2 3.1-1.3 6.6-2 10.2-2 14.6 0 26.4 11.8 26.4 26.4 0 5-1.4 9.8-3.9 13.8 1.9 3.4 3.6 6.9 5.1 10.5-.5-.1-1.1-.1-1.6-.1-6.5 0-11.7 5.2-11.7 11.7 0 6.5 5.2 11.7 11.7 11.7 3.1 0 6-1.2 8.1-3.2 2 8.6 3 17.6 3 26.8 0 11.4-1.6 22.5-4.6 32.9 17.5-21 28.1-48 28.1-77.4z"/>
                <circle cx="203.2" cy="520.6" r="16"/>
                <circle cx="272.1" cy="472.4" r="4.6"/>
              </g>
              <path fill="#acacac" stroke="#B5B5B6" strokeMiterlimit="10" d="M200.8 369.5c-.2.6-.8 1-1.4.8l-.9-.2c-.6-.2-1-.8-.8-1.4l25.5-89.5c.2-.6.8-1 1.4-.8l.9.2c.6.2 1 .8.8 1.4l-25.5 89.5z"/>
              <path fillRule="evenodd" clipRule="evenodd" fill="#263563" stroke="#B5B5B6" strokeMiterlimit="10" d="M262.9 334c-.1.5-.7.8-1.2.7l-46.4-13.2c-.5-.1-.8-.7-.7-1.2l10.8-38c.1-.5.7-.8 1.2-.7l46.4 13.2c.5.1.8.7.7 1.2l-10.8 38z"/>
            </svg>
          </div>

          {/* ── RIGHT: Content ── */}
          <div className="nf-content">

            {/* Big error number with shadow */}
            <div className="nf-code-wrap">
              <span className="nf-code-shadow">{error.code}</span>
              <span className="nf-code">{error.code}</span>
            </div>

            <div className="nf-divider" />

            <h1 className="nf-title">{error.title}</h1>
            <p className="nf-message">{error.message}</p>
          </div>
        </div>
      </div>
    </>
  );
}