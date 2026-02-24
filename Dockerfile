# Multi-stage Dockerfile for OR Staff Planner
# Optimized for Azure Container Apps deployment

# ============================================
# Stage 1: Build the React frontend
# ============================================
FROM node:20-alpine AS frontend-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source code
COPY . .

# Build the React application with Vite
RUN npm run build

# ============================================
# Stage 2: Production image
# ============================================
FROM node:20-alpine AS production

# Install security updates
RUN apk update && apk upgrade

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy server files and API
COPY server.js ./
COPY api/ ./api/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Azure Container Apps will override this)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/hello', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
