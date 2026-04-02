#!/bin/sh
set -e

# 默认证书路径
SSL_CERTIFICATE="${SSL_CERTIFICATE:-/etc/nginx/certs/cert.pem}"
SSL_CERTIFICATE_KEY="${SSL_CERTIFICATE_KEY:-/etc/nginx/certs/key.pem}"
ENABLE_HTTPS_REDIRECT="${ENABLE_HTTPS_REDIRECT:-true}"

# 检查证书是否存在
if [ -f "$SSL_CERTIFICATE" ] && [ -f "$SSL_CERTIFICATE_KEY" ]; then
    echo "SSL certificates found. Enabling HTTPS..."
    echo "Certificate: $SSL_CERTIFICATE"
    echo "Private key: $SSL_CERTIFICATE_KEY"

    if [ "$ENABLE_HTTPS_REDIRECT" = "true" ]; then
        # HTTPS 配置，HTTP 重定向到 HTTPS
        cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    ssl_certificate SSL_CERTIFICATE_PLACEHOLDER;
    ssl_certificate_key SSL_CERTIFICATE_KEY_PLACEHOLDER;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}
EOF
    else
        # HTTPS 配置，HTTP 也提供服务
        cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}

server {
    listen 443 ssl;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    ssl_certificate SSL_CERTIFICATE_PLACEHOLDER;
    ssl_certificate_key SSL_CERTIFICATE_KEY_PLACEHOLDER;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}
EOF
    fi

    # 替换证书路径占位符
    sed -i "s|SSL_CERTIFICATE_PLACEHOLDER|$SSL_CERTIFICATE|g" /etc/nginx/conf.d/default.conf
    sed -i "s|SSL_CERTIFICATE_KEY_PLACEHOLDER|$SSL_CERTIFICATE_KEY|g" /etc/nginx/conf.d/default.conf

else
    echo "SSL certificates not found. Running in HTTP mode only..."
    echo "Expected certificate: $SSL_CERTIFICATE"
    echo "Expected private key: $SSL_CERTIFICATE_KEY"
    echo ""
    echo "To enable HTTPS, mount your certificates to the container:"
    echo "  docker run -v /path/to/certs:/etc/nginx/certs ..."

    # HTTP 配置
    cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}
EOF
fi

echo ""
echo "Nginx configuration:"
cat /etc/nginx/conf.d/default.conf
echo ""
echo "Starting Nginx..."

exec nginx -g "daemon off;"
