module.exports = {
  timeout: 40000,
  require: ['tests/setup.js'],
  spec: [
    'tests/unit/activityLog.model.test.js',
    'tests/unit/auditLog.model.test.js',
    'tests/unit/config.model.test.js',
    'tests/unit/fileHistory.model.test.js',
    'tests/unit/session.model.test.js',
    'tests/unit/user.model.test.js',
    'tests/unit/userMetadata.model.test.js',
    'tests/unit/passkey.model.test.js',
  ]
};