// ─────────────────────────────────────────────
// Unit tests: Validators + System + Metrics
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

describe("GET /api/validators", () => {
  it("returns validator list", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          block_height: "50",
          validators: [
            { address: "VAL1", pub_key: { type: "ed25519", value: "pk1" }, voting_power: "1000" },
            { address: "VAL2", pub_key: { type: "ed25519", value: "pk2" }, voting_power: "500" },
          ],
        },
      },
    });

    const res = await request(app).get("/api/validators");

    expect(res.status).toBe(200);
    expect(res.body.blockHeight).toBe("50");
    expect(res.body.validators).toHaveLength(2);
    expect(res.body.validators[0].address).toBe("VAL1");
    expect(res.body.validators[0].votingPower).toBe("1000");
  });

  it("returns 502 on failure", async () => {
    tendermintInstance.get.mockRejectedValue(new Error("fail"));

    const res = await request(app).get("/api/validators");
    expect(res.status).toBe(502);
  });
});

describe("GET /api/system", () => {
  it("returns system metrics", async () => {
    const res = await request(app).get("/api/system");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hostname");
    expect(res.body).toHaveProperty("platform");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("cpuCount");
    expect(res.body).toHaveProperty("memTotal");
    expect(res.body).toHaveProperty("memFree");
    expect(res.body).toHaveProperty("memUsedPercent");
    expect(parseFloat(res.body.memUsedPercent)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(res.body.memUsedPercent)).toBeLessThanOrEqual(100);
  });
});

describe("GET /api/metrics", () => {
  it("returns Prometheus-formatted text metrics", async () => {
    const res = await request(app).get("/api/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("localchain_api_requests_total");
    expect(res.text).toContain("localchain_api_errors_total");
    expect(res.text).toContain("localchain_last_block_height");
    expect(res.text).toContain("localchain_system_mem_used_percent");
  });
});
