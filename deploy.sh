#!/bin/bash
set -e

# 配置项
DOMAIN="remote-connect.icu"
IMAGE_NAME="sumiao-app"
CONTAINER_NAME="sumiao-app"
HOST_PORT_HTTP="80"
HOST_PORT_HTTPS="443"

# 证书路径（Let's Encrypt 标准路径）
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

echo "=========================================="
echo "  素描上色工具 - Docker 部署脚本"
echo "  域名: ${DOMAIN}"
echo "=========================================="
echo ""

# 检查证书是否存在
if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "错误: 证书文件不存在!"
    echo "证书路径: ${CERT_PATH}"
    echo "私钥路径: ${KEY_PATH}"
    echo ""
    echo "请先申请证书:"
    echo "  sudo certbot --nginx -d ${DOMAIN}"
    exit 1
fi

echo "✓ 证书文件存在"
echo "  证书: ${CERT_PATH}"
echo "  私钥: ${KEY_PATH}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装!"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker 已安装"
echo ""

# 构建镜像
echo "正在构建 Docker 镜像..."
docker build -t ${IMAGE_NAME}:latest .
echo ""
echo "✓ 镜像构建完成: ${IMAGE_NAME}:latest"
echo ""

# 停止并删除旧容器（如果存在）
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "停止旧容器..."
    docker stop ${CONTAINER_NAME} 2>/dev/null || true
    docker rm ${CONTAINER_NAME} 2>/dev/null || true
    echo "✓ 旧容器已清理"
    echo ""
fi

# 运行新容器
echo "启动新容器..."
echo ""

# 注意: Let's Encrypt 证书目录权限需要特殊处理
# 方案1: 使用 docker run --user root (默认)
# 方案2: 将证书复制到用户可访问的目录
# 方案3: 使用 ACL 添加权限

docker run -d \
    --name ${CONTAINER_NAME} \
    -p ${HOST_PORT_HTTP}:80 \
    -p ${HOST_PORT_HTTPS}:443 \
    -v "${CERT_DIR}:${CERT_DIR}:ro" \
    -e SSL_CERTIFICATE="${CERT_PATH}" \
    -e SSL_CERTIFICATE_KEY="${KEY_PATH}" \
    -e ENABLE_HTTPS_REDIRECT="true" \
    --restart unless-stopped \
    ${IMAGE_NAME}:latest

echo ""
echo "✓ 容器启动成功!"
echo ""

# 等待 Nginx 启动
sleep 2

# 检查容器状态
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "=========================================="
    echo "  部署成功!"
    echo "=========================================="
    echo ""
    echo "访问地址:"
    echo "  HTTP:  http://${DOMAIN} (会自动重定向到 HTTPS)"
    echo "  HTTPS: https://${DOMAIN}"
    echo ""
    echo "容器信息:"
    docker ps --filter "name=${CONTAINER_NAME}" --format "  状态: {{.Status}}\n  端口: {{.Ports}}"
    echo ""
    echo "查看日志:"
    echo "  docker logs -f ${CONTAINER_NAME}"
    echo ""
    echo "停止服务:"
    echo "  docker stop ${CONTAINER_NAME}"
    echo ""
else
    echo "=========================================="
    echo "  部署失败!"
    echo "=========================================="
    echo ""
    echo "查看错误日志:"
    echo "  docker logs ${CONTAINER_NAME}"
    exit 1
fi
