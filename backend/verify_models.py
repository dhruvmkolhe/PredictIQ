
import joblib
import pandas as pd
import numpy as np
import os

MODELS_DIR = r"c:\Users\dhruv\Downloads\spars\sparse-halley\backend\models"

def verify_models():
    print("--- Model Verification ---")
    
    # Load required artifacts
    try:
        kmeans = joblib.load(os.path.join(MODELS_DIR, "kmeans.pkl"))
        rfm_scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
        feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
        print("✅ Core artifacts (kmeans, scalers) loaded.")
    except Exception as e:
        print(f"❌ Error loading core artifacts: {e}")
        return

    # Dummy data
    data = {
        "Recency": 10,
        "Frequency": 5,
        "Total_Spend": 1000,
        "Avg_Order_Value": 200,
        "Unique_Products": 10,
        "Avg_Quantity": 5
    }
    
    # Calculate Cluster
    rfm_input = rfm_scaler.transform([[data["Recency"], data["Frequency"], data["Total_Spend"]]])
    cluster = kmeans.predict(rfm_input)[0]
    data["Cluster"] = cluster
    
    df_input = pd.DataFrame([data])
    print(f"Test Input:\n{df_input}")

    model_files = {
        "Random Forest":      "random_forest.pkl",
        "XGBoost":            "xgboost.pkl",
        "Logistic Regression":"logistic_regression.pkl",
        "Decision Tree":      "decision_tree.pkl",
        "SVM":                "svm.pkl",
        "MLP Neural Network": "mlp_neural_network.pkl",
    }
    
    scaled_models = {"Logistic Regression", "SVM", "MLP Neural Network"}

    for name, fname in model_files.items():
        path = os.path.join(MODELS_DIR, fname)
        if not os.path.exists(path):
            print(f"⚠️ {name} model file not found.")
            continue
            
        try:
            model = joblib.load(path)
            
            if name in scaled_models:
                X_input = feat_scaler.transform(df_input)
            else:
                X_input = df_input.values
                
            prob = model.predict_proba(X_input)[0][1]
            print(f"✅ {name:20}: Probability = {prob:.4f}")
        except Exception as e:
            print(f"❌ Error with {name}: {e}")

if __name__ == "__main__":
    verify_models()
