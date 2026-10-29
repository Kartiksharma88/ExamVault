FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user
RUN useradd -m -u 10001 selectoruser
USER selectoruser

ENV PYTHONUNBUFFERED=1
ENV PORT=8001

EXPOSE 8001

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "main.py"]

