FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build --if-present
EXPOSE 18080
CMD ["npm", "start"]
