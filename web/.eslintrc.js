module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["solid", "prettier"],
    extends: [
      "eslint:recommended",
      "plugin:solid/typescript",
      "plugin:prettier/recommended", // включает prettier + показывает ошибки как eslint
    ],
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      // Пример дополнительных правил
      "prettier/prettier": "error", // 💥 ошибки форматирования
      "no-unused-vars": "warn",
      "no-console": "warn",
      "no-multiple-empty-lines": ["error", { "max": 1}],
    },
  };