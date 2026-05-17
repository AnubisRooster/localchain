module.exports = {
  broadcastRecord: jest.fn().mockResolvedValue({ txhash: "mock-tx", height: 100, code: 0, raw_log: "" }),
  resetClient: jest.fn(),
  getSignerAddress: jest.fn(() => "cosmos1mock"),
  initClient: jest.fn().mockResolvedValue({}),
  MSG_TYPE_URL: "/localchain.records.v1.MsgCreateRecord",
};
