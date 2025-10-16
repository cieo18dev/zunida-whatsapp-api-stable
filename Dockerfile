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

# Create directory for sessions (will be mounted as volume)
RUN mkdir -p /app/sessions

# Start the application
CMD ["pnpm", "start"]

