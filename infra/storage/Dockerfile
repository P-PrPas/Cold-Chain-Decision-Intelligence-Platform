FROM python:3.12-slim
RUN pip install --no-cache-dir "moto[server]==5.1.11"
USER 10001
CMD ["moto_server", "-H", "0.0.0.0", "-p", "9000"]
