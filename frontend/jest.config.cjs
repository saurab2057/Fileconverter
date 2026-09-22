module.exports = {
  testEnvironment: 'jsdom',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  moduleNameMapper: {
    // Allows @/ imports to resolve to the src directory.
    '^@/(.*)$': '<rootDir>/src/$1',

    // Use the controlled Axios mock during Jest tests.
    '^axios$': '<rootDir>/tests/__mocks__/axios.js',

    // Mock CSS imports so Jest does not try to process stylesheets.
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    // The project keeps test mocks inside tests/__mocks__.
    '\\.(gif|ttf|eot|svg|png)$':
      '<rootDir>/tests/__mocks__/fileMock.js',
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(react-router|react-router-dom)/)',
  ],

  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.jsx',
  ],
};