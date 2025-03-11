/**
 * Configuración de ESLint para el proyecto
 * Define reglas de estilo y buenas prácticas para el código
 */

module.exports = {
  "env": {
    "node": true,
    "es6": true,
    "mocha": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2018
  },
  "rules": {
    // Posibles errores
    "no-console": "off", // Permitir console.log para desarrollo
    "no-debugger": "error",
    "no-dupe-args": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": "error",
    "no-ex-assign": "error",
    "no-extra-boolean-cast": "error",
    "no-extra-semi": "error",
    "no-obj-calls": "error",
    "no-unreachable": "error",
    "valid-typeof": "error",
    
    // Mejores prácticas
    "curly": ["error", "all"],
    "default-case": "error",
    "dot-notation": "error",
    "eqeqeq": ["error", "always"],
    "no-caller": "error",
    "no-empty-function": "warn",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-multi-spaces": "error",
    "no-new-func": "error",
    "no-new-wrappers": "error",
    "no-param-reassign": "warn",
    "no-return-await": "error",
    "no-self-compare": "error",
    "no-useless-return": "error",
    "require-await": "warn",
    
    // Variables
    "no-shadow": "warn",
    "no-shadow-restricted-names": "error",
    "no-undef-init": "error",
    "no-use-before-define": ["error", { "functions": false }],
    
    // Node.js y CommonJS
    "global-require": "warn",
    "handle-callback-err": "error",
    "no-buffer-constructor": "error",
    "no-mixed-requires": "error",
    "no-new-require": "error",
    "no-path-concat": "error",
    
    // Estilo
    "array-bracket-spacing": ["error", "never"],
    "block-spacing": ["error", "always"],
    "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
    "comma-dangle": ["error", "never"],
    "comma-spacing": ["error", { "before": false, "after": true }],
    "comma-style": ["error", "last"],
    "computed-property-spacing": ["error", "never"],
    "func-call-spacing": ["error", "never"],
    "indent": ["error", 2, { "SwitchCase": 1 }],
    "key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
    "keyword-spacing": ["error", { "before": true, "after": true }],
    "linebreak-style": ["error", "unix"],
    "max-len": ["warn", { "code": 100, "ignoreComments": true, "ignoreUrls": true }],
    "new-cap": ["error", { "newIsCap": true, "capIsNew": false }],
    "no-array-constructor": "error",
    "no-lonely-if": "error",
    "no-multiple-empty-lines": ["error", { "max": 2, "maxEOF": 1 }],
    "no-trailing-spaces": "error",
    "no-unneeded-ternary": "error",
    "object-curly-spacing": ["error", "always"],
    "quotes": ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": true }],
    "semi": ["error", "always"],
    "semi-spacing": ["error", { "before": false, "after": true }],
    "space-before-blocks": ["error", "always"],
    "space-before-function-paren": ["error", { "anonymous": "always", "named": "never" }],
    "space-in-parens": ["error", "never"],
    "space-infix-ops": "error",
    
    // ES6
    "arrow-parens": ["error", "as-needed"],
    "arrow-spacing": ["error", { "before": true, "after": true }],
    "no-confusing-arrow": ["error", { "allowParens": true }],
    "no-duplicate-imports": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "object-shorthand": ["error", "always"],
    "prefer-arrow-callback": "error",
    "prefer-const": "error",
    "prefer-destructuring": ["warn", { "array": true, "object": true }],
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",
    "rest-spread-spacing": ["error", "never"],
    "template-curly-spacing": ["error", "never"]
  }
};
