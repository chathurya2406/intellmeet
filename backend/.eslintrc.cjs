module.exports = {
  env: {
    node: true,
    commonjs: true,
    jest: true,
    es2024: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "no-console": "off",
    "no-underscore-dangle": "off",
    "consistent-return": "off",
    // Allow unused variables/parameters that start with _ (intentionally unused)
    "no-unused-vars": ["error", {
      "vars": "all",
      "args": "after-used",
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "caughtErrorsIgnorePattern": "^_"
    }],
  },
};
