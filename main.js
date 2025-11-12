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
    // We are increasing the timeout because we are adding more steps
    // and Instagram can be slow.
    navigationTimeout: 60000, // 60 seconds
    launchContext: { 
        launchOptions: { 
            headless: true 
        } 
    },
    
    async requestHandler({ page, log }) {
        log.info(`Scraping followers for: ${username}`);

        await page.goto(`https://www.instagram.com/${username}/`);

        // --- ROBUST POP-UP & BLOCKER HANDLING ---
        try {
            log.info('Checking for any pop-ups (cookie, login, etc.)...');
            
            // These are the most common "blocker" buttons.
            const cookieButton1 = page.locator('button:has-text("Allow all cookies")');
            const cookieButton2 = page.locator('button:has-text("Accept All")');
            const loginModalClose = page.locator('div[role="dialog"] [aria-label="Close"]');

            // We will wait up to 10 seconds for *any* of these to appear.
            // If one appears, we click it. If not, we continue.
            await Promise.race([
                cookieButton1.click({ timeout: 10000 }),
                cookieButton2.click({ timeout: 10000 }),
                loginModalClose.click({ timeout: 10000 })
            ]);
            
            log.info('A pop-up was found and closed.');
            await page.waitForTimeout(1500); // Wait for modal to disappear
        } catch (e) {
            log.warning('No pop-ups were found or clicked. This is OK if none appeared.');
        }

        // --- BOT DETECTION / LOGIN WALL CHECK ---
        // After handling pop-ups, we check if we are on a login wall.
        // If we can see the "Sign up" link, it means Instagram has blocked us.
        const isLoginWall = await page.locator('a[href*="/accounts/signup/"]').isVisible();
        if (isLoginWall) {
            throw new Error(`Instagram is blocking the scraper with a "Login Wall". The scraper cannot see the profile. Try again later or with a proxy.`);
        }
        log.info('Not a login wall, proceeding...');
        
        // --- END OF NEW LOGIC ---

        try {
            // Click the link to the followers modal
            log.info('Attempting to click followers link...');
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
                // This is the class for the scrollable area
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
                // This selector targets the username text inside the list
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
