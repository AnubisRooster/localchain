// ─────────────────────────────────────────────
// Unit + Integration tests: Block endpoints
// ─────────────────────────────────────────────
const request = require("supertest");

let app, tendermintInstance;

beforeAll(() => {
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
  tendermintInstance = axiosMod.__tendermintMock;

  const server = require("../server");
  app = server.app;
});

afterEach(() => jest.clearAllMocks());

describe("GET /api/block/:height", () => {
  it("returns block details for a valid height", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          block: {
            header: {
              height: "10",
              chain_id: "localchain",
              time: "2025-01-01T00:00:00Z",
              proposer_address: "DEADBEEF",
              last_block_id: { hash: "AABB" },
            },
            data: { txs: ["tx1", "tx2"] },
          },
        },
      },
    });

    const res = await request(app).get("/api/block/10");

    expect(res.status).toBe(200);
    expect(res.body.height).toBe("10");
    expect(res.body.chainId).toBe("localchain");
    expect(res.body.txCount).toBe(2);
    expect(res.body.txs).toEqual(["tx1", "tx2"]);
    expect(res.body.proposer).toBe("DEADBEEF");
  });

  it("returns 502 when Tendermint is down", async () => {
    tendermintInstance.get.mockRejectedValue(new Error("timeout"));

    const res = await request(app).get("/api/block/999");

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("timeout");
  });
});

describe("GET /api/blocks/latest", () => {
  it("returns latest block and recent block list", async () => {
    tendermintInstance.get.mockImplementation((url) => {
      if (url === "/block") {
        return Promise.resolve({
          data: {
            result: {
              block: {
                header: {
                  height: "100",
                  time: "2025-06-01T12:00:00Z",
                  proposer_address: "PROP1",
                },
                data: { txs: [] },
              },
            },
          },
        });
      }
      if (url.startsWith("/blockchain")) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                {
                  header: { height: "100", time: "2025-06-01T12:00:00Z" },
                  num_txs: "0",
                  block_id: { hash: "HASH100" },
                },
                {
                  header: { height: "99", time: "2025-06-01T11:59:55Z" },
                  num_txs: "2",
                  block_id: { hash: "HASH99" },
                },
              ],
            },
          },
        });
      }
      return Promise.reject(new Error("unexpected url"));
    });

    const res = await request(app).get("/api/blocks/latest");

    expect(res.status).toBe(200);
    expect(res.body.latest.height).toBe("100");
    expect(res.body.recent).toHaveLength(2);
    expect(res.body.recent[0].hash).toBe("HASH100");
  });
});
