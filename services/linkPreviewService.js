const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

class LinkPreviewService {
  // Extract metadata from a URL
  static async getLinkPreview(linkUrl) {
    try {
      // Validate URL
      const parsedUrl = url.parse(linkUrl);
      if (!parsedUrl.protocol || !parsedUrl.hostname) {
        throw new Error('Invalid URL');
      }

      // Set timeout and user agent
      const config = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      };

      const response = await axios.get(linkUrl, config);
      const html = response.data;
      const $ = cheerio.load(html);

      // Extract metadata
      const metadata = {
        url: linkUrl,
        title: this.extractTitle($),
        description: this.extractDescription($),
        image: this.extractImage($, linkUrl),
        siteName: this.extractSiteName($),
        type: this.extractType($),
        favicon: this.extractFavicon($, linkUrl),
        domain: parsedUrl.hostname,
      };

      // Clean up metadata
      Object.keys(metadata).forEach(key => {
        if (metadata[key] && typeof metadata[key] === 'string') {
          metadata[key] = metadata[key].trim();
        }
      });

      return metadata;
    } catch (error) {
      console.error('Error fetching link preview:', error.message);
      // Return basic metadata for failed requests
      return {
        url: linkUrl,
        title: 'Link Preview Unavailable',
        description: 'Unable to fetch preview for this link',
        error: true,
      };
    }
  }

  static extractTitle($) {
    // Try Open Graph title first
    let title = $('meta[property="og:title"]').attr('content');
    if (title) return title;

    // Try Twitter title
    title = $('meta[name="twitter:title"]').attr('content');
    if (title) return title;

    // Try standard title
    title = $('title').text();
    if (title) return title;

    // Try h1 tag
    title = $('h1').first().text();
    if (title) return title;

    return 'No Title';
  }

  static extractDescription($) {
    // Try Open Graph description
    let description = $('meta[property="og:description"]').attr('content');
    if (description) return description;

    // Try Twitter description
    description = $('meta[name="twitter:description"]').attr('content');
    if (description) return description;

    // Try meta description
    description = $('meta[name="description"]').attr('content');
    if (description) return description;

    // Try first paragraph
    description = $('p').first().text();
    if (description && description.length > 200) {
      description = description.substring(0, 200) + '...';
    }

    return description || 'No description available';
  }

  static extractImage($, baseUrl) {
    // Try Open Graph image
    let image = $('meta[property="og:image"]').attr('content');
    if (image) return this.resolveUrl(image, baseUrl);

    // Try Twitter image
    image = $('meta[name="twitter:image"]').attr('content');
    if (image) return this.resolveUrl(image, baseUrl);

    // Try schema.org image
    image = $('meta[itemprop="image"]').attr('content');
    if (image) return this.resolveUrl(image, baseUrl);

    // Try first img tag
    const firstImg = $('img').first().attr('src');
    if (firstImg) return this.resolveUrl(firstImg, baseUrl);

    return null;
  }

  static extractSiteName($) {
    // Try Open Graph site name
    let siteName = $('meta[property="og:site_name"]').attr('content');
    if (siteName) return siteName;

    // Try application name
    siteName = $('meta[name="application-name"]').attr('content');
    if (siteName) return siteName;

    return null;
  }

  static extractType($) {
    // Try Open Graph type
    const type = $('meta[property="og:type"]').attr('content');
    return type || 'website';
  }

  static extractFavicon($, baseUrl) {
    // Try various favicon selectors
    let favicon = $('link[rel="icon"]').attr('href');
    if (favicon) return this.resolveUrl(favicon, baseUrl);

    favicon = $('link[rel="shortcut icon"]').attr('href');
    if (favicon) return this.resolveUrl(favicon, baseUrl);

    favicon = $('link[rel="apple-touch-icon"]').attr('href');
    if (favicon) return this.resolveUrl(favicon, baseUrl);

    // Default favicon
    return `${url.parse(baseUrl).protocol}//${url.parse(baseUrl).hostname}/favicon.ico`;
  }

  static resolveUrl(href, baseUrl) {
    if (!href) return null;

    // If it's already an absolute URL, return as is
    if (href.match(/^https?:\/\//i)) {
      return href;
    }

    // If it starts with //, add protocol
    if (href.startsWith('//')) {
      return `https:${href}`;
    }

    // Resolve relative URL
    try {
      return url.resolve(baseUrl, href);
    } catch (error) {
      return null;
    }
  }

  // Cache link previews (simple in-memory cache)
  static cache = new Map();
  static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static async getCachedLinkPreview(url) {
    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    const preview = await this.getLinkPreview(url);
    this.cache.set(url, {
      data: preview,
      timestamp: Date.now(),
    });

    return preview;
  }

  // Extract URLs from text
  static extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  // Get previews for multiple URLs
  static async getMultiplePreviews(urls) {
    const previews = [];
    for (const url of urls.slice(0, 3)) { // Limit to 3 URLs per text
      try {
        const preview = await this.getCachedLinkPreview(url);
        previews.push(preview);
      } catch (error) {
        console.error(`Error getting preview for ${url}:`, error);
      }
    }
    return previews;
  }
}

module.exports = LinkPreviewService;