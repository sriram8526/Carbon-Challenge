# EcoTrack — static asset container image
#
# Serves the zero-dependency single-page application via Nginx.
# Suitable for Cloud Run, ECS, Kubernetes, or any container platform.
#
# Build:  docker build -t ecotrack .
# Run:    docker run -p 8080:8080 ecotrack

FROM nginx:1.27-alpine

# Cloud Run, App Runner, and most managed platforms inject $PORT and expect
# the container to listen on it. We template the Nginx config at startup
# rather than hardcoding port 80, so the same image works locally and on
# any managed platform without modification.
ENV PORT=8080

COPY src/ /usr/share/nginx/html/
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/index.html || exit 1
