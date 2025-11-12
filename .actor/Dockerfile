# Use the official Apify base image for Node.js 20 AND Playwright/Chromium
FROM apify/actor-node-playwright-chromium:20

# Copy the package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the source code
COPY . ./

# Define the command to run when the actor starts
CMD ["npm", "start"]
