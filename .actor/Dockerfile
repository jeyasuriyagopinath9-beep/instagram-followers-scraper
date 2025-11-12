# Use the official Apify base image for Node.js AND Playwright/Chromium
FROM apify/actor-node-playwright-chromium

# Copy the package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the source code
COPY . ./

# Define the command to run when the actor starts
CMD ["npm", "start"]
