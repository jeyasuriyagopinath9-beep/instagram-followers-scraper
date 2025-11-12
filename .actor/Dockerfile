# Use the official Apify base image for Node.js 20
FROM apify/actor-node:20

# Copy the package.json and install npm dependencies
COPY package.json ./
RUN npm install

# Install Playwright browsers and their system dependencies
# This is the new line that fixes the browser error
RUN npx playwright install --with-deps chromium

# Copy the rest of the source code
COPY . ./

# Define the command to run when the actor starts
CMD ["npm", "start"]
