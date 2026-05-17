const request = require("supertest");
const axios = require("axios");

let app;

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

  const server = require("../server");
  app = server.app;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/records - validation", () => {
  it("rejects request with missing summary", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ content: "test content" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("rejects request with missing content", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test summary" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects request with summary exceeding max length", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "a".repeat(501), content: "test" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects request with content exceeding max length", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test", content: "a".repeat(50001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects request with invalid contentType", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test", content: "data", contentType: "exe" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects request with too many tags", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test", content: "data", tags: Array(21).fill("tag") });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects request with too many labels", async () => {
    const labels = {};
    for (let i = 0; i < 51; i++) labels[`key${i}`] = `val${i}`;

    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test", content: "data", labels });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("accepts valid record with all fields", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({
        summary: "valid summary",
        content: "valid content",
        contentType: "json",
        fileName: "test.json",
        tags: ["finance", "q1"],
        labels: { owner: "alice", type: "report" },
      });

    expect(res.status).not.toBe(400);
  });

  it("accepts minimal valid record", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "min", content: "data" });

    expect(res.status).not.toBe(400);
  });

  it("defaults contentType to text when not provided", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "test", content: "data" });

    expect(res.status).not.toBe(400);
  });
});

describe("GET /api/records - query validation", () => {
  it("rejects invalid limit (non-numeric)", async () => {
    const res = await request(app).get("/api/records?limit=abc");

    expect(res.status).toBe(400);
  });

  it("rejects limit exceeding max", async () => {
    const res = await request(app).get("/api/records?limit=999");

    expect(res.status).toBe(400);
  });

  it("accepts valid limit", async () => {
    const res = await request(app).get("/api/records?limit=10");

    expect(res.status).not.toBe(400);
  });

  it("rejects search term exceeding max length", async () => {
    const res = await request(app).get(`/api/records?search=${"a".repeat(501)}`);

    expect(res.status).toBe(400);
  });
});
