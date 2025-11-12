import { PlaywrightCrawler, Dataset } from 'crawlee';

const input = await Dataset.getInput(); // Get input from Apify input JSON
const username = input?.username;

if (!username) throw new Error('Please provide "username" in input JSON.');

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: { headless: true },
    },
    async requestHandler({ page, log }) {
        log.info(`Scraping followers for: ${username}`);

        await page.goto(`https://www.instagram.com/${username}/`);

        // Open followers modal
        await page.click('a[href$="/followers/"]');
        await page.waitForSelector('div[role="dialog"] ul li');

        // Scroll to load followers
        let previousHeight = 0;
        for (let i = 0; i < 50; i++) { // scroll 50 times
            const modal = await page.$('div[role="dialog"] ul');
            const height = await modal.evaluate(el => el.scrollHeight);
            if (height === previousHeight) break; // stop if no more new followers
            previousHeight = height;
            await modal.evaluate(el => el.scrollBy(0, el.scrollHeight));
            await page.waitForTimeout(1000);
        }

        // Extract usernames
        const usernames = await page.$$eval('div[role="dialog"] ul li a', nodes =>
            nodes.map(n => n.textContent).filter(Boolean)
        );

        // Save to dataset
        for (const u of usernames) {
            await Dataset.pushData({ username: u });
        }

        log.info(`Scraped ${usernames.length} followers for @${username}`);
    }
});

await crawler.run();
