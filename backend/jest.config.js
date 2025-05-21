/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/__tests__/**/*.test.ts'], // Adjust if your tests are elsewhere
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  verbose: true,
  forceExit: true, // Exit Jest after tests complete
  // Setup files to load dotenv before tests
  setupFiles: ["dotenv/config"]
};