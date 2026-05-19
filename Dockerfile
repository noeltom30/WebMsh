# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Build the static files
COPY frontend/ ./
# (Optional: Pass any frontend environment variables here)
RUN npm run build


# ==========================================
# STAGE 2: Setup the FastAPI Backend
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies required by your mesh libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglu1-mesa libgomp1 libxft2 libxinerama1 libxcursor1 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python backend code
COPY backend/app ./app

# Copy the compiled React files from STAGE 1 into a new folder called "static_frontend"
COPY --from=frontend-builder /app/frontend/dist ./static_frontend

EXPOSE 8000

# Start the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
