import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

// Initialize the Apify Actor
await Actor.init();

// Get username from input JSON
const input = await Actor.getInput();
const username = input?.username;

if (!username) {
    throw new Error('Please provide a "username" in the actor input JSON.');
}

const crawler = new PlaywrightCrawler({
    launchContext: { 
        launchOptions: { 
            headless: true 
        } 
    },
    
    async requestHandler({ page, log }) {
        log.info(`Scraping followers for: ${username}`);

        await page.goto(`https.www.instagram.com/${username}/`);

        // --- START NEW UPDATED POP-UP CODE ---
        try {
            log.info('Checking for cookie banner...');

            // Create locators for common cookie button texts
            const cookieButton1 = page.locator('button:has-text("Allow all cookies")');
            const cookieButton2 = page.locator('button:has-text("Accept All")');

            // Wait for one of them to be visible and click it
            await Promise.race([
                cookieButton1.click({ timeout: 7000 }), // 7 second timeout
                cookieButton2.click({ timeout: 7000 })
            ]);
            
            log.info('Successfully closed cookie banner.');
            await page.waitForTimeout(1000); // Wait for banner to fade
        } catch (e) {
            log.warning('Cookie banner not found or click failed. This is
             OK if the banner did not appear.');
        }
        // --- END NEW UPDATED POP-UP CODE ---

        try {
            // Click the link to the followers modal
            await page.click('a[href$="/followers/"]', { timeout: 10000 });
            log.info('Clicked followers link.');

            // Wait for the modal dialog to appear
            const dialogSelector = 'div[role="dialog"]';
            await page.waitForSelector(dialogSelector, { timeout: 10000 });
            log.info('Followers modal is visible.');

            // Wait for the list within the modal to be populated
            const listSelector = `${dialogSelector} ul`;
            await page.waitForSelector(listSelector, { timeout: 5000 });
            
            let modalBody;
            try {
                // Try a common selector for the scrollable area
                modalBody = await page.waitForSelector('div._aano', { timeout: 5000 });
            } catch (e) {
                log.warning('Could not find specific scrollable container "div._aano", falling back to dialog role. Scrolling might be less reliable.');
                modalBody = await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
            }

            // Scroll to load all followers (up to a limit)
            let previousHeight = 0;
            const maxScrolls = 50; // Limit scrolls
            log.info(`Starting scrolling, max ${maxScrolls} scrolls...`);

            for (let i = 0; i < maxScrolls; i++) {
                const currentHeight = await modalBody.evaluate(el => el.scrollHeight);
                
                if (currentHeight === previousHeight && i > 0) {
                    log.info(`Scrolling stopped after ${i} iterations as height did not change.`);
                    break;
                }
                
                previousHeight = currentHeight;
                await modalBody.evaluate(el => el.scrollBy(0, el.scrollHeight)); // Scroll to the bottom
                await page.waitForTimeout(1500); // Wait for new content to load

                if (i === maxScrolls - 1) {
                    log.warning(`Reached max scroll limit of ${maxScrolls}. Results may be partial.`);
                }
            }

            // Extract usernames from the modal
            const followerUsernames = await page.$$eval(
                'div[role="dialog"] ul li a[role="link"] span[dir="auto"]', 
                nodes => nodes.map(n => n.textContent).filter(Boolean)
            );

            // Save all found usernames to the dataset
            const dataToPush = followerUsernames.map(u => ({ username: u, scrapedFrom: username }));
            await Dataset.pushData(dataToPush);

            log.info(`Successfully scraped and saved ${followerUsernames.length} followers for @${username}`);

        } catch (error) {
            log.error(`Failed to scrape @${username}. The profile might be private, banned, or the UI might have changed.`);
            log.error(error);
        }
    }
});

// Add the single URL to the queue and run the crawler
await crawler.run([`https://www.instagram.com/${username}/`]);

// Gracefully exit the Actor
await Actor.exit();
