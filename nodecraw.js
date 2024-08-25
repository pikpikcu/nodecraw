#!/usr/local/bin/node

import { PlaywrightCrawler, LogLevel, Log, Dataset, CheerioCrawler, ProxyConfiguration } from 'crawlee';
import puppeteer from 'puppeteer';
import crawler from 'crawler';
import axios from 'axios';

// Import CommonJS modules properly
import HttpsProxyAgentModule from 'https-proxy-agent';
import SocksProxyAgentModule from 'socks-proxy-agent';
import { program as commander } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { URL } from 'url';
import readline from 'readline';

const { HttpsProxyAgent } = HttpsProxyAgentModule;
const { SocksProxyAgent } = SocksProxyAgentModule;

const log = new Log({ level: LogLevel.OFF });

commander
  .option('TARGET')
  .option('-u, --url <url>', 'Specify a single target URL')
  .option('-l, --list <file>', 'Specify a list of target URLs')
  .option('-s, --scope <scope>', 'Specify the scope for crawling')
  .option('CONFIGURATION')
  .option('-a, --aggressive <maxConcurrency>', 'Set the maximum concurrency for aggressive crawling', parseInt)
  .option('-r, --recursive', 'Enable recursive crawling')
  .option('-t, --timeout <timeout>', 'Specify the timeout duration', parseInt)
  .option('-is, --ignore-ssl', 'Ignore SSL certificate errors')
  .option('-fr, --force-redirect', 'Force redirection of URLs')
  .option('-ex, --exclude-ext <extensions>', 'Comma-separated list of file extensions to exclude (e.g., png,jpg,gif,css)')
  .option('-p, --proxy <proxy>', 'Specify a proxy server or a file containing a list of proxies')
  .option('-ap, --auth-proxy <auth>', 'Specify proxy authentication in the format username:password')
  .option('OUTPUT')
  .option('-o, --output <file>', 'Specify the output file')
  .option('-json, --json-output', 'Output in JSON format with detailed information')
  .option('-ic, --iterate-crawl', 'Enable iterative crawling for URLs found in the current crawl')
  .parse(process.argv);

const { url, list, output, timeout, recursive, aggressive, ignoreSsl, forceRedirect, scope, excludeExt, jsonOutput, proxy, authProxy, iterateCrawl } = commander.opts();
const maxConcurrency = aggressive || 5;

if (ignoreSsl) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore SSL certificate errors
}

const excludedExtensions = excludeExt ? excludeExt.split(',').map(ext => ext.trim().toLowerCase()) : [];

let proxyList = [];
if (proxy) {
  if (fs.existsSync(proxy)) {
    proxyList = fs.readFileSync(proxy, 'utf-8').split('\n').filter(line => line.trim());
  } else {
    try {
      new URL(proxy);
      proxyList = [proxy];
    } catch (error) {
      console.error(chalk.red('Error: Invalid proxy URL format.'));
      process.exit(1);
    }
  }
}

function getRandomProxy() {
  if (proxyList.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * proxyList.length);
  return proxyList[randomIndex];
}

function createProxyAgent(proxyUrl) {
  let agent;
  const parsedUrl = new URL(proxyUrl);

  if (authProxy) {
    parsedUrl.username = authProxy.split(':')[0];
    parsedUrl.password = authProxy.split(':')[1];
  }

  switch (parsedUrl.protocol) {
    case 'socks4:':
    case 'socks5:':
      agent = new SocksProxyAgent(parsedUrl.href);
      break;
    case 'http:':
    case 'https:':
      agent = new HttpsProxyAgent(parsedUrl.href);
      break;
    default:
      console.error(chalk.red(`Unsupported proxy protocol: ${parsedUrl.protocol}`));
      process.exit(1);
  }
  
  return agent;
}

function isUrlInScope(targetUrl, scope) {
  const url = new URL(targetUrl);
  const domainPattern = scope.replace(/\./g, '\\.').replace(/\*/g, '.*');
  const regex = new RegExp(`^${domainPattern}$`);

  const isMatch = regex.test(url.hostname);
  const baseDomain = scope.replace(/^\*\./, '');
  const isBaseDomain = url.hostname === baseDomain;

  return isMatch || isBaseDomain;
}

