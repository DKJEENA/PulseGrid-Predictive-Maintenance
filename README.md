# Industry Predictive Maintenance Platform

An end-to-end college project demonstrating an Industrial IoT predicting maintenance platform using real-world data (AI4I dataset). 

## 📁 Repository Structure
- `/backend`: FastAPI Python server to handle endpoints, dataset uploading, and integration with the ML model.
- `/frontend`: React + Vite dashboard mimicking a real industry control screen with dark mode aesthetics.
- `/dataset`: Area containing the raw `ai4i2020.csv` dataset and download scripts.
- `/ml`: Scikit-Learn Machine Learning pipeline that auto-cleans dataset and trains a Random Forest failure classifier.
- `/simulator`: Python script `client.py` that mimics edge machinery sending realtime MQTT/HTTP sensor data.

## 🚀 Step-by-Step Guide to Run Locally

### 1. Pre-requisites
You need **Python 3.10+** and **Node.js 18+** installed on your system.

### 2. Download and Setup
Open your terminal in the root directory:

**Step A: Get the dataset and Train the Model**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the data fetcher
python dataset/fetch_dataset.py

# Train the ML Model (Auto-Cleans data and exports model)
python ml/train_model.py
```

**Step B: Start the Backend (Terminal 1)**
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Step C: Start the Frontend UI (Terminal 2)**
```bash
cd frontend
npm install
npm run dev
```
-> Open your browser to `http://localhost:5173`

**Step D: Start the Simulator (Terminal 3)**
To see the dashboard start moving with live sensors!
```bash
python simulator/client.py
```

## 🔄 How to Change the Dataset
The code is built to automatically handle missing data and swap contexts seamlessly.
1. Go to the **React Dashboard** in your browser.
2. Find the yellow-highlighted **Dataset Configuration Area**.
3. Upload a new formatted CSV (e.g., your own machinery dataset).
4. **Automagically:** The FastAPI server will overwrite the old `ai4i2020.csv`, trigger `train_model.py` in the background, clean the data via its Imputer Pipeline, and save the updated `.joblib` model!

## 🎥 Presentation 
To automatically generate the PowerPoint presentation for your college class:
```bash
python generate_ppt.py
```
A `.pptx` file will be generated in your folder.

## 🛳 Docker Method (Alternative Single-Click approach)
If you have Docker Desktop installed, you can skip steps A-D and simply run:
```bash
docker-compose up --build
```
