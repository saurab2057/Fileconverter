module.exports = {
  timeout: 40000,
  require: ['tests/setup.js'],
  spec: [
    'tests/integration/admin.test.js',
    'tests/integration/auth.test.js',
    'tests/integration/conversion.test.js',
    'tests/integration/history.test.js',
    'tests/integration/user.test.js',
    'tests/integration/session.test.js',
    'tests/integration/password.test.js',
    'tests/integration/chatbot.test.js',
    'tests/integration/summarizer.test.js',
    'tests/integration/compression.test.js',
    'tests/integration/passkey.test.js',
  ]
};