# PredictIQ - Customer Insight & Prediction Dashboard

PredictIQ is a full-stack machine learning application designed to provide real-time customer analytics and predictions. It leverages various machine learning models to analyze customer behavior, churn probability, and segmentation.

## 🚀 Features

- **Real-time Predictions**: Instant churn analysis using trained ML models.
- **Interactive Dashboard**: Clean, modern UI for visualizing customer metrics.
- **Multi-Model Support**: Includes Random Forest, XGBoost, SVM, and Logistic Regression models.
- **FastAPI Backend**: High-performance API for serving model predictions.
- **Beautiful Frontend**: Responsive design with rich aesthetics and interactive charts.

## 🛠️ Technology Stack

- **Backend**: Python, FastAPI, Scikit-learn, XGBoost, Pandas, NumPy.
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Chart.js.
- **Analysis**: Jupyter Notebook for Exploratory Data Analysis (EDA).

## 📂 Project Structure

```text
sparse-halley/
├── backend/
│   ├── models/            # Trained ML models (.pkl files)
│   ├── main.py            # FastAPI application
│   ├── train_and_save.py  # Model training script
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── index.html         # Main dashboard interface
│   ├── styles.css         # Custom CSS styling
│   └── script.js          # Frontend logic and API integration
└── Final_Project_Customer_Prediction.ipynb # Data analysis notebook
```

## ⚙️ Setup & Installation

### 1. Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```bash
   python main.py
   ```

### 2. Frontend Setup
1. Simply open `frontend/index.html` in your browser, or serve it using a local live server.

## 📈 Model Performance
The project includes a comparison of multiple models:
- **Random Forest**: High accuracy for complex pattern recognition.
- **XGBoost**: Optimized gradient boosting for tabular data.
- **Logistic Regression**: Baseline performance for binary classification.

## 📝 License
This project is for educational purposes.

---
Created by [dhruvmkolhe](https://github.com/dhruvmkolhe)
