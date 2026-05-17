import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const api = axios.create({ baseURL: API_BASE, timeout: 8000 });

/**
 * Custom hook for polling an API endpoint.
 * @param {string} path  – API path (e.g. "/health")
 * @param {number} intervalMs – poll interval in ms (0 = no polling)
 */
export function useApi(path, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(path);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchData();
    if (intervalMs > 0) {
      const id = setInterval(fetchData, intervalMs);
      return () => clearInterval(id);
    }
  }, [fetchData, intervalMs]);

  return { data, error, loading, refetch: fetchData };
}

export { api, API_BASE };
