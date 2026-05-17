// ─────────────────────────────────────────────
// Unit + Integration tests: /health endpoint
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");

jest.mock("axios", () => {
  const create = jest.fn(() => ({
    get: jest.fn(),
  }));
  return { create };
});

// Re-require after mock is set up
let app, cosmosInstance, tendermintInstance;

beforeAll(() => {
  // axios.create is called twice in server.js: once for cosmos, once for tendermint
  const mockGet = jest.fn();
  axios.create.mockReturnValue({ get: mockGet });

  // Clear cache to force re-require with mocks
  jest.resetModules();
  jest.mock("axios", () => {
    const cosmosMock = { get: jest.fn() };
    const tendermintMock = { get: jest.fn() };
    let callCount = 0;
    return {
      create: jest.fn(() => {
        callCount++;
        return callCount === 1 ? cosmosMock : tendermintMock;
      }),
      get: jest.fn(),
      __cosmosMock: cosmosMock,
      __tendermintMock: tendermintMock,
    };
  });

  const axiosMod = require("axios");
  cosmosInstance = axiosMod.__cosmosMock;
  tendermintInstance = axiosMod.__tendermintMock;

  const server = require("../server");
  app = server.app;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("GET /health", () => {
  it("returns healthy status when Tendermint RPC responds", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: {
            latest_block_height: "42",
            catching_up: false,
          },
        },
      },
    });

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.chainId).toBe("localchain");
    expect(res.body.blockHeight).toBe(42);
    expect(res.body.catching_up).toBe(false);
    expect(typeof res.body.latency).toBe("number");
  });

  it("returns 503 when Tendermint RPC is unreachable", async () => {
    tendermintInstance.get.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("ECONNREFUSED");
  });
});
