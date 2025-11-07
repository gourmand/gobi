/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
const { varWithFallback, THEME_COLORS } = require("./src/styles/theme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Note that these breakpoints are primarily optimized for the input toolbar
    screens: {
      "2xs": "170px", // Smallest width for Primary Sidebar in VS Code
      xs: "250px", // Avg default sidebar width in VS Code
      sm: "330px",
      int: "380px",
      md: "460px",
      lg: "590px",
      xl: "720px",
      "2xl": "860px",
      "3xl": "1000px",
      "4xl": "1180px",
    },
    extend: {
      animation: {
        "spin-slow": "spin 6s linear infinite",
      },
      borderRadius: {
        default: "0.5rem",
      },
      fontSize: {
        "2xs": "0.6875rem", // 11px
      },
      outlineOffset: {
        0.5: "0.5px",
      },
      colors: {
        background: varWithFallback("background"),
        foreground: varWithFallback("foreground"),
        editor: {
          DEFAULT: varWithFallback("editor-background"),
          foreground: varWithFallback("editor-foreground"),
        },
        primary: {
          DEFAULT: varWithFallback("primary-background"),
          foreground: varWithFallback("primary-foreground"),
          hover: varWithFallback("primary-hover"),
        },
        secondary: {
          DEFAULT: varWithFallback("secondary-background"),
          foreground: varWithFallback("secondary-foreground"),
          hover: varWithFallback("secondary-hover"),
        },
        border: {
          DEFAULT: varWithFallback("border"),
          focus: varWithFallback("border-focus"),
        },
        command: {
          DEFAULT: varWithFallback("command-background"),
          foreground: varWithFallback("command-foreground"),
          border: {
            DEFAULT: varWithFallback("command-border"),
            focus: varWithFallback("command-border-focus"),
          },
        },
        description: {
          DEFAULT: varWithFallback("description"),
          muted: varWithFallback("description-muted"),
        },
        input: {
          DEFAULT: varWithFallback("input-background"),
          foreground: varWithFallback("input-foreground"),
          border: varWithFallback("input-border"),
          placeholder: varWithFallback("input-placeholder"),
        },
        table: {
          oddRow: varWithFallback("table-oddRow"),
        },
        badge: {
          DEFAULT: varWithFallback("badge-background"),
          foreground: varWithFallback("badge-foreground"),
        },
        info: varWithFallback("info"),
        success: varWithFallback("success"),
        warning: varWithFallback("warning"),
        error: varWithFallback("error"),
        link: varWithFallback("link"),
        accent: varWithFallback("accent"),
        terminal: varWithFallback("terminal"),
        findMatch: {
          DEFAULT: THEME_COLORS["find-match"].default,
          selected: varWithFallback("find-match-selected"),
        },
        list: {
          hover: varWithFallback("list-hover"),
          active: {
            DEFAULT: varWithFallback("list-active"),
            foreground: varWithFallback("list-active-foreground"),
          },
        },

        // DEPRECATED, slowly remove usages of these ide-named or explicit colors
        lightgray: "#999998", // use border, description, or description-muted instead - AVOID
        "vsc-input-background": varWithFallback("input-background"), // use "input-background" instead
        "vsc-background": varWithFallback("background"), // use "background" instead
        "vsc-foreground": varWithFallback("editor-foreground"), // use "foreground" instead
        "vsc-editor-background": varWithFallback("editor-background"), // use "editor" instead
        "vsc-input-border": varWithFallback("input-border"), // use "input-border" instead
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
  // Some classes are generated dynamically or use Tailwind's arbitrary value
  // syntax (e.g. "max-h-[70vh]", "h-[16px]"). PostCSS/Tailwind's
  // content scanner can miss these in some build setups, so add a safelist
  // to ensure they are preserved in production builds. We include both
  // specific utility patterns and a conservative catch-all for other
  // bracketed utilities used in the GUI.
  safelist: [
    { pattern: /max-h-\[.*\]/ },
    { pattern: /max-w-\[.*\]/ },
    { pattern: /min-h-\[.*\]/ },
    { pattern: /min-w-\[.*\]/ },
    { pattern: /h-\[.*\]/ },
    { pattern: /w-\[.*\]/ },
    { pattern: /text-\[.*\]/ },
    { pattern: /top-\[.*\]/ },
    { pattern: /right-\[.*\]/ },
    { pattern: /left-\[.*\]/ },
    { pattern: /bottom-\[.*\]/ },
    { pattern: /pr-\[.*\]/ },
    { pattern: /pl-\[.*\]/ },
    { pattern: /pt-\[.*\]/ },
    { pattern: /pb-\[.*\]/ },
    { pattern: /mr-\[.*\]/ },
    { pattern: /ml-\[.*\]/ },
    { pattern: /z-\[.*\]/ },
    { pattern: /rounded-\[.*\]/ },
    { pattern: /border-\[.*\]/ },
    { pattern: /bg-\[.*\]/ },
    { pattern: /text-\[color:.*\]/ },
    // Conservative catch-all for any other utilities that use Tailwind's
    // arbitrary value/bracket syntax (e.g. `something-[value]`). This
    // prevents accidental removal of dynamically-generated classes.
    { pattern: /[a-z-]+-\[.*\]/ },
    // Preserve common plain numeric utilities (e.g. h-3, h-3.5, w-4, max-h-4/5)
    // and their responsive variants (e.g. xs:h-4). This keeps small icon and
    // layout sizing utilities from being purged in production builds.
    { pattern: /^(?:xs:|sm:|md:|lg:|xl:|2xl:|3xl:|4xl:)?[a-z-]+-(?:\d+(?:\.\d+)?|\d+\/\d+)$/ },
    // More targeted pattern for min-/max-/h-/w- variants (explicit).
    { pattern: /^(?:xs:|sm:|md:|lg:|xl:|2xl:|3xl:|4xl:)?(?:h|w|min-h|min-w|max-h|max-w)-(?:\d+(?:\.\d+)?|\d+\/\d+)$/ },
  ],
};
