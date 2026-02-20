/**
 * Local ESLint rules plugin
 *
 * Entry point for custom ESLint rules specific to this project.
 */

module.exports = {
  rules: {
    "no-async-state-init": require("./no-async-state-init"),
  },
};
