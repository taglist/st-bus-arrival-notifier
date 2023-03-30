module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['e2e\\.'],
  setupFilesAfterEnv: ['<rootDir>/test/config/setup.ts'],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '#/(.*)': '<rootDir>/test/$1',
  },
  resetMocks: true,
  verbose: true,
};
