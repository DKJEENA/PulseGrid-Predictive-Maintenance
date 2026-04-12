FROM python:3.11-slim
WORKDIR /app

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all necessary directories
COPY backend /app/backend
COPY ml /app/ml
COPY dataset /app/dataset

# Hugging Face runs with a non-root user (id 1000). 
# We must ensure the user has permission to write to /app (for SQLite db creation)
RUN mkdir -p /app/backend && chmod -R 777 /app

EXPOSE 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
