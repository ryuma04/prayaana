# Built from the repository root (see docker-compose.yml) so it can read the shared catalog.
FROM python:3.12-slim
WORKDIR /srv
COPY services/ai/requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt
COPY services/ai/app ./app
COPY backend/internal/seed/data/catalog.json /srv/catalog.json
ENV CATALOG_PATH=/srv/catalog.json
EXPOSE 8090
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
