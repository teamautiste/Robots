FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=5000

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system robot \
    && useradd --system --gid robot --home-dir /app robot

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=robot:robot main_web.py ./
COPY --chown=robot:robot web ./web

USER robot

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/status', timeout=3).read()"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "main_web.py"]
