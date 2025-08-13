# Multi-stage build for production
FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev=false

# Copy source and build
COPY . .
RUN npm run build

# Production image with Nginx
FROM nginx:alpine

# Replace default server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled app
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
