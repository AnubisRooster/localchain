// ─────────────────────────────────────────────
// Unit + Integration tests: /api/records
// Tag & label filtering logic
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");

let app, cosmosInstance, tendermintInstance;

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
  cosmosInstance = axiosMod.__cosmosMock;
  tendermintInstance = axiosMod.__tendermintMock;

  const server = require("../server");
  app = server.app;
});

afterEach(() => {
  jest.clearAllMocks();
});

const SAMPLE_RECORDS = {
  tx_responses: [
    { txhash: "1", height: "100", timestamp: "2024-01-01T00:00:00Z", code: 0 },
    { txhash: "2", height: "101", timestamp: "2024-01-01T00:01:00Z", code: 0 },
    { txhash: "3", height: "102", timestamp: "2024-01-01T00:02:00Z", code: 0 },
  ],
  txs: [
    { body: { messages: [{ creator: "alice", data: JSON.stringify({ summary: "payment", content: "payment", tags: ["finance", "q1"], labels: { owner: "alice" } }) }] } },
    { body: { messages: [{ creator: "bob", data: JSON.stringify({ summary: "invoice", content: "invoice", tags: ["finance"], labels: { owner: "bob" } }) }] } },
    { body: { messages: [{ creator: "alice", data: JSON.stringify({ summary: "log", content: "log-entry", tags: ["system"], labels: { owner: "alice", type: "debug" } }) }] } },
  ],
};

describe("GET /api/records", () => {
  it("returns all records when no filters applied", async () => {
    cosmosInstance.get.mockResolvedValue({
      data: SAMPLE_RECORDS,
    });

    const res = await request(app).get("/api/records");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it("filters by tag", async () => {
    cosmosInstance.get.mockResolvedValue({
      data: SAMPLE_RECORDS,
    });

    const res = await request(app).get("/api/records?tag=finance");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records.every((r) => r.tags.includes("finance"))).toBe(true);
  });

  it("filters by tag with no matches", async () => {
    cosmosInstance.get.mockResolvedValue({
      data: SAMPLE_RECORDS,
    });

    const res = await request(app).get("/api/records?tag=nonexistent");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("filters by label key=value", async () => {
    cosmosInstance.get.mockResolvedValue({
      data: SAMPLE_RECORDS,
    });

    const res = await request(app).get("/api/records?label.owner=alice");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records.every((r) => r.labels.owner === "alice")).toBe(true);
  });

  it("combines tag + label filters", async () => {
    cosmosInstance.get.mockResolvedValue({
      data: SAMPLE_RECORDS,
    });

    const res = await request(app).get("/api/records?tag=finance&label.owner=alice");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].txHash).toBe("1");
  });

  it("returns empty array when Cosmos endpoint fails", async () => {
    cosmosInstance.get.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/records");

    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.note).toBeTruthy();
  });
});
