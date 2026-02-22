FROM node:20-slim

# Install PM2 globally
RUN npm install pm2 -g

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose ports: 4000 (API), 8081-8083 (WS shards)
EXPOSE 4000 8081 8082 8083

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
