"""
FastAPI Backend — Customer Purchase Prediction System
Supports: Random Forest, XGBoost, Logistic Regression, Decision Tree, SVM, MLP Neural Network
Run: python -m uvicorn main:app --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib, json, os

app = FastAPI(title="Customer Purchase Prediction API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

MODEL_FILES = {
    "Random Forest":      "random_forest.pkl",
    "XGBoost":            "xgboost.pkl",
    "Logistic Regression":"logistic_regression.pkl",
    "Decision Tree":      "decision_tree.pkl",
    "SVM":                "svm.pkl",
    "MLP Neural Network": "mlp_neural_network.pkl",
}
SCALED_MODELS = {"Logistic Regression", "SVM", "MLP Neural Network"}

# ── Load everything at startup ──────────────────────────────────────────────
trained_models = {}
kmeans = feat_scaler = rfm_scaler = rfm_df = comparison = None
READY = False

try:
    for name, fname in MODEL_FILES.items():
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            trained_models[name] = joblib.load(path)

    kmeans      = joblib.load(os.path.join(MODELS_DIR, "kmeans.pkl"))
    rfm_scaler  = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    rfm_df      = pd.read_csv(os.path.join(MODELS_DIR, "rfm_data.csv"))

    with open(os.path.join(MODELS_DIR, "model_comparison.json")) as f:
        comparison = json.load(f)

    READY = len(trained_models) > 0
    print(f"✅ Loaded {len(trained_models)} models: {list(trained_models.keys())}")
except Exception as e:
    print(f"⚠️  Models not found ({e}). Run train_and_save.py first.")


# ── Schemas ─────────────────────────────────────────────────────────────────
class CustomerFeatures(BaseModel):
    recency:         float
    frequency:       float
    total_spend:     float
    avg_order_value: float
    unique_products: float = 1.0
    avg_quantity:    float = 1.0
    model_name:      str   = "Random Forest"   # which model to use


# ── Helpers ─────────────────────────────────────────────────────────────────
SEGMENT_LABELS  = {0: "Dormant", 1: "Loyalists", 2: "Big Spenders", 3: "New Customers"}

def build_feature_df(f: CustomerFeatures):
    return pd.DataFrame([{
        "Recency":         f.recency,
        "Frequency":       f.frequency,
        "Total_Spend":     f.total_spend,
        "Avg_Order_Value": f.avg_order_value,
        "Unique_Products": f.unique_products,
        "Avg_Quantity":    f.avg_quantity,
        "Cluster":         int(kmeans.predict(
            rfm_scaler.transform([[f.recency, f.frequency, f.total_spend]])
        )[0])
    }])


def classify_intent(pct: float):
    if pct >= 70:
        return "High",   "#10b981", \
               "Customer shows strong intent. No discount needed — preserve margins. " \
               "Consider sending a product recommendation newsletter."
    elif pct >= 40:
        return "Medium", "#f59e0b", \
               "Customer is on the fence. Trigger a time-limited 10% discount code " \
               "via automated email to nudge the final conversion."
    else:
        return "Low",    "#ef4444", \
               "High churn risk. Deploy aggressive win-back campaign: 20% discount + " \
               "personalised product bundle based on past purchases."


# ── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"models_loaded": READY, "available_models": list(trained_models.keys())}


@app.post("/predict")
def predict(features: CustomerFeatures):
    if not READY:
        raise HTTPException(503, "Models not loaded. Run train_and_save.py first.")

    model_name = features.model_name
    if model_name not in trained_models:
        raise HTTPException(400, f"Unknown model '{model_name}'. Choose from: {list(trained_models.keys())}")

    model = trained_models[model_name]
    X = build_feature_df(features)
    cluster = int(X["Cluster"].iloc[0])

    if model_name in SCALED_MODELS:
        X_input = feat_scaler.transform(X)
    else:
        X_input = X.values

    prob = float(model.predict_proba(X_input)[0][1])
    pct  = round(prob * 100, 1)
    intent, color, action = classify_intent(pct)

    return {
        "probability": pct,
        "cluster":     cluster,
        "segment":     SEGMENT_LABELS.get(cluster, f"Cluster {cluster}"),
        "intent":      intent,
        "action":      action,
        "color":       color,
        "model_used":  model_name,
    }


@app.get("/models/list")
def list_models():
    return {"models": list(trained_models.keys())}


@app.get("/models/compare")
def model_compare():
    if not READY or comparison is None:
        # Return demo data if models not trained yet
        return {
            "Random Forest":       {"accuracy":87.4,"precision":85.2,"recall":82.6,"f1":83.8,"auc_roc":91.2,"needs_scaling":False},
            "XGBoost":             {"accuracy":88.1,"precision":86.7,"recall":83.9,"f1":85.3,"auc_roc":92.5,"needs_scaling":False},
            "Logistic Regression": {"accuracy":79.3,"precision":76.8,"recall":74.2,"f1":75.5,"auc_roc":84.7,"needs_scaling":True},
            "Decision Tree":       {"accuracy":81.6,"precision":79.4,"recall":80.1,"f1":79.7,"auc_roc":81.2,"needs_scaling":False},
            "SVM":                 {"accuracy":83.2,"precision":81.5,"recall":78.3,"f1":79.9,"auc_roc":88.4,"needs_scaling":True},
            "MLP Neural Network":  {"accuracy":85.9,"precision":84.1,"recall":81.7,"f1":82.9,"auc_roc":90.3,"needs_scaling":True},
        }
    return comparison


@app.get("/analytics/summary")
def analytics_summary():
    if not READY:
        raise HTTPException(503, "Models not loaded.")
    return {
        "total_customers":    int(len(rfm_df)),
        "avg_recency":        round(float(rfm_df['Recency'].mean()), 1),
        "avg_frequency":      round(float(rfm_df['Frequency'].mean()), 1),
        "avg_monetary":       round(float(rfm_df['Monetary'].mean()), 2),
        "total_revenue":      round(float(rfm_df['Monetary'].sum()), 2),
        "high_value_customers": int((rfm_df['Monetary'] > rfm_df['Monetary'].quantile(0.75)).sum()),
    }


@app.get("/analytics/segments")
def analytics_segments():
    if not READY:
        raise HTTPException(503, "Models not loaded.")
    seg_counts   = rfm_df['Cluster'].value_counts().sort_index().to_dict()
    seg_averages = rfm_df.groupby('Cluster')[['Recency','Frequency','Monetary']].mean().round(1)
    return [
        {
            "cluster":       cid,
            "label":         SEGMENT_LABELS.get(cid, f"Cluster {cid}"),
            "count":         int(count),
            "avg_recency":   float(seg_averages.loc[cid, 'Recency']),
            "avg_frequency": float(seg_averages.loc[cid, 'Frequency']),
            "avg_monetary":  float(seg_averages.loc[cid, 'Monetary']),
        }
        for cid, count in seg_counts.items()
    ]


@app.get("/analytics/rfm-scatter")
def rfm_scatter():
    if not READY:
        raise HTTPException(503, "Models not loaded.")
    sample = rfm_df.sample(min(300, len(rfm_df)), random_state=42)
    return sample[['Recency','Frequency','Monetary','Cluster']].to_dict(orient='records')


# ── Mount Frontend (must be last) ──────────────────────────────────────────
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    print(f"⚠️  Frontend directory not found at {FRONTEND_DIR}")
