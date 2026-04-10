"""
Run this ONCE to train ALL models, compare them, and save the best.
Models: Random Forest, Logistic Regression, XGBoost, Decision Tree, SVM, MLP Neural Network
"""

import pandas as pd
import numpy as np
import datetime as dt
import joblib
import os
import json

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, classification_report, confusion_matrix)

# --- All Models ---
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from xgboost import XGBClassifier

import warnings
warnings.filterwarnings('ignore')

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# =====================
# 1. LOAD & CLEAN DATA
# =====================
print("=" * 60)
print("STEP 1: Downloading UCI Online Retail Dataset...")
url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00352/Online%20Retail.xlsx"
df = pd.read_excel(url)
print(f"  Loaded {df.shape[0]:,} rows × {df.shape[1]} columns")

df = df.dropna(subset=['CustomerID'])
df = df[~df['InvoiceNo'].astype(str).str.startswith('C')]
df = df[(df['Quantity'] > 0) & (df['UnitPrice'] > 0)]
df['TotalAmount'] = df['Quantity'] * df['UnitPrice']
df['CustomerID'] = df['CustomerID'].astype(int)
print(f"  After cleaning: {df.shape[0]:,} rows")

# =====================
# 2. RFM FEATURES
# =====================
print("\nSTEP 2: Computing RFM features...")
analysis_date = df['InvoiceDate'].max() + dt.timedelta(days=1)
rfm = df.groupby('CustomerID').agg(
    Recency=('InvoiceDate', lambda x: (analysis_date - x.max()).days),
    Frequency=('InvoiceNo', 'nunique'),
    Monetary=('TotalAmount', 'sum')
).reset_index()
print(f"  {len(rfm):,} customers with RFM features")

# =====================
# 3. K-MEANS CLUSTERING
# =====================
print("\nSTEP 3: K-Means Clustering (k=4)...")
scaler = StandardScaler()
rfm_scaled = scaler.fit_transform(rfm[['Recency', 'Frequency', 'Monetary']])
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
rfm['Cluster'] = kmeans.fit_predict(rfm_scaled)
cluster_sizes = rfm['Cluster'].value_counts().sort_index()
print(f"  Segment sizes: {cluster_sizes.to_dict()}")

# =====================
# 4. BUILD ML DATASET
# =====================
print("\nSTEP 4: Building ML training dataset (chronological split)...")
cut_off = df['InvoiceDate'].max() - pd.DateOffset(months=3)
tp1 = df[df['InvoiceDate'] < cut_off]
tp2 = df[df['InvoiceDate'] >= cut_off]

features = tp1.groupby('CustomerID').agg(
    Recency=('InvoiceDate', lambda x: (cut_off - x.max()).days),
    Frequency=('InvoiceNo', 'nunique'),
    Total_Spend=('TotalAmount', 'sum'),
    Avg_Order_Value=('TotalAmount', 'mean'),
    Unique_Products=('StockCode', 'nunique'),
    Avg_Quantity=('Quantity', 'mean')
).reset_index()

features = features.merge(rfm[['CustomerID', 'Cluster']], on='CustomerID', how='left')
features['Target'] = features['CustomerID'].isin(tp2['CustomerID'].unique()).astype(int)
features.fillna(0, inplace=True)

X = features.drop(['CustomerID', 'Target'], axis=1)
y = features['Target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")
print(f"  Class balance: {y.value_counts().to_dict()}")

# For models requiring scaled features
feat_scaler = StandardScaler()
X_train_sc = feat_scaler.fit_transform(X_train)
X_test_sc  = feat_scaler.transform(X_test)

# =====================
# 5. TRAIN ALL MODELS
# =====================
print("\nSTEP 5: Training all models...")
print("-" * 60)

model_zoo = {
    "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42),
    "XGBoost": XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42,
                              eval_metric='logloss', verbosity=0),
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42),
    "SVM": SVC(kernel='rbf', probability=True, random_state=42),
    "MLP Neural Network": MLPClassifier(hidden_layer_sizes=(128, 64, 32), max_iter=500,
                                         random_state=42, early_stopping=True, validation_fraction=0.1)
}

# Models that need scaled features
SCALED_MODELS = {"Logistic Regression", "SVM", "MLP Neural Network"}

results = {}
trained_models = {}

for name, model in model_zoo.items():
    print(f"  Training: {name}...", end=" ", flush=True)
    Xtr = X_train_sc if name in SCALED_MODELS else X_train
    Xte = X_test_sc  if name in SCALED_MODELS else X_test
    
    model.fit(Xtr, y_train)
    y_pred = model.predict(Xte)
    y_prob = model.predict_proba(Xte)[:, 1] if hasattr(model, 'predict_proba') else y_pred
    
    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    auc  = roc_auc_score(y_test, y_prob)
    
    results[name] = {
        "accuracy":  round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall":    round(rec * 100, 2),
        "f1":        round(f1 * 100, 2),
        "auc_roc":   round(auc * 100, 2),
        "needs_scaling": name in SCALED_MODELS
    }
    trained_models[name] = model
    print(f"Acc={acc:.3f}  F1={f1:.3f}  AUC={auc:.3f}")

# =====================
# 6. SAVE EVERYTHING
# =====================
print("\nSTEP 6: Saving models and results...")
best_model_name = max(results, key=lambda k: results[k]['f1'])
print(f"\n  ✅ Best Model by F1: {best_model_name} ({results[best_model_name]['f1']}%)")

# Save all individual models
for name, model in trained_models.items():
    filename = name.lower().replace(" ", "_") + ".pkl"
    joblib.dump(model, os.path.join(MODELS_DIR, filename))

# Save shared artifacts
joblib.dump(kmeans, os.path.join(MODELS_DIR, "kmeans.pkl"))
joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))          # RFM scaler
joblib.dump(feat_scaler, os.path.join(MODELS_DIR, "feat_scaler.pkl"))  # Feature scaler (for LR/SVM/MLP)
rfm.to_csv(os.path.join(MODELS_DIR, "rfm_data.csv"), index=False)

# Save comparison results
with open(os.path.join(MODELS_DIR, "model_comparison.json"), "w") as f:
    json.dump(results, f, indent=2)

print("\n  Saved models:", list(trained_models.keys()))
print("\nAll done! ✅")

# =====================
# 7. FINAL SUMMARY
# =====================
print("\n" + "=" * 60)
print("MODEL COMPARISON SUMMARY")
print("=" * 60)
header = f"{'Model':<25} {'Acc':>7} {'Prec':>7} {'Rec':>7} {'F1':>7} {'AUC':>7}"
print(header)
print("-" * 60)
for name, m in sorted(results.items(), key=lambda x: -x[1]['f1']):
    flag = " ★" if name == best_model_name else ""
    print(f"{name:<25} {m['accuracy']:>6.1f}% {m['precision']:>6.1f}% {m['recall']:>6.1f}% {m['f1']:>6.1f}% {m['auc_roc']:>6.1f}%{flag}")
print("=" * 60)
