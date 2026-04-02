# 阶段1：构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用缓存层
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build-only

# 阶段2：生产运行阶段，使用最小化镜像
FROM nginx:alpine-slim AS production

# 安装必要的工具（用于entrypoint脚本）
RUN apk add --no-cache openssl

# 创建证书目录
RUN mkdir -p /etc/nginx/certs

# 拷贝宿主机上的证书文件到容器中
COPY ./certs/fullchain.pem /etc/nginx/certs/cert.pem
COPY ./certs/privkey.pem /etc/nginx/certs/key.pem

# 复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制entrypoint脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 暴露80和443端口
EXPOSE 80 443

# 使用entrypoint脚本启动
ENTRYPOINT ["/entrypoint.sh"]
