module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    // These are needed for some of the typescript-eslint type-based linting rules
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: [
    "@typescript-eslint",
    "prettier",
    "simple-import-sort",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "prettier/prettier": 2,

    // Mostly copied from Lune backend's eslintrc
    "comma-dangle": ["error", "always-multiline"],
    "func-style": ["error", "declaration"],
    "space-before-function-paren": ["error", {
      "anonymous": "never",
      "named": "never",
      "asyncArrow": "always"
    }],
    "no-useless-constructor": "off",
    "no-unused-vars": "off",
    "no-extra-semi": "off",
    "no-trailing-spaces": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-useless-constructor": ["error"],
    "@typescript-eslint/no-unnecessary-type-assertion": ["error"],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/no-unnecessary-condition": ["error"],
    "@typescript-eslint/switch-exhaustiveness-check": ["error"],
    "simple-import-sort/imports": [
      "error",
      {
        // Following https://github.com/lydell/eslint-plugin-simple-import-sort/blob/31dc8854127a801e1cc6f1516c23854ea11b311f/examples/.eslintrc.js#L74=
        groups: [
          // Node.js builtins.
          [`^(${require("module").builtinModules.join("|")})(/|$)`],
          // Third party packages.
          ["^@?\\w"],
          // Parent imports. Put `..` last.
          ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
          // Other relative imports. Put same-folder imports and `.` last.
          ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
          // Side effect imports.
          ["^\\u0000"],
        ],
      },
    ],
    // To support TS overloads
    // https://github.com/typescript-eslint/typescript-eslint/blob/6fd476c32c4757cb9f4c442f0cd92875671eed30/packages/eslint-plugin/docs/rules/no-redeclare.md
    "no-redeclare": "off",
    "@typescript-eslint/no-redeclare": ["error"],
  }
}
