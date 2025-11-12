# Use the official Apify base image for Node.js 20 AND Playwright/Chrome
FROM apify/actor-node-playwright-chrome:20

# Copy the package.json and install npm dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the source code
COPY . ./

# Define the command to run when the actor starts
CMD ["npm", "start"]
