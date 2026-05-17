// ─────────────────────────────────────────────
// Unit tests: Shared configuration
// ─────────────────────────────────────────────

describe("Shared config", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads default values when no env vars set", () => {
    delete process.env.CHAIN_ID;
    delete process.env.API_PORT;
    delete process.env.COSMOS_REST;

    const config = require("../../shared/config");

    expect(config.chainId).toBe("localchain");
    expect(config.apiPort).toBe(4000);
    expect(config.cosmosRest).toBe("http://localhost:1317");
    expect(config.tendermintRpc).toBe("http://localhost:26657");
    expect(config.frontendPort).toBe(3000);
    expect(config.prometheusPort).toBe(9090);
    expect(config.grafanaPort).toBe(3001);
    expect(config.watchdogInterval).toBe(5000);
    expect(config.maxCpuPercent).toBe(80);
    expect(config.maxMemPercent).toBe(80);
    expect(config.staleBlockMinutes).toBe(5);
  });

  it("respects environment variable overrides", () => {
    process.env.CHAIN_ID = "testchain";
    process.env.API_PORT = "9999";
    process.env.COSMOS_REST = "http://mynode:1317";
    process.env.MAX_CPU = "95";
    process.env.KNOWN_NODES = "10.0.0.1,10.0.0.2,10.0.0.3";

    const config = require("../../shared/config");

    expect(config.chainId).toBe("testchain");
    expect(config.apiPort).toBe(9999);
    expect(config.cosmosRest).toBe("http://mynode:1317");
    expect(config.maxCpuPercent).toBe(95);
    expect(config.knownNodes).toEqual(["10.0.0.1", "10.0.0.2", "10.0.0.3"]);
  });

  it("handles empty KNOWN_NODES gracefully", () => {
    process.env.KNOWN_NODES = "";

    const config = require("../../shared/config");

    expect(config.knownNodes).toEqual([]);
  });

  it("parses numeric env vars correctly", () => {
    process.env.API_PORT = "8080";

    const config = require("../../shared/config");

    expect(config.apiPort).toBe(8080);
  });
});
