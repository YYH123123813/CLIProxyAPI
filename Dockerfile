FROM node:20-alpine
# 安装 postinstall 脚本必需的 curl
RUN apk add --no-cache curl
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build --if-present
EXPOSE 18080
CMD ["npm", "start"]
