import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm', // ESM preset
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true, // import/export support
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {},
};

export default config;