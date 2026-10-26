import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "crop_model.pkl"
DATASET_PATH = BASE_DIR / "Crop_recommendation.csv"
DB_PATH = BASE_DIR / "backend" / "predictions.db"

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def load_dataset_summary():
    df = pd.read_csv(DATASET_PATH)
    feature_bounds = {}
    for feature in FEATURES:
        values = df[feature].dropna()
        feature_bounds[feature] = {
            "min": float(values.min()),
            "max": float(values.max()),
        }
    return {
        "rows": int(len(df)),
        "crop_classes": int(df["label"].nunique()),
        "crop_names": sorted(df["label"].unique().tolist()),
        "feature_bounds": feature_bounds,
    }


def get_model_bundle():
    model_data = joblib.load(MODEL_PATH)
    return {
        "model": model_data["model"],
        "features": model_data.get("features", FEATURES),
        "model_name": model_data.get("model_name", "Random Forest"),
        "test_accuracy": float(model_data.get("test_accuracy", 0.0)),
    }


def init_db():
    import sqlite3

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            model_name TEXT NOT NULL,
            input_payload TEXT NOT NULL,
            prediction TEXT NOT NULL,
            probability REAL NOT NULL,
            top_five TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def get_db_connection():
    import sqlite3

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def serialize_prediction(row):
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "model_name": row["model_name"],
        "prediction": row["prediction"],
        "probability": float(row["probability"]),
        "top_five": json.loads(row["top_five"]),
        "input_payload": json.loads(row["input_payload"]),
    }


def normalize_payload(raw):
    payload = {}
    for feature in FEATURES:
        if feature not in raw:
            raise ValueError(f"Missing required field: {feature}")
        value = raw[feature]
        if value is None or value == "":
            raise ValueError(f"Field {feature} cannot be empty")
        try:
            numeric = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Field {feature} must be numeric") from exc
        if math.isnan(numeric) or math.isinf(numeric):
            raise ValueError(f"Field {feature} must be a finite number")
        payload[feature] = numeric
    return payload


def validate_values(payload):
    dataset_meta = load_dataset_summary()
    for feature, value in payload.items():
        bounds = dataset_meta["feature_bounds"].get(feature)
        if bounds is None:
            raise ValueError(f"Unsupported feature: {feature}")
        if value < bounds["min"] or value > bounds["max"]:
            raise ValueError(
                f"{feature} must be between {bounds['min']} and {bounds['max']} "
                f"for this trained model input range."
            )
    return payload


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Agriclass AI API"})


@app.route("/api/model-info", methods=["GET"])
def model_info():
    try:
        model_bundle = get_model_bundle()
        dataset_meta = load_dataset_summary()
        return jsonify(
            {
                "model_name": model_bundle["model_name"],
                "test_accuracy": model_bundle["test_accuracy"],
                "feature_names": model_bundle["features"],
                "target_column": "label",
                "dataset_rows": dataset_meta["rows"],
                "crop_classes": dataset_meta["crop_classes"],
                "crop_names": dataset_meta["crop_names"],
                "feature_bounds": dataset_meta["feature_bounds"],
                "supports_probability": hasattr(model_bundle["model"], "predict_proba"),
            }
        )
    except Exception as exc:  # pragma: no cover - app safety
        return jsonify({"error": str(exc)}), 500


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    conn = get_db_connection()
    try:
        total_predictions = conn.execute(
            "SELECT COUNT(*) FROM predictions"
        ).fetchone()[0]
        distribution_rows = conn.execute(
            "SELECT prediction, COUNT(*) AS count FROM predictions "
            "GROUP BY prediction ORDER BY count DESC, prediction ASC"
        ).fetchall()
        rows = conn.execute(
            "SELECT * FROM predictions ORDER BY created_at DESC, id DESC"
        ).fetchall()
        conn.close()

        distribution = {row["prediction"]: row["count"] for row in distribution_rows}
        most_frequent = distribution_rows[0] if distribution_rows else None
        now = datetime.now(timezone.utc)
        recent_activity = 0
        for row in rows:
            try:
                timestamp = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            except (AttributeError, TypeError, ValueError):
                continue
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            age_seconds = (now - timestamp.astimezone(timezone.utc)).total_seconds()
            if 0 <= age_seconds <= 7 * 24 * 60 * 60:
                recent_activity += 1
        dataset_meta = load_dataset_summary()
        model_bundle = get_model_bundle()
        return jsonify(
            {
                "total_predictions": total_predictions,
                "most_frequent_crop": (
                    {"crop": most_frequent["prediction"], "count": most_frequent["count"]}
                    if most_frequent else None
                ),
                "recent_activity": recent_activity,
                "distribution": distribution,
                "history": [
                    {
                        "id": row["id"],
                        "time": row["created_at"],
                        "crop": row["prediction"],
                        "confidence": float(row["probability"]),
                        "details": json.loads(row["top_five"]),
                    }
                    for row in rows[:10]
                ],
                "dataset_rows": dataset_meta["rows"],
                "crop_classes": dataset_meta["crop_classes"],
                "model_name": model_bundle["model_name"],
                "test_accuracy": model_bundle["test_accuracy"],
                "feature_names": FEATURES,
            }
        )
    except Exception as exc:  # pragma: no cover - app safety
        if "conn" in locals():
            conn.close()
        return jsonify({"error": str(exc)}), 500


