FROM node:20-alpine
# 安装 postinstall 脚本必需的 curl
RUN apk add --no-cache curl
WORKDIR /app
COPY . .
# 安装依赖
RUN npm install
RUN cd web && npm install
# 编译
RUN npm run build --if-present
# 显式指定容器内部环境变量端口为 8880
ENV PORT=8880
EXPOSE 8880
CMD ["npm", "start"]
