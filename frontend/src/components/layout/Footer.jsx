import React from 'react';

// ── Social Icons (SVG inline with native official branding) ───
const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path 
      fill="#1877F2" 
      d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
    />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path 
      fill="#000000" 
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="ig-gradient" cx="20%" cy="90%" r="120%">
        <stop offset="0%" stopColor="#FED373" />
        <stop offset="25%" stopColor="#F15245" />
        <stop offset="60%" stopColor="#D92E7F" />
        <stop offset="100%" stopColor="#9B36B7" />
      </radialGradient>
    </defs>
    <path 
      fill="url(#ig-gradient)" 
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
    />
  </svg>
);

const YoutubeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path 
      fill="#FF0000" 
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  </svg>
);

// ── Data ─────────────────────────────────────────────────────────
const footerColumns = [
  {
    heading: "Video Converter",
    links: ["MP4 Converter", "MOV to MP4", "Video to GIF", "Video to MP3", "MP4 to MP3", "Video Converter"],
  },
  {
    heading: "Audio Converter",
    links: ["MP3 Converter", "WAV to MP3", "AAC Converter", "FLAC to MP3", "OGG to MP3", "Audio Converter"],
  },
  {
    heading: "Image Converter",
    links: ["Image Converter", "JPG to PNG", "PNG to WebP", "JPG to PDF", "Image to PDF", "WebP Converter"],
  },
  {
    heading: "Document Converter",
    links: ["PDF to Word", "Word to PDF", "PDF to JPG", "PDF Converter", "Merge PDF", "Compress PDF"],
  },
];

// Clean configuration without loose string colors
const socialLinks = [
  { icon: <FacebookIcon />,  label: "Facebook",  href: "#" },
  { icon: <XIcon />,         label: "X",         href: "#" },
  { icon: <InstagramIcon />, label: "Instagram", href: "#" },
  { icon: <YoutubeIcon />,   label: "YouTube",   href: "#" },
];

const legalLinks = ["About Us", "Donate", "Privacy", "Terms", "Security & Compliance", "Contact", "Status"];

// ── Component ────────────────────────────────────────────────────
const Footer = () => {
  return (
    <div className="flex flex-col">

      {/* ── SECTION 1: Gradient green — 4 link columns ─────────── */}
      <div className="bg-[#165246]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {footerColumns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-wide text-white">
                  {col.heading}
                </h3>
                {col.links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm text-green-100 hover:text-gray-300 transition-colors duration-200"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Dark green footer ──────────────────────── */}
      <footer className="bg-[#165246] text-white py-8 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">

          {/* Legal links */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-6">
            {legalLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-gray-300 hover:text-white transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </div>

          <hr className="border-gray-400/50 mb-6" />

          {/* Social icons + copyright */}
          <div className="flex flex-col items-center gap-6">

            {/* Social icons rendering with native vector colors */}
            <div className="flex gap-6 text-xl">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="hover:opacity-80 transition-opacity duration-200"
                >
                  {s.icon}
                </a>
              ))}
            </div>

            {/* Copyright */}
            <p className="text-sm text-gray-300">
              FileTools © FileTools.com · All rights reserved 2026
            </p>

          </div>
        </div>
      </footer>

    </div>
  );
};

export default Footer;
