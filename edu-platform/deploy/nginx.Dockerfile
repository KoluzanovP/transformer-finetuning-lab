# Nginx с зашитым конфигом (чтобы не зависеть от bind-mount в PaaS).
# Контекст сборки — корень репозитория.
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
