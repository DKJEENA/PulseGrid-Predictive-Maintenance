FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The code will be mounted as a volume so we don't strictly need to copy it here for dev,
# but it's good practice for production build
COPY backend /app/backend
COPY ml /app/ml
COPY dataset /app/dataset

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
