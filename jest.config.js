/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tests/tsconfig.json'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node']
};
