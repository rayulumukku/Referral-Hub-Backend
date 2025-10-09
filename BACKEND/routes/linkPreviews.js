const express = require('express');
const LinkPreviewService = require('../services/linkPreviewService');
const auth = require('../middleware/auth');

const router = express.Router();

// Get link preview for a URL
router.post('/preview', auth, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Validate URL format
    const urlRegex = /^https?:\/\/.+/i;
    if (!urlRegex.test(url)) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    const preview = await LinkPreviewService.getCachedLinkPreview(url);
    res.json(preview);
  } catch (error) {
    console.error('Error getting link preview:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get multiple link previews
router.post('/previews', auth, async (req, res) => {
  try {
    const { urls } = req.body;

    if (!Array.isArray(urls)) {
      return res.status(400).json({ message: 'URLs must be an array' });
    }

    if (urls.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 URLs allowed' });
    }

    const previews = await LinkPreviewService.getMultiplePreviews(urls);
    res.json({ previews });
  } catch (error) {
    console.error('Error getting link previews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Extract URLs from text and get previews
router.post('/extract-and-preview', auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.json({ previews: [] });
    }

    const urls = LinkPreviewService.extractUrls(text);
    if (urls.length === 0) {
      return res.json({ previews: [] });
    }

    const previews = await LinkPreviewService.getMultiplePreviews(urls);
    res.json({ previews });
  } catch (error) {
    console.error('Error extracting and previewing links:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;