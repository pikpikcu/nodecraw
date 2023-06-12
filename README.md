# NodeCraw (Web Crawling Application)

NodeCraw is a web crawling application that allows you to crawl specified URLs and extract information from web pages. It utilizes various modules and libraries to perform crawling and save the results.

## Features

- Web crawling using different techniques:
  - PlaywrightCrawler: Uses Playwright to navigate and crawl web pages.
  - PuppeteerCrawler: Uses Puppeteer to crawl web pages and extract data.
  - Crawler: Uses the 'crawler' module to crawl web pages.
  - Web Archive Crawler: Retrieves archived versions of web pages from the Wayback Machine.

- Support for recursive crawling: Enables crawling through links found on the web pages to discover and crawl more pages.

- Output customization:
  - Specify the output file to save the crawled URLs.
  - Choose different output formats: TXT or JSON.

- Timeout functionality: Set a timeout duration to limit the crawling process.

- Command-line interface (CLI) for easy usage.

## Installation

1. Clone the repository:

   ```shell
   git clone https://github.com/pikpikcu/nodecraw.git
   ```
2. Navigate to the project directory:

    ```
    cd nodecraw
    ```
3. Install the dependencies:
    ```
    npm install
    ```
## Usage
To start crawling, you can use the following command:
You can also use the following options:
```
node nodecraw.js -h
Usage: nodecraw [options]

Options:
  -u, --url <url>                    Specify a single target URL
  -l, --list <file>                  Specify a list of target URLs
  -a, --aggressive <maxConcurrency>  Set the maximum concurrency for aggressive crawling
  -r, --recursive                    Enable recursive crawling
  -t, --timeout <timeout>            Specify the timeout duration
  -o, --output <file>                Specify the output file
  -h, --help                         display help for command
```
### Crawling a Single URL
To crawl a single URL, use the `-u` or `--url` option followed by the target URL:

    
    node nodecraw.js -u <target-url>
    
    
## Crawling from a List of URLs
To crawl multiple URLs from a list, use the `-l` or `--list` option followed by the path to the file containing the URLs:

    
    node nodecraw.js -l <path-to-file>
    
    
This will crawl the URLs listed in the urls.txt file.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
