# Web Crawling Application

This is a Node.js application that allows you to perform web crawling on specified URLs. It utilizes various modules and libraries to crawl web pages, extract information, and save the results.

## Features

- Crawling using headless browsers (Playwright and Puppeteer)
- HTTP crawling with configurable options
- Integration with Web Archive for accessing archived URLs
- Saving crawled data to JSON files or outputting to the console
- Timeout feature to limit the crawling duration

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed on your system.
2. `npm i nodecraw -g`.

## Usage

To start crawling, you can use the following command:


Replace `<url>` with the target URL you want to crawl.

`nodecraw -h`

You can also use the following options:

- `-u, --url <url>`: Specify a single target URL.
- `-l, --list <file>`: Specify a list of target URLs from a file.
- `-o, --output <file>`: Specify the output file to save the crawled URLs.
- `-t, --timeout <timeout>`: Specify the timeout duration in seconds.

For example, to crawl a list of URLs from a file and save the results to an output file, you can use the following command:

```
nodecraw -u example.com -o output.txt

```

```
nodecraw -l urls.txt -o output.txt
```

Make sure to replace `urls.txt` with the path to your file containing the list of URLs.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
