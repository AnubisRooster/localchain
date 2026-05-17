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

/**
 * Custom hook for mutations (POST, PUT, DELETE).
 * Returns { mutate, data, error, loading, reset }
 */
export function useApiMutation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(async (method, path, body) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.request({ method, url: path, data: body });
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    post: (path, body) => mutate("POST", path, body),
    put: (path, body) => mutate("PUT", path, body),
    del: (path) => mutate("DELETE", path),
    data,
    error,
    loading,
    reset,
  };
}

export { api, API_BASE };
