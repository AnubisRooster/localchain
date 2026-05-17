const request = require("supertest");
const axios = require("axios");

jest.mock("axios", () => {
  const create = jest.fn(() => ({
    get: jest.fn(),
  }));
  return { create };
});

let app, cosmosInstance, tendermintInstance;

beforeAll(() => {
  const mockGet = jest.fn();
  axios.create.mockReturnValue({ get: mockGet });

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

describe("GET /api/metrics (Prometheus format)", () => {
  it("returns text/plain content type", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("returns Prometheus metric headers", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics");
    expect(res.text).toContain("# HELP");
    expect(res.text).toContain("# TYPE");
  });

  it("includes core metrics", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics");
    expect(res.text).toContain("localchain_api_requests_total");
    expect(res.text).toContain("localchain_api_errors_total");
    expect(res.text).toContain("localchain_block_height");
    expect(res.text).toContain("localchain_system_mem_used_percent");
    expect(res.text).toContain("localchain_info");
  });

  it("includes histogram metrics with buckets", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics");
    expect(res.text).toContain("localchain_request_duration_seconds_bucket");
    expect(res.text).toContain("localchain_request_duration_seconds_sum");
    expect(res.text).toContain("localchain_request_duration_seconds_count");
  });

  it("increments request counter on each call", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    await request(app).get("/api/metrics");
    await request(app).get("/api/metrics");
    const res = await request(app).get("/api/metrics");

    const match = res.text.match(/localchain_api_requests_total (\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(3);
  });
});

describe("GET /api/metrics/summary (JSON)", () => {
  it("returns JSON summary", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics/summary");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("includes all summary sections", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics/summary");
    expect(res.body).toHaveProperty("requests");
    expect(res.body).toHaveProperty("latency");
    expect(res.body).toHaveProperty("chain");
    expect(res.body).toHaveProperty("nodes");
    expect(res.body).toHaveProperty("tenants");
    expect(res.body).toHaveProperty("system");
    expect(res.body).toHaveProperty("transactions");
    expect(res.body).toHaveProperty("topPaths");
  });

  it("includes latency percentiles", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/api/metrics/summary");
    expect(res.body.latency).toHaveProperty("p50_ms");
    expect(res.body.latency).toHaveProperty("p95_ms");
    expect(res.body.latency).toHaveProperty("p99_ms");
  });

  it("includes request counts", async () => {
    tendermintInstance.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc123" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    await request(app).get("/health");
    const res = await request(app).get("/api/metrics/summary");
    expect(res.body.requests.total).toBeGreaterThanOrEqual(1);
  });
});
