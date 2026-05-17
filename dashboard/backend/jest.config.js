module.exports = {
  testEnvironment: "node",
  forceExit: true,
  moduleNameMapper: {
    "^.*/services/broadcast$": "<rootDir>/__mocks__/broadcast.js",
  },
};
