FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 3006

# Create directories for sessions and logs (will be mounted as volumes)
RUN mkdir -p /app/sessions /app/logs

# Start the application
CMD ["pnpm", "start"]

