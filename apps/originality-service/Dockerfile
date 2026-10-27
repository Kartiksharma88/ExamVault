FROM python:3.11-slim

# Create unprivileged application user
RUN groupadd -g 10001 examvault && \
    useradd -u 10001 -g examvault -s /bin/false -m appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set permissions
RUN chown -R appuser:examvault /app

USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Run FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
