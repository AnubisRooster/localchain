const metrics = require("../services/metrics");

describe("Metrics Service", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("init", () => {
    it("initializes all counters", () => {
      expect(metrics.counters.size).toBeGreaterThan(0);
      expect(metrics.counters.has("localchain_api_requests_total")).toBe(true);
      expect(metrics.counters.has("localchain_api_errors_total")).toBe(true);
      expect(metrics.counters.has("localchain_tx_broadcast_total")).toBe(true);
      expect(metrics.counters.has("localchain_node_registrations_total")).toBe(true);
      expect(metrics.counters.has("localchain_api_keys_created_total")).toBe(true);
      expect(metrics.counters.has("localchain_tenants_created_total")).toBe(true);
    });

    it("initializes all gauges", () => {
      expect(metrics.gauges.size).toBeGreaterThan(0);
      expect(metrics.gauges.has("localchain_block_height")).toBe(true);
      expect(metrics.gauges.has("localchain_peers")).toBe(true);
      expect(metrics.gauges.has("localchain_node_online")).toBe(true);
      expect(metrics.gauges.has("localchain_active_tenants")).toBe(true);
      expect(metrics.gauges.has("localchain_process_heap_used_mb")).toBe(true);
    });

    it("initializes all histograms", () => {
      expect(metrics.histograms.size).toBeGreaterThan(0);
      expect(metrics.histograms.has("localchain_request_duration_seconds")).toBe(true);
      expect(metrics.histograms.has("localchain_block_time_seconds")).toBe(true);
      expect(metrics.histograms.has("localchain_node_latency_seconds")).toBe(true);
    });
  });

  describe("counters", () => {
    it("increments simple counter", () => {
      metrics.incCounter("localchain_api_requests_total");
      const c = metrics.counters.get("localchain_api_requests_total");
      expect(c.value).toBe(1);
    });

    it("increments counter with custom value", () => {
      metrics.incCounter("localchain_api_requests_total", {}, 5);
      const c = metrics.counters.get("localchain_api_requests_total");
      expect(c.value).toBe(5);
    });

    it("increments labeled counter", () => {
      metrics.incCounter("localchain_api_requests_by_method_total", { method: "GET" });
      metrics.incCounter("localchain_api_requests_by_method_total", { method: "GET" });
      metrics.incCounter("localchain_api_requests_by_method_total", { method: "POST" });
      const c = metrics.counters.get("localchain_api_requests_by_method_total");
      expect(c.values.get('method="GET"')).toBe(2);
      expect(c.values.get('method="POST"')).toBe(1);
    });
  });

  describe("gauges", () => {
    it("sets gauge value", () => {
      metrics.setGauge("localchain_block_height", 12345);
      const g = metrics.gauges.get("localchain_block_height");
      expect(g.value).toBe(12345);
    });

    it("increments gauge", () => {
      metrics.incGauge("localchain_node_online");
      metrics.incGauge("localchain_node_online");
      const g = metrics.gauges.get("localchain_node_online");
      expect(g.value).toBe(2);
    });

    it("decrements gauge with negative delta", () => {
      metrics.setGauge("localchain_node_online", 5);
      metrics.incGauge("localchain_node_online", -2);
      const g = metrics.gauges.get("localchain_node_online");
      expect(g.value).toBe(3);
    });
  });

  describe("histograms", () => {
    it("records observations", () => {
      metrics.observeHistogram("localchain_request_duration_seconds", 0.1);
      metrics.observeHistogram("localchain_request_duration_seconds", 0.2);
      metrics.observeHistogram("localchain_request_duration_seconds", 0.5);
      const h = metrics.histograms.get("localchain_request_duration_seconds");
      expect(h.samples.length).toBe(3);
    });

    it("caps sample size", () => {
      for (let i = 0; i < 15000; i++) {
        metrics.observeHistogram("localchain_request_duration_seconds", i / 1000);
      }
      const h = metrics.histograms.get("localchain_request_duration_seconds");
      expect(h.samples.length).toBeLessThanOrEqual(10000);
    });
  });

  describe("updateChainMetrics", () => {
    it("updates chain gauges", () => {
      metrics.updateChainMetrics({ blockHeight: 500000, peers: 3, catchingUp: false });
      expect(metrics.gauges.get("localchain_block_height").value).toBe(500000);
      expect(metrics.gauges.get("localchain_peers").value).toBe(3);
      expect(metrics.gauges.get("localchain_catching_up").value).toBe(0);
    });

    it("sets catching_up to 1 when true", () => {
      metrics.updateChainMetrics({ blockHeight: 100, peers: 0, catchingUp: true });
      expect(metrics.gauges.get("localchain_catching_up").value).toBe(1);
    });

    it("records block time between updates", () => {
      metrics.updateChainMetrics({ blockHeight: 100, peers: 1, catchingUp: false });
      const h = metrics.histograms.get("localchain_block_time_seconds");
      expect(h.samples.length).toBe(0);

      setTimeout(() => {
        metrics.updateChainMetrics({ blockHeight: 101, peers: 1, catchingUp: false });
        expect(h.samples.length).toBe(1);
      }, 100);
    });
  });

  describe("updateNodePoolMetrics", () => {
    it("updates node pool gauges", () => {
      metrics.updateNodePoolMetrics({ total: 5, online: 3, offline: 2 });
      expect(metrics.gauges.get("localchain_node_pool_size").value).toBe(5);
      expect(metrics.gauges.get("localchain_node_online").value).toBe(3);
      expect(metrics.gauges.get("localchain_node_offline").value).toBe(2);
    });
  });

  describe("updateTenantMetrics", () => {
    it("updates tenant gauges", () => {
      metrics.updateTenantMetrics({ active_tenants: 4, total_keys: 12 });
      expect(metrics.gauges.get("localchain_active_tenants").value).toBe(4);
      expect(metrics.gauges.get("localchain_active_api_keys").value).toBe(12);
    });
  });

  describe("updateSystemMetrics", () => {
    it("updates system gauges", () => {
      metrics.updateSystemMetrics();
      expect(metrics.gauges.get("localchain_system_mem_used_percent").value).toBeGreaterThan(0);
      expect(metrics.gauges.get("localchain_system_cpu_load").value).toBeGreaterThanOrEqual(0);
      expect(metrics.gauges.get("localchain_system_uptime_seconds").value).toBeGreaterThan(0);
      expect(metrics.gauges.get("localchain_process_heap_used_mb").value).toBeGreaterThan(0);
    });
  });

  describe("generatePrometheusText", () => {
    it("returns valid Prometheus text format", () => {
      metrics.incCounter("localchain_api_requests_total");
      metrics.setGauge("localchain_block_height", 100);
      metrics.observeHistogram("localchain_request_duration_seconds", 0.05);

      const text = metrics.generatePrometheusText();
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

    it("includes labeled counters", () => {
      metrics.incCounter("localchain_api_requests_by_method_total", { method: "GET" });
      metrics.incCounter("localchain_api_requests_by_method_total", { method: "POST" });

      const text = metrics.generatePrometheusText();
      expect(text).toContain('method="GET"');
      expect(text).toContain('method="POST"');
    });

    it("includes info metric", () => {
      const text = metrics.generatePrometheusText();
      expect(text).toContain("# TYPE localchain_info gauge");
      expect(text).toContain('localchain_info{version="1.0.0"');
    });
  });

  describe("getJsonSummary", () => {
    it("returns structured summary", () => {
      metrics.incCounter("localchain_api_requests_total");
      metrics.incCounter("localchain_api_errors_total");
      metrics.setGauge("localchain_block_height", 500000);
      metrics.setGauge("localchain_node_online", 2);

      const summary = metrics.getJsonSummary();
      expect(summary.requests.total).toBe(1);
      expect(summary.requests.errors).toBe(1);
      expect(summary.chain.blockHeight).toBe(500000);
      expect(summary.nodes.online).toBe(2);
      expect(summary.latency).toHaveProperty("p50_ms");
      expect(summary.latency).toHaveProperty("p95_ms");
      expect(summary.latency).toHaveProperty("p99_ms");
      expect(summary.system).toHaveProperty("memUsedPercent");
      expect(summary.system).toHaveProperty("cpuLoad");
      expect(summary.tenants).toHaveProperty("active");
      expect(summary.transactions).toHaveProperty("total");
    });

    it("calculates error rate", () => {
      for (let i = 0; i < 100; i++) {
        metrics.incCounter("localchain_api_requests_total");
      }
      for (let i = 0; i < 5; i++) {
        metrics.incCounter("localchain_api_errors_total");
      }

      const summary = metrics.getJsonSummary();
      expect(summary.requests.errorRate).toBe("5.00%");
    });
  });

  describe("httpMiddleware", () => {
    it("tracks requests and status codes", () => {
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
      expect(metrics.counters.get("localchain_api_requests_total").value).toBe(1);
      expect(metrics.counters.get("localchain_api_requests_by_method_total").values.get('method="GET"')).toBe(1);
    });

    it("increments error counter for 4xx/5xx", () => {
      const mockReq = { method: "POST", path: "/api/records" };
      const mockRes = {
        statusCode: 500,
        end: jest.fn(),
      };
      const next = () => {};

      metrics.httpMiddleware(mockReq, mockRes, next);
      mockRes.end();

      expect(metrics.counters.get("localchain_api_errors_total").value).toBe(1);
    });

    it("records request duration", () => {
      const mockReq = { method: "GET", path: "/api/health" };
      const mockRes = {
        statusCode: 200,
        end: jest.fn(),
      };
      const next = () => {};

      metrics.httpMiddleware(mockReq, mockRes, next);
      mockRes.end();

      const h = metrics.histograms.get("localchain_request_duration_seconds");
      expect(h.samples.length).toBe(1);
      expect(h.samples[0]).toBeLessThan(1);
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      metrics.incCounter("localchain_api_requests_total");
      metrics.setGauge("localchain_block_height", 999);
      metrics.observeHistogram("localchain_request_duration_seconds", 0.1);

      metrics.reset();

      expect(metrics.counters.get("localchain_api_requests_total").value).toBe(0);
      expect(metrics.gauges.get("localchain_block_height").value).toBe(0);
      expect(metrics.histograms.get("localchain_request_duration_seconds").samples.length).toBe(0);
    });
  });
});
