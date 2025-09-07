/* eslint-disable import/no-anonymous-default-export */
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use compat to pull in Next's legacy shareable configs
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Next.js + TS presets
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Global ignores (flat config replaces .eslintignore)
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",

      // 🔇 generated code — do not lint
      "lib/generated/**",
      "prisma/**",
    ],
  },

  // (Optional) TS parser options if you want type-aware rules
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
  },

  // Belt-and-suspenders: if anything in generated dirs slips through, disable noisy rules
  {
    files: ["lib/generated/**/*.{js,ts,tsx}", "prisma/**/*.{js,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];


export default eslintConfig;
