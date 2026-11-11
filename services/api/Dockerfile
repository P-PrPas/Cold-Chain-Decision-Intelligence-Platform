FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
ENV PYTHONDONTWRITEBYTECODE=1
RUN pip install --no-cache-dir --no-compile -r requirements.lock
COPY app app
COPY migrations migrations
COPY alembic.ini .
USER 10001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
