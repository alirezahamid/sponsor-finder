# Dockerfile
FROM node:latest

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY prisma ./prisma

# Install dependencies using pnpm
RUN pnpm install

# Generate Prisma Client
RUN pnpm prisma:generate

# Copy app source code
COPY . .

# Expose the application port
EXPOSE 8888

# Run the application
CMD ["pnpm", "start:prod"]
