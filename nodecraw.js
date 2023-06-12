#!/usr/local/bin/node

import { PlaywrightCrawler, LogLevel, Log, Dataset, CheerioCrawler } from 'crawlee';
import puppeteer from 'puppeteer';
import crawler from 'crawler';
import axios from 'axios';
import { program as commander } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { URL } from 'url';

const log = new Log({ level: LogLevel.OFF });

commander
  .option('-u, --url <url>', 'Specify a single target URL')
  .option('-l, --list <file>', 'Specify a list of target URLs')
  .option('-a, --aggressive <maxConcurrency>', 'Set the maximum concurrency for aggressive crawling', parseInt)
  .option('-r, --recursive', 'Enable recursive crawling')
  .option('-t, --timeout <timeout>', 'Specify the timeout duration')
  .option('-o, --output <file>', 'Specify the output file')
  .parse(process.argv);

const { url, list, output, timeout, recursive, aggressive } = commander.opts();
const maxConcurrency = aggressive || 5;

if (!url && !list) {
  console.error(chalk.red('Error: Please specify either a URL or a target list.'));
  commander.help();
}

async function sortAndWriteOutput(data) {
  if (!output) {
    return;
  }

  let formattedData;

  try {
    formattedData = JSON.stringify([...new Set(data)], null, 2);
  } catch (error) {
    console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    return;
  }

  const fileExtension = output.slice(output.lastIndexOf('.') + 1);

  try {
    if (fileExtension === 'txt') {
      const sortedData = [...new Set(data)].sort();
      fs.writeFileSync(output, sortedData.join('\n'));
    } else if (fileExtension === 'json') {
      fs.writeFileSync(output, formattedData);
    } else {
      console.error(chalk.red('Error: Invalid output file extension.'));
    }
  } catch (error) {
    console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
  }
}

async function crawlUrl(targetUrl) {
  // PlaywrightCrawler
  const playwrightCrawler = new PlaywrightCrawler({
    async requestHandler({ request, enqueueLinks }) {
      console.log(request.loadedUrl);
      await Dataset.pushData({ url: request.loadedUrl });
      if (output) {
        fs.appendFileSync(output, `${request.loadedUrl}\n`);
      }
      if (recursive) {
        await enqueueLinks();
      }
    },
    log: log,
    maxConcurrency: maxConcurrency,
  });

  // CheerioCrawler
  const cheerioCrawler = new CheerioCrawler({
    async requestHandler({ request, response, $, enqueueLinks }) {
      console.log(request.uri.href);
      await Dataset.pushData({ url: request.uri.href });
      if (output) {
        fs.appendFileSync(output, `${request.uri.href}\n`);
      }
      await enqueueLinks();
    },
    log: log,
    maxConcurrency: maxConcurrency,
  });

  // Puppeteer
  const puppeteerCrawler = async (targetUrl) => {
    try {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });

      const baseUrl = new URL(targetUrl);
      const crawledURLs = new Set();

      // Recursive crawl
      const crawl = async (currentUrl) => {
        await page.goto(currentUrl, { waitUntil: 'networkidle2' });

        const links = await page.$$eval('a, img, [href], [src]', (elements) => {
          return elements.map((element) => {
            if (element.tagName === 'A') {
              return element.href;
            } else if (element.tagName === 'IMG') {
              return element.src;
            } else {
              const href = element.getAttribute('href');
              const src = element.getAttribute('src');
              return href || src;
            }
          });
        });

        for (const link of links) {
          try {
            const url = new URL(link, baseUrl.href);
            if (url.hostname === baseUrl.hostname && !crawledURLs.has(url.href)) {
              crawledURLs.add(url.href);
              console.log(url.href);

              if (url.pathname !== '/' && !url.pathname.endsWith('/')) {
                await crawl(url.href);
              }
            }
          } catch (error) {
            console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
          }
        }
      };

      await crawl(targetUrl);

      await browser.close();
    } catch (error) {
      console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    }
  };

  // Crawler
  const crawlerCrawl = (targetUrl) => {
    const c = new crawler({
      maxConnections: 10,
      callback: function (error, res, done) {
        if (error) {
          console.error(chalk.red(`Crawler Error for ${targetUrl}:`));
          console.error(error.response ? error.response.statusText : error.message);
        } else {
          const $ = res.$;
          console.log(chalk.white(`${res.request.uri.href}`));

          if (output) {
            fs.appendFileSync(output, `${res.request.uri.href}\n`);
            fs.appendFileSync(output, '\n');
          }
        }
        done();
      },
    });
    c.queue(targetUrl);
  };

  // Web Archive
  const webArchiveCrawler = async (targetUrl) => {
    try {
      const webArchiveUrl = `https://web.archive.org/cdx/search/cdx?url=${targetUrl}/*&output=text&fl=original&collapse=urlkey`;
      const response = await axios.get(webArchiveUrl);
      const urls = response.data.split('\n').filter((url) => url.startsWith('http'));
      for (const url of urls) {
        console.log(url);
        if (output) {
          fs.appendFileSync(output, `${url}\n`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    }
  };

  if (timeout) {
    setTimeout(async () => {
      console.log(chalk.yellow('Timeout reached.'));
      process.exit(0);
    }, timeout * 1000);
  }

  if (targetUrl) {
    if (targetUrl.startsWith('http')) {
      try {
        if (recursive) {
          await Promise.all([
            playwrightCrawler.run([targetUrl]),
            puppeteerCrawler(targetUrl),
            crawlerCrawl(targetUrl),
            webArchiveCrawler(targetUrl),
          ]);
        } else {
          await Promise.all([
            cheerioCrawler.run([targetUrl]),
            puppeteerCrawler(targetUrl),
            crawlerCrawl(targetUrl),
            webArchiveCrawler(targetUrl),
          ]);
        }
      } catch (error) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    } else {
      console.error(chalk.red('Error: Invalid URL.'));
      process.exit(1);
    }
  }
}

async function crawlUrls(urls) {
  const data = [];

  for (const target of urls) {
    if (target.trim() !== '') {
      const targetUrl = target.startsWith('http') ? target : `http://${target}`;
      try {
        await crawlUrl(targetUrl);
        data.push(targetUrl);
      } catch (error) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    }
  }

  await sortAndWriteOutput(data);
}

async function readUrlsFromStdin() {
  const urls = [];
  for await (const chunk of process.stdin) {
    urls.push(chunk.toString().trim());
  }
  return urls;
}

if (url) {
  const targetUrl = url.startsWith('http') ? url : `http://${url}`;
  try {
    await crawlUrl(targetUrl);
    await sortAndWriteOutput([targetUrl]);
  } catch (error) {
    console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    process.exit(1);
  }
}

if (list) {
  try {
    const urls = fs.readFileSync(list, 'utf-8').split('\n');
    await crawlUrls(urls);
  } catch (error) {
    console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    process.exit(1);
  }
}

if (!process.stdin.isTTY) {
  try {
    const urls = await readUrlsFromStdin();
    await crawlUrls(urls);
  } catch (error) {
    console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
    process.exit(1);
  }
}
