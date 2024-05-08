# Init
FROM node:alpine
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm install

# Setup non-root user
ARG user_id=1125
RUN addgroup -g ${user_id} -S orthoapp && adduser -u ${user_id} -S -G orthoapp orthoapp

USER orthoapp

# Run the application
CMD ["npm", "start"]
