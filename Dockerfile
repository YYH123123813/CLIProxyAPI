FROM node:20-alpine
# 安装 postinstall 脚本必需的 curl
RUN apk add --no-cache curl
WORKDIR /app
COPY . .
# 安装后端依赖
RUN npm install
# 进入前端文件夹并安装前端依赖
RUN cd web && npm install
# 重新执行打包构建
RUN npm run build --if-present
EXPOSE 18080
CMD ["npm", "start"]
