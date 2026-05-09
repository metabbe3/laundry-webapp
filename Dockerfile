FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install

# Copy prisma schema and config for generate
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# Copy source and generate Prisma client
COPY . .
ENV DATABASE_URL="mysql://root:laundry@db:3306/laundry_db"
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
