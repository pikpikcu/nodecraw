
<h1 align="center">
  NODECRAW
  <br>
</h1>

Nodecraw is a command-line tool for advanced web crawling, suitable for bug bounty programs and general web scraping needs. It supports various crawling techniques and provides flexible options for customization.

# Features

- **Web Crawling Using Different Techniques:**
  - **PlaywrightCrawler**: Uses Playwright to navigate and crawl web pages.
  - **PuppeteerCrawler**: Uses Puppeteer to crawl web pages and extract data.
  - **CheerioCrawler**: Uses Cheerio for efficient and lightweight crawling.
  - **Crawler**: Uses the 'crawler' module to crawl web pages.
  - **Web Archive Crawler**: Retrieves archived versions of web pages from the Wayback Machine.

- **Recursive Crawling**: Enables crawling through links found on the web pages to discover and crawl more pages.

- **Iterative Crawling**: Automatically continue crawling URLs found in the current crawl session, useful for in-depth exploration.

- **Proxy Support**: Supports HTTP, HTTPS, SOCKS4, SOCKS5 proxies with optional proxy authentication.

- **Exclude File Extensions**: Option to exclude certain file types (e.g., images, videos, CSS) from the crawling results.

- **Output Customization**:
  - Specify the output file to save the crawled URLs.
  - Choose between different output formats: TXT or JSON.

- **Timeout Functionality**: Set a timeout duration to limit the crawling process.

- **Command-Line Interface (CLI)**: User-friendly and powerful command-line interface.

- **Support for stdin**: Accepts URLs via stdin for streamlined and automated workflows.

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
nodecraw -h
Usage: nodecraw [options]

Options:
  TARGET:
    -u, --url <url>                    Specify a single target URL
    -l, --list <file>                  Specify a list of target URLs
    -s, --scope <scope>                Specify the scope for crawling

  CONFIGURATION:
    -a, --aggressive <maxConcurrency>  Set the maximum concurrency for aggressive crawling
    -r, --recursive                    Enable recursive crawling
    -t, --timeout <timeout>            Specify the timeout duration
    -is, --ignore-ssl                  Ignore SSL certificate errors
    -fr, --force-redirect              Force redirection of URLs
    -ex, --exclude-ext <extensions>    Comma-separated list of file extensions to exclude (e.g., png,jpg,gif,css)
    -p, --proxy <proxy>                Specify a proxy server or a file containing a list of proxies
    -ap, --auth-proxy <auth>           Specify proxy authentication in the format username:password

  OUTPUT:
    -o, --output <file>                Specify the output file
    -json, --json-output               Output in JSON format with detailed information
    -ic, --iterate-crawl               Enable iterative crawling for URLs found in the current crawl
  -h, --help                         display help for command
```

### Crawling a Single URL
To crawl a single URL, use the `-u` or `--url` option followed by the target URL:
    
    nodecraw -u <target-url>
    
### Crawling from a List of URLs
To crawl multiple URLs from a list, use the `-l` or `--list` option followed by the path to the file containing the URLs:
    
    nodecraw -l <path-to-file>
    
This will crawl the URLs listed in the urls.txt file.

### Using stdin
You can pipe a list of URLs directly into `nodecraw` using stdin:

    cat urls.txt | nodecraw -a 30 -r -is -fr -o output.json -json -ic
    
This will accept the list of URLs from `urls.txt` and crawl them with the specified options.

### Using a Proxy
To use a proxy, specify the proxy URL using the `-p` or `--proxy` option:
    
    nodecraw -u <target-url> -p http://127.0.0.1:8080
    
You can also specify a list of proxies in a file and pass the file path to the `--proxy` option.

### Iterative Crawling
Enable iterative crawling using the `-ic` option to continue crawling URLs found during the current crawl:
    
    nodecraw -u <target-url> -ic
    
This will automatically crawl all the URLs discovered during the initial crawl.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