function hasExcludedExtension(targetUrl, excludedExtensions) {
  const url = new URL(targetUrl);
  const ext = url.pathname.split('.').pop().toLowerCase();
  return excludedExtensions.includes(ext);
}

function generateJsonOutput(targetUrl) {
  const url = new URL(targetUrl);
  return {
    timestamp: new Date().toISOString(),
    url: targetUrl,
    path: url.pathname,
    host: url.hostname,
    port: url.port || (url.protocol === 'https:' ? '443' : '80')
  };
}

function writeJsonOutput(data) {
  if (!output || !jsonOutput) {
    return;
  }

  try {
    const formattedData = JSON.stringify(data, null, 2);
    fs.writeFileSync(output, formattedData);
  } catch (error) {
    console.error(chalk.red('Error:', error.message));
    process.exit(1);
  }
}

const IGNORED_ERRORS = [
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "INFO  Statistics: null request statistics",
  "connect ECONNREFUSED",
  "ETIMEDOUT when fetching",
  "ERR_CONNECTION_REFUSED",
  "ERR_CERT_COMMON_NAME_INVALID",
  "null request statistics",
];

function shouldIgnoreError(message) {
  return IGNORED_ERRORS.some(ignoredError => message.includes(ignoredError));
}

async function crawlUrl(targetUrl, jsonData, depth = 1) {
  if (scope && !isUrlInScope(targetUrl, scope)) {
    console.log(chalk.yellow(`Skipping URL outside of scope: ${targetUrl}`));
    return;
  }

  if (hasExcludedExtension(targetUrl, excludedExtensions)) {
    console.log(chalk.yellow(`Skipping URL with excluded extension: ${targetUrl}`));
    return;
  }

  const proxyUrl = getRandomProxy();
  const proxyAgent = proxyUrl ? createProxyAgent(proxyUrl) : undefined;
  const proxyConfiguration = proxyUrl ? new ProxyConfiguration({ proxyUrls: proxyList }) : undefined;

  const extractedUrls = [];

  const requestHandler = async ({ request, enqueueLinks }) => {
    try {
      if (isUrlInScope(request.loadedUrl, scope) && !hasExcludedExtension(request.loadedUrl, excludedExtensions)) {
        console.log(request.loadedUrl);
        const jsonOutputData = generateJsonOutput(request.loadedUrl);
        jsonData.push(jsonOutputData);
        if (output && !jsonOutput) {
          fs.appendFileSync(output, `${request.loadedUrl}\n`);
        }
        if (recursive) {
          await enqueueLinks();
        }
        extractedUrls.push(request.loadedUrl);
      }
    } catch (error) {
      if (!shouldIgnoreError(error.message)) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    }
  };

  const crawlerOptions = {
    requestHandler,
    proxyConfiguration: proxyConfiguration,
    log: log,
    maxConcurrency: maxConcurrency,
  };

  const playwrightCrawler = new PlaywrightCrawler(crawlerOptions);
  const cheerioCrawler = new CheerioCrawler(crawlerOptions);

  const puppeteerCrawler = async (targetUrl) => {
    try {
      const browser = await puppeteer.launch({ headless: "new", ignoreHTTPSErrors: ignoreSsl, args: proxyUrl ? [`--proxy-server=${proxyUrl}`] : [] });
      const page = await browser.newPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });

      const baseUrl = new URL(targetUrl);
      const crawledURLs = new Set();

      const crawl = async (currentUrl) => {
        try {
          if (hasExcludedExtension(currentUrl, excludedExtensions)) {
            console.log(chalk.yellow(`Skipping URL with excluded extension: ${currentUrl}`));
            return;
          }

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
            const url = new URL(link, baseUrl.href);
            if (isUrlInScope(url.href, scope) && !crawledURLs.has(url.href) && !hasExcludedExtension(url.href, excludedExtensions)) {
              crawledURLs.add(url.href);
              console.log(url.href);
              const jsonOutputData = generateJsonOutput(url.href);
              jsonData.push(jsonOutputData);
              extractedUrls.push(url.href);

              if (url.pathname !== '/' && !url.pathname.endsWith('/')) {
                await crawl(url.href);
              }
            }
          }
        } catch (error) {
          if (!shouldIgnoreError(error.message)) {
            console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
          }
        }
      };

      await crawl(targetUrl);
      await browser.close();
    } catch (error) {
      if (!shouldIgnoreError(error.message)) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    }
  };

  const crawlerCrawl = (targetUrl) => {
    const c = new crawler({
      maxConnections: 10,
      proxy: proxyUrl,
      callback: function (error, res, done) {
        try {
          if (error) {
            if (!shouldIgnoreError(error.message)) {
              console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
            }
          } else {
            const $ = res.$;
            if (isUrlInScope(res.request.uri.href, scope) && !hasExcludedExtension(res.request.uri.href, excludedExtensions)) {
              console.log(chalk.white(`${res.request.uri.href}`));
              const jsonOutputData = generateJsonOutput(res.request.uri.href);
              jsonData.push(jsonOutputData);
              extractedUrls.push(res.request.uri.href);

              if (output && !jsonOutput) {
                fs.appendFileSync(output, `${res.request.uri.href}\n`);
              }
            }
          }
        } catch (err) {
          if (!shouldIgnoreError(error.message)) {
            console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
          }
        } finally {
          done();
        }
      },
    });
    c.queue(targetUrl);
  };

  const webArchiveCrawler = async (targetUrl) => {
    try {
      const webArchiveUrl = `https://web.archive.org/cdx/search/cdx?url=${targetUrl}/*&output=text&fl=original&collapse=urlkey`;
      const response = await axios.get(webArchiveUrl, { httpsAgent: proxyAgent });
      const urls = response.data.split('\n').filter((url) => url.startsWith('http') && isUrlInScope(url, scope) && !hasExcludedExtension(url, excludedExtensions));
      for (const url of urls) {
        console.log(url);
        const jsonOutputData = generateJsonOutput(url);
        jsonData.push(jsonOutputData);
        extractedUrls.push(url);
        if (output && !jsonOutput) {
          fs.appendFileSync(output, `${url}\n`);
        }
      }
    } catch (error) {
      if (!shouldIgnoreError(error.message)) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    }
  };

  if (timeout) {
    setTimeout(async () => {
      console.log(chalk.yellow('Timeout reached.'));
      if (jsonOutput) {
        writeJsonOutput(jsonData);
      }
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

        if (jsonOutput) {
          writeJsonOutput(jsonData);
        }

        // If iterative crawling is enabled, recursively crawl found URLs
        if (iterateCrawl && extractedUrls.length > 0 && depth < 3) { // Limit depth to prevent infinite loops
          console.log(chalk.green(`Iterative crawling ${extractedUrls.length} URLs found on depth ${depth}...`));
          for (const foundUrl of extractedUrls) {
            await crawlUrl(foundUrl, jsonData, depth + 1);
          }
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
  const jsonData = [];

  for (const target of urls) {
    if (target.trim() !== '') {
      const targetUrl = target.startsWith('http') ? target : `http://${target}`;
      try {
        await crawlUrl(targetUrl, jsonData);
      } catch (error) {
        console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      }
    }
  }

  if (jsonOutput) {
    writeJsonOutput(jsonData);
  }
}

async function readUrlsFromStdin() {
  const urls = [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  for await (const line of rl) {
    urls.push(line.trim());
  }

  return urls;
}

async function main() {
  if (url) {
    const targetUrl = url.startsWith('http') ? url : `http://${url}`;
    const jsonData = [];
    try {
      await crawlUrl(targetUrl, jsonData);
      if (jsonOutput) {
        writeJsonOutput(jsonData);
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      process.exit(1);
    }
  } else if (list) {
    try {
      const urls = fs.readFileSync(list, 'utf-8').split('\n');
      await crawlUrls(urls);
    } catch (error) {
      console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    try {
      const urls = await readUrlsFromStdin();
      await crawlUrls(urls);
    } catch (error) {
      console.error(chalk.red('Error:', error.response ? error.response.statusText : error.message));
      process.exit(1);
    }
  } else {
    console.error(chalk.red('Error: No input provided. Please provide a URL, list, or input via stdin.'));
    process.exit(1);
  }
}

main();