@app.route("/api/history", methods=["GET"])
def history():
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM predictions ORDER BY created_at DESC, id DESC"
        ).fetchall()
        return jsonify({"items": [serialize_prediction(row) for row in rows]})
    except Exception as exc:  # pragma: no cover - app safety
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/api/history/<int:prediction_id>", methods=["GET"])
def history_item(prediction_id):
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM predictions WHERE id = ?", (prediction_id,)
        ).fetchone()
        if row is None:
            return jsonify({"error": "Prediction history record not found."}), 404
        return jsonify(serialize_prediction(row))
    except Exception as exc:  # pragma: no cover - app safety
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/api/history/<int:prediction_id>", methods=["DELETE"])
def delete_history_item(prediction_id):
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM predictions WHERE id = ?", (prediction_id,)
        )
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"error": "Prediction history record not found."}), 404
        conn.commit()
        return jsonify({"deleted_id": prediction_id})
    except Exception as exc:  # pragma: no cover - app safety
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json(silent=True) or {}
        validated_payload = validate_values(normalize_payload(payload))
        feature_frame = pd.DataFrame([validated_payload], columns=FEATURES)

        model_bundle = get_model_bundle()
        model = model_bundle["model"]
        probabilities = model.predict_proba(feature_frame)[0]
        classes = model.classes_
        ordered_indexes = np.argsort(probabilities)[::-1][:5]
        top_five = [
            {"crop": classes[i], "confidence": float(probabilities[i])}
            for i in ordered_indexes
        ]
        best_index = int(np.argmax(probabilities))
        recommended_crop = classes[best_index]
        confidence = float(probabilities[best_index])

        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                """
                INSERT INTO predictions (created_at, model_name, input_payload, prediction, probability, top_five)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    now,
                    model_bundle["model_name"],
                    json.dumps(validated_payload),
                    recommended_crop,
                    confidence,
                    json.dumps(top_five),
                ),
            )
            conn.commit()
            prediction_id = cursor.lastrowid
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

        return jsonify(
            {
                "id": prediction_id,
                "created_at": now,
                "model_name": model_bundle["model_name"],
                "recommended_crop": recommended_crop,
                "confidence": confidence,
                "top_five": top_five,
                "input_values": validated_payload,
                "feature_order": FEATURES,
            }
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - app safety
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics", methods=["GET"])
def analytics():
    dataset = pd.read_csv(DATASET_PATH)
    crop_distribution = dataset["label"].value_counts().sort_values(ascending=False).to_dict()
    feature_summary = {}
    for feature in FEATURES:
        series = dataset[feature]
        feature_summary[feature] = {
            "mean": float(series.mean()),
            "median": float(series.median()),
            "min": float(series.min()),
            "max": float(series.max()),
        }

    return jsonify({
        "crop_distribution": crop_distribution,
        "feature_summary": feature_summary,
    })


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
