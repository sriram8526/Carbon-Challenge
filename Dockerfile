FROM nginx:alpine
COPY src /usr/share/nginx/html
# Cloud Run expects the container to listen on the port defined by the PORT environment variable.
# By default Nginx listens on 80. Cloud Run handles port 80 properly now, but we can also use a custom template if needed.
# For simplicity, Nginx on 80 works in Cloud Run if we don't override the port, Cloud Run defaults to 8080 but handles 80 if configured or we can substitute it.
# Actually, let's use the default nginx and tell Cloud Run to use port 80.
EXPOSE 80
