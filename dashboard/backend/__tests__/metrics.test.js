const client = require("prom-client");
const metrics = require("../services/metrics");

describe("Metrics Service", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("init", () => {
    it("registers counter metrics", async () => {
      const metricFamilies = await metrics.register.getMetricsAsArray();
      const names = metricFamilies.map((m) => m.name);
      expect(names).toContain("localchain_api_requests_total");
      expect(names).toContain("localchain_api_errors_total");
      expect(names).toContain("localchain_tx_broadcast_total");
      expect(names).toContain("localchain_node_registrations_total");
      expect(names).toContain("localchain_api_keys_created_total");
      expect(names).toContain("localchain_tenants_created_total");
    });

    it("registers gauge metrics", async () => {
      const metricFamilies = await metrics.register.getMetricsAsArray();
      const names = metricFamilies.map((m) => m.name);
      expect(names).toContain("localchain_block_height");
      expect(names).toContain("localchain_peers");
      expect(names).toContain("localchain_node_online");
      expect(names).toContain("localchain_active_tenants");
    });

    it("registers histogram metrics", async () => {
      const metricFamilies = await metrics.register.getMetricsAsArray();
      const names = metricFamilies.map((m) => m.name);
      expect(names).toContain("localchain_request_duration_seconds");
      expect(names).toContain("localchain_block_time_seconds");
      expect(names).toContain("localchain_node_latency_seconds");
    });
  });

  describe("counters", () => {
    it("increments simple counter", async () => {
      metrics.apiRequestsTotal.inc();
      const v = await metrics.apiRequestsTotal.get();
      expect(v.values[0].value).toBe(1);
    });

    it("increments counter with custom value", async () => {
      metrics.apiRequestsTotal.inc(5);
      const v = await metrics.apiRequestsTotal.get();
      expect(v.values[0].value).toBe(5);
    });

    it("increments labeled counter", async () => {
      metrics.apiRequestsTotal.inc({ method: "GET", path: "/test", status: "200" });
      metrics.apiRequestsTotal.inc({ method: "GET", path: "/test", status: "200" });
      metrics.apiRequestsTotal.inc({ method: "POST", path: "/test", status: "201" });
      const v = await metrics.apiRequestsTotal.get();
      const getVal = v.values.find((x) => x.labels.method === "GET");
      const postVal = v.values.find((x) => x.labels.method === "POST");
      expect(getVal.value).toBe(2);
      expect(postVal.value).toBe(1);
    });
  });

  describe("gauges", () => {
    it("sets gauge value", async () => {
      metrics.blockHeight.set(12345);
      const v = await metrics.blockHeight.get();
      expect(v.values[0].value).toBe(12345);
    });

    it("increments gauge", async () => {
      metrics.nodeOnline.inc();
      metrics.nodeOnline.inc();
      const v = await metrics.nodeOnline.get();
      expect(v.values[0].value).toBe(2);
    });

    it("decrements gauge with negative delta", async () => {
      metrics.nodeOnline.set(5);
      metrics.nodeOnline.inc(-2);
      const v = await metrics.nodeOnline.get();
      expect(v.values[0].value).toBe(3);
    });
  });

  describe("histograms", () => {
    it("records observations", async () => {
      metrics.requestDuration.observe(0.1);
      metrics.requestDuration.observe(0.2);
      metrics.requestDuration.observe(0.5);
      const v = await metrics.requestDuration.get();
      expect(v.values.find((x) => x.labels.le === "+Inf").value).toBe(3);
    });

    it("has correct bucket boundaries", async () => {
      metrics.requestDuration.observe(0.003);
      metrics.requestDuration.observe(0.02);
      metrics.requestDuration.observe(0.3);
      const v = await metrics.requestDuration.get();
      const bucket005 = v.values.find((x) => parseFloat(x.labels.le) === 0.005);
      const bucket025 = v.values.find((x) => parseFloat(x.labels.le) === 0.025);
      const bucket05 = v.values.find((x) => parseFloat(x.labels.le) === 0.5);
      expect(bucket005.value).toBe(1);
      expect(bucket025.value).toBe(2);
      expect(bucket05.value).toBe(3);
    });
  });

  describe("updateChainMetrics", () => {
    it("updates chain gauges", async () => {
      metrics.updateChainMetrics({ blockHeight: 500000, peers: 3, catchingUp: false });
      const bh = await metrics.blockHeight.get();
      const p = await metrics.peers.get();
      const cu = await metrics.catchingUp.get();
      expect(bh.values[0].value).toBe(500000);
      expect(p.values[0].value).toBe(3);
      expect(cu.values[0].value).toBe(0);
    });

    it("sets catching_up to 1 when true", async () => {
      metrics.updateChainMetrics({ blockHeight: 100, peers: 0, catchingUp: true });
      const cu = await metrics.catchingUp.get();
      expect(cu.values[0].value).toBe(1);
    });

    it("records block time between updates", async () => {
      metrics.updateChainMetrics({ blockHeight: 100, peers: 1, catchingUp: false });
      const bt = await metrics.blockTime.get();
      const countBefore = bt.values.find((x) => x.labels.le === "+Inf").value;
      expect(countBefore).toBe(0);

      await new Promise((r) => setTimeout(r, 100));
      metrics.updateChainMetrics({ blockHeight: 101, peers: 1, catchingUp: false });
      const bt2 = await metrics.blockTime.get();
      const countAfter = bt2.values.find((x) => x.labels.le === "+Inf").value;
      expect(countAfter).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateNodePoolMetrics", () => {
    it("updates node pool gauges", async () => {
      metrics.updateNodePoolMetrics({ total: 5, online: 3, offline: 2 });
      const ps = await metrics.nodePoolSize.get();
      const on = await metrics.nodeOnline.get();
      const off = await metrics.nodeOffline.get();
      expect(ps.values[0].value).toBe(5);
      expect(on.values[0].value).toBe(3);
      expect(off.values[0].value).toBe(2);
    });
  });

  describe("updateTenantMetrics", () => {
    it("updates tenant gauges", async () => {
      metrics.updateTenantMetrics({ active_tenants: 4, total_keys: 12 });
      const at = await metrics.activeTenants.get();
      const ak = await metrics.activeApiKeys.get();
      expect(at.values[0].value).toBe(4);
      expect(ak.values[0].value).toBe(12);
    });
  });

  describe("updateSystemMetrics", () => {
    it("updates system gauges", async () => {
      metrics.updateSystemMetrics();
      const mem = await metrics.systemMemUsedPercent.get();
      const cpu = await metrics.systemCpuLoad.get();
      const up = await metrics.systemUptime.get();
      expect(mem.values[0].value).toBeGreaterThan(0);
      expect(cpu.values[0].value).toBeGreaterThanOrEqual(0);
      expect(up.values[0].value).toBeGreaterThan(0);
    });
  });

  describe("generatePrometheusText", () => {
    it("returns valid Prometheus text format", async () => {
      metrics.apiRequestsTotal.inc();
      metrics.blockHeight.set(100);
      metrics.requestDuration.observe(0.05);

      const text = await metrics.generatePrometheusText();
      expect(text).toContain("# HELP localchain_api_requests_total");
      expect(text).toContain("# TYPE localchain_api_requests_total counter");
      expect(text).toContain("localchain_api_requests_total 1");
      expect(text).toContain("# HELP localchain_block_height");
      expect(text).toContain("# TYPE localchain_block_height gauge");
      expect(text).toContain("localchain_block_height 100");
      expect(text).toContain("# TYPE localchain_request_duration_seconds histogram");
      expect(text).toContain("localchain_request_duration_seconds_bucket");
      expect(text).toContain("localchain_request_duration_seconds_sum");
      expect(text).toContain("localchain_request_duration_seconds_count 1");
    });

    it("includes labeled counters", async () => {
      metrics.apiRequestsTotal.inc({ method: "GET", path: "/test", status: "200" });
      metrics.apiRequestsTotal.inc({ method: "POST", path: "/test", status: "201" });

      const text = await metrics.generatePrometheusText();
      expect(text).toContain('method="GET"');
      expect(text).toContain('method="POST"');
    });

    it("includes info metric", async () => {
      const text = await metrics.generatePrometheusText();
      expect(text).toContain("# TYPE localchain_info gauge");
      expect(text).toContain('version="1.0.0"');
    });
  });

  describe("getJsonSummary", () => {
    it("returns structured summary", async () => {
      metrics.apiRequestsTotal.inc();
      metrics.apiErrorsTotal.inc();
      metrics.blockHeight.set(500000);
      metrics.nodeOnline.set(2);

      const summary = await metrics.getJsonSummary();
      expect(summary.requests.total).toBe(1);
      expect(summary.requests.errors).toBe(1);
      expect(summary.chain.blockHeight).toBe(500000);
      expect(summary.nodes.online).toBe(2);
      expect(summary.system).toHaveProperty("memUsedPercent");
      expect(summary.system).toHaveProperty("cpuLoad");
      expect(summary.tenants).toHaveProperty("active");
      expect(summary.transactions).toHaveProperty("total");
    });

    it("calculates error rate", async () => {
      metrics.apiRequestsTotal.inc(100);
      metrics.apiErrorsTotal.inc(5);

      const summary = await metrics.getJsonSummary();
      expect(summary.requests.errorRate).toBe("5.00%");
    });
  });

  describe("httpMiddleware", () => {
    it("tracks requests and status codes", async () => {
      const mockReq = { method: "GET", path: "/health" };
      const mockRes = {
        statusCode: 200,
        end: jest.fn(),
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      metrics.httpMiddleware(mockReq, mockRes, next);
      mockRes.end();

      expect(nextCalled).toBe(true);
      const v = await metrics.apiRequestsTotal.get();
      expect(v.values[0].value).toBe(1);
    });

    it("increments error counter for 4xx/5xx", async () => {
      const mockReq = { method: "POST", path: "/api/records" };
      const mockRes = {
        statusCode: 500,
        end: jest.fn(),
      };
      const next = () => {};

      metrics.httpMiddleware(mockReq, mockRes, next);
      mockRes.end();

      const v = await metrics.apiErrorsTotal.get();
      expect(v.values[0].value).toBe(1);
    });

    it("records request duration", async () => {
      const mockReq = { method: "GET", path: "/api/health" };
      const mockRes = {
        statusCode: 200,
        end: jest.fn(),
      };
      const next = () => {};

      metrics.httpMiddleware(mockReq, mockRes, next);
      mockRes.end();

      const v = await metrics.requestDuration.get();
      const count = v.values.find((x) => x.labels.le === "+Inf").value;
      expect(count).toBe(1);
    });
  });

  describe("reset", () => {
    it("clears all metrics", async () => {
      metrics.apiRequestsTotal.inc();
      metrics.blockHeight.set(999);
      metrics.requestDuration.observe(0.1);

      metrics.reset();

      const req = await metrics.apiRequestsTotal.get();
      const bh = await metrics.blockHeight.get();
      const rd = await metrics.requestDuration.get();
      expect(req.values[0]?.value || 0).toBe(0);
      expect(bh.values[0]?.value || 0).toBe(0);
      expect(rd.values.find((x) => x.labels.le === "+Inf")?.value || 0).toBe(0);
    });
  });
});
