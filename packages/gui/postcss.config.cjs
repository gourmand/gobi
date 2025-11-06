module.exports = {
  plugins: [
    // Use the official PostCSS plugin wrapper for Tailwind v4+.
    // This package provides the proper PostCSS integration.
    require("@tailwindcss/postcss"),
    require("autoprefixer"),
  ],
};
