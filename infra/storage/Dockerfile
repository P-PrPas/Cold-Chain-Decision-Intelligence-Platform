FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
# This development emulator serves S3 only. The server extra also pulls in
# CloudFormation validators and many unrelated AWS emulators.
RUN pip install --no-cache-dir --no-compile "moto[s3]==5.1.11" "Flask==3.1.3" "flask-cors==6.0.5"
USER 10001
CMD ["moto_server", "-H", "0.0.0.0", "-p", "9000"]
