import pandas as pd
import os

def download_dataset():
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv"
    print(f"Downloading dataset from {url}...")
    
    try:
        df = pd.read_csv(url)
        dataset_path = os.path.join(os.path.dirname(__file__), 'ai4i2020.csv')
        df.to_csv(dataset_path, index=False)
        print(f"Dataset downloaded successfully to {dataset_path}")
        print(f"Dataset shape: {df.shape}")
        print("First 5 rows:")
        print(df.head())
    except Exception as e:
        print(f"Failed to download dataset: {e}")

if __name__ == "__main__":
    download_dataset()
