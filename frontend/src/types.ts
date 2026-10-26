export type FeatureKey = 'N' | 'P' | 'K' | 'temperature' | 'humidity' | 'ph' | 'rainfall';

export interface ModelInfo {
  model_name: string;
  test_accuracy: number;
  feature_names: string[];
  target_column: string;
  dataset_rows: number;
  crop_classes: number;
  crop_names: string[];
  feature_bounds: Record<string, { min: number; max: number }>;
  supports_probability: boolean;
  feature_importances?: Array<{ feature: string; importance: number }>;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface PredictionItem {
  crop: string;
  confidence: number;
}

export interface PredictionResponse {
  id: number;
  created_at: string;
  model_name: string;
  recommended_crop: string;
  confidence: number;
  top_five: PredictionItem[];
  input_values: Record<string, number>;
  feature_order: string[];
}

export interface DashboardResponse {
  total_predictions: number;
  most_frequent_crop: { crop: string; count: number } | null;
  recent_activity: number;
  distribution: Record<string, number>;
  history: Array<{
    id: number;
    time: string;
    crop: string;
    confidence: number;
    details: PredictionItem[];
  }>;
  dataset_rows: number;
  crop_classes: number;
  model_name: string;
  test_accuracy: number;
  feature_names: string[];
}

export interface AnalyticsResponse {
  crop_distribution: Record<string, number>;
  feature_summary: Record<string, { mean: number; median: number; min: number; max: number }>;
}

export interface HistoryItem {
  id: number;
  created_at: string;
  model_name: string;
  prediction: string;
  probability: number;
  top_five: PredictionItem[];
  input_payload: Record<string, number>;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

export interface DashboardData {
  health: HealthResponse | null;
  modelInfo: ModelInfo | null;
  history: HistoryItem[] | null;
}
