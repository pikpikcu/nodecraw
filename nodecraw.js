#!/usr/bin/node

import { PlaywrightCrawler, Dataset } from 'crawlee';
import puppeteer from 'puppeteer';
import crawler from 'crawler';
import axios from 'axios';
import { program as commander } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { URL } from 'url';

commander
  .option('-u, --url <url>', 'Specify a single target URL')
  .option('-l, --list <file>', 'Specify a list of target URLs')
  .option('-t, --timeout <timeout>', 'Specify the timeout duration')
  .option('-o, --output <file>', 'Specify the output file')
  .parse(process.argv);

const { url, list, output, timeout } = commander.opts();

if (!url && !list) {
  console.error(chalk.red('Error: Please specify either a URL or a target list.'));
  commander.help();
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
      await enqueueLinks();
    },
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
            // console.error('Error:', error);
          }
        }
      };

      await crawl(targetUrl);

      await browser.close();
    } catch (error) {
      //console.error('Error:', error);
    }
  };

  // Crawler
  const crawlerCrawl = (targetUrl) => {
    const c = new crawler({
      maxConnections: 10,
      callback: function (error, res, done) {
        if (error) {
          console.error(chalk.red(`Crawler Error for ${targetUrl}:`));
          console.error(error);
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
      //console.error('Error:', error);
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
      await Promise.all([
        playwrightCrawler.run([targetUrl]),
        puppeteerCrawler(targetUrl),
        crawlerCrawl(targetUrl),
        webArchiveCrawler(targetUrl),
      ]);
    } else {
      //console.error(chalk.red('Error: Invalid URL.'));
      process.exit(1);
    }
  }
}

async function crawlUrls(urls) {
  for (const target of urls) {
    if (target.trim() !== '') {
      const targetUrl = target.startsWith('http') ? target : `http://${target}`;
      await crawlUrl(targetUrl);
    }
  }
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
  await crawlUrl(targetUrl);
}

if (list) {
  const urls = fs.readFileSync(list, 'utf-8').split('\n');
  crawlUrls(urls);
}

if (!process.stdin.isTTY) {
  readUrlsFromStdin()
    .then((urls) => crawlUrls(urls))
    .catch((error) => {
      console.error(chalk.red('Error:', error));
      process.exit(1);
    });
}