# Use a specific Node.js version
FROM node:20-alpine

# Set the working directory inside the container to /app/backend
WORKDIR /app/backend

# Explicitly copy the prisma directory from the build context
# This assumes 'prisma' directory is directly under 'backend' on your host
COPY prisma ./prisma

# Verify it was copied by listing its contents
RUN ls -l ./prisma/
RUN ls -l ./prisma/schema.prisma

# Copy package.json and package-lock.json (needed for npm ci)
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Now, try to run prisma generate (should find schema.prisma at ./prisma/schema.prisma)
RUN npx prisma generate

# Copy the rest of the application source code (optional for this test, but good for full build)
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Default command to run the application (for production/after build)
CMD ["npm", "run", "build", "&&", "npx", "prisma", "migrate", "deploy", "&&", "npm", "start"]