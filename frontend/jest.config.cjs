module.exports = {
  testEnvironment: 'jsdom',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',

    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    '\\.(gif|ttf|eot|svg|png)$':
      '<rootDir>/__mocks__/fileMock.js',
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(react-router|react-router-dom)/)',
  ],

  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.jsx',
  ],
};