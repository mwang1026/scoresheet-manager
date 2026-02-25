import nextConfig from "eslint-config-next";
import prettier from "eslint-config-prettier";

export default [
  ...nextConfig,
  prettier,
  {
    // Downgrade new React 19 lint rules to warnings for now.
    // These flag pre-existing patterns that should be addressed separately.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];
