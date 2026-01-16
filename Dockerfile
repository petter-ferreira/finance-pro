FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Create uploads directory in case it's missing
RUN mkdir -p uploads

# Expose port (must match your app's port)
EXPOSE 3000

# Environment variables (can be overridden at runtime)
# ENV PORT=3000

# Start the application
CMD ["npm", "start"]
