FROM python:3.11-slim

WORKDIR /app

# deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*

# libs
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py /app/app.py

ENV PYTHONUNBUFFERED=1

CMD ["python","/app/app.py"]