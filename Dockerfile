FROM python:3.11-slim
WORKDIR /app

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all necessary directories
COPY backend /app/backend
COPY ml /app/ml
COPY dataset /app/dataset

# Train the model at build time
RUN cd ml && python train_model.py

# Ensure write permissions for SQLite db and logs
RUN chmod -R 777 /app

EXPOSE 8000

# Run from backend/ directory so relative imports work
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
