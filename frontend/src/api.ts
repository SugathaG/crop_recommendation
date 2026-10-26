import axios from 'axios';
import type { AnalyticsResponse, DashboardData, DashboardResponse, HealthResponse, HistoryItem, HistoryResponse, ModelInfo, PredictionResponse } from './types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export const fetchModelInfo = async (): Promise<ModelInfo> => {
  const response = await api.get('/model-info');
  return response.data;
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await api.get('/health');
  return response.data;
};

export const fetchDashboard = async (): Promise<DashboardResponse> => {
  const response = await api.get('/dashboard');
  return response.data;
};

export const fetchAnalytics = async (): Promise<AnalyticsResponse> => {
  const response = await api.get('/analytics');
  return response.data;
};

export const fetchHistory = async (): Promise<HistoryResponse> => {
  const response = await api.get('/history');
  const items: unknown = response.data?.items;
  if (!Array.isArray(items) || !items.every(isHistoryItem)) {
    throw new Error('The prediction history service returned data in an unexpected format.');
  }
  return response.data;
};

export const fetchHistoryItem = async (id: number): Promise<HistoryItem> => {
  const response = await api.get(`/history/${id}`);
  if (!isHistoryItem(response.data)) {
    throw new Error('The prediction history service returned an unexpected record.');
  }
  return response.data;
};

export const deleteHistoryItem = async (id: number): Promise<void> => {
  await api.delete(`/history/${id}`);
};

function isHistoryItem(item: unknown): item is HistoryItem {
  if (typeof item !== 'object' || item === null) return false;
  const record = item as Record<string, unknown>;
  const inputs = record.input_payload;
  return Number.isFinite(record.id)
    && typeof record.created_at === 'string'
    && typeof record.prediction === 'string'
    && typeof inputs === 'object'
    && inputs !== null
    && !Array.isArray(inputs);
}

export const fetchDashboardData = async (): Promise<DashboardData> => {
  const [health, modelInfo, history] = await Promise.allSettled([
    fetchHealth(),
    fetchModelInfo(),
    fetchHistory(),
  ]);

  const historyItems = history.status === 'fulfilled' && Array.isArray(history.value.items)
    ? history.value.items
    : null;

  return {
    health: health.status === 'fulfilled' ? health.value : null,
    modelInfo: modelInfo.status === 'fulfilled' ? modelInfo.value : null,
    history: historyItems,
  };
};

export const predictCrop = async (payload: Record<string, number>, signal?: AbortSignal): Promise<PredictionResponse> => {
  const response = await api.post('/predict', payload, { signal });
  return response.data;
};

export default api;
