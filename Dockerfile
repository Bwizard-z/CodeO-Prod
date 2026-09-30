# Stage 1: Build the frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies across monorepo workspaces
RUN npm install

# Copy source files
COPY . .

# Build optimized production frontend (into frontend/dist)
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY backend/package*.json ./backend/

# Install production dependencies for backend
RUN npm install --prefix backend --omit=dev

# Copy backend source and compiled frontend dist
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["node", "backend/server.js"]
