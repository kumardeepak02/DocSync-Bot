/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.base.json" }]
  },
  roots: ["<rootDir>/packages"],
  testMatch: ["**/test/**/*.test.ts"],
  moduleNameMapper: {
    "^docsync-core$": "<rootDir>/packages/docsync-core/src/index.ts",
    "^docsync-core/(.*)$": "<rootDir>/packages/docsync-core/src/$1"
  },
  collectCoverageFrom: [
    "packages/*/src/**/*.ts",
    "!packages/docsync-vscode-extension/src/**",
    "!packages/docsync-cli/src/index.ts"
  ]
};
