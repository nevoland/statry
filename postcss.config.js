import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import pseudoClasses from "postcss-pseudo-classes";

/** @type {import('postcss-load-config').Config} */
export default {
  plugins: [
    tailwindcss(),
    autoprefixer,
    process.env.NODE_ENV !== "production" &&
      pseudoClasses({
        restrictTo: [":hover", ":active", ":focus", ":focus-within"],
      }),
    process.env.NODE_ENV === "production" && cssnano,
  ].filter(Boolean),
};
