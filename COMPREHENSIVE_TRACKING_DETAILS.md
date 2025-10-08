# Comprehensive Post Tracking System

## Complete Data Tracking Documentation

This document details EVERY piece of data we track for posts, shares, clicks, and registrations in the referral chain system.

---

## 📊 Data Tracked at Post Creation

When a post is created, we track the **creator's initial view** with the following data:

### Device & Browser Information
- ✅ `device` - Type: desktop, mobile, tablet, smartphone
- ✅ `browser` - Name: Chrome, Firefox, Safari, Edge, etc.
- ✅ `browserVersion` - Version number (e.g., 120.0)
- ✅ `userAgent` - Complete user agent string
- ✅ `os` - Operating system: Windows, macOS, iOS, Android, Linux
- ✅ `osVersion` - OS version (e.g., Windows 11, macOS 14.1, iOS 17.2)
- ✅ `deviceModel` - For mobile: iPhone 14 Pro, Samsung Galaxy S23, etc.

### Screen & Display
- ✅ `screenSize.width` - Physical screen width in pixels
- ✅ `screenSize.height` - Physical screen height in pixels
- ✅ `viewport.width` - Browser viewport width
- ✅ `viewport.height` - Browser viewport height
- ✅ `colorScheme` - User preference: light or dark mode
- ✅ `touchSupport` - Whether device supports touch

### Network Information
- ✅ `networkInfo.connectionType` - Connection type from device
- ✅ `networkInfo.effectiveType` - Effective connection: slow-2g, 2g, 3g, 4g, 5g
- ✅ `networkInfo.downlink` - Download speed in Mbps
- ✅ `networkInfo.rtt` - Round-trip time in milliseconds
- ✅ `networkInfo.saveData` - Data saver mode enabled/disabled

### Location Data
- ✅ `location.city` - City name
- ✅ `location.state` - State/province
- ✅ `location.country` - Country name
- ✅ `location.coordinates.latitude` - Latitude
- ✅ `location.coordinates.longitude` - Longitude
- ✅ `location.coordinates.accuracy` - GPS accuracy in meters
- ✅ `location.timezone` - Timezone (e.g., Asia/Kolkata, America/New_York)

### Session & Identity
- ✅ `ipAddress` - User's IP address (captured by backend)
- ✅ `sessionId` - Unique session identifier
- ✅ `language` - Browser language (e.g., en-US, hi-IN)
- ✅ `timestamp` - Exact date and time
- ✅ `isIncognito` - Whether browsing in incognito/private mode

---

## 🔗 Data Tracked on Share

When someone shares a post, we track ALL the above data PLUS:

### Share-Specific Data
- ✅ `platform` - Where shared: whatsapp, linkedin, twitter, facebook, telegram, instagram, email, sms, other
- ✅ `shareMethod` - How shared: native_share, copy_link, direct_platform
- ✅ `sharedTo` - Platform or contact identifier (if available)
- ✅ `fromLocation.page` - Which page they shared from
- ✅ `fromLocation.url` - Full URL where share happened
- ✅ `fromLocation.section` - Section of the page
- ✅ `fromLocation.referrer` - Document referrer
- ✅ `chainId` - Unique identifier for this referral chain
- ✅ `parentChainId` - If re-sharing, the parent chain ID

### All Device, Browser, Screen, Network, Location Data
(Same as post creation - all tracked again at share time)

---

## 👆 Data Tracked on Click

When someone clicks a referral link:

### Click-Specific Data
- ✅ `clickerId` - User ID if logged in, null if anonymous
- ✅ `referrerId` - User ID who shared the link
- ✅ `chainId` - Which chain this click belongs to
- ✅ `postId` - Which post was clicked

### All Device, Browser, Screen, Network, Location Data
(Captured at the moment of click - may be different from share if link traveled to different device/location)

---

## 🔐 Data Tracked on Registration/Login

When someone registers or logs in via a referral link:

### Registration-Specific Data
- ✅ `registrationType` - 'register' or 'login'
- ✅ `newUserId` - The newly registered/logged in user's ID
- ✅ `referrerId` - Who referred them
- ✅ `chainId` - Which chain they're joining
- ✅ `position` - Their position in the chain

### All Device, Browser, Screen, Network, Location Data
(Captured at registration time)

---

## 📈 Journey Map Tracking

For each link in the referral chain, we track the journey:

### From Location (Sharer)
- ✅ `from.userId` - Who shared
- ✅ `from.location.city/state/country` - Where they shared from
- ✅ `from.location.coordinates` - GPS coordinates
- ✅ `from.timestamp` - When they shared
- ✅ `from.platform` - Platform used (WhatsApp, etc.)
- ✅ `from.device` - Device used

### To Location (Receiver)
- ✅ `to.userId` - Who received
- ✅ `to.location.city/state/country` - Where they clicked from
- ✅ `to.location.coordinates` - GPS coordinates
- ✅ `to.timestamp` - When they clicked
- ✅ `to.platform` - Platform used
- ✅ `to.device` - Device used

### Journey Metrics
- ✅ `distance` - Distance in kilometers between sharer and receiver
- ✅ `travelTime` - Time taken in minutes from share to click
- ✅ `clicks` - Number of clicks on this link
- ✅ `views` - Number of views
- ✅ `shares` - Number of re-shares

---

## 💰 Data Tracked on Purchase/Conversion

When a product is purchased:

### Conversion Data
- ✅ `buyerId` - Who bought the product
- ✅ `buyerChainId` - Which chain the buyer is in
- ✅ `conversionValue` - Purchase value in points
- ✅ `conversionTimestamp` - When purchase happened

### Commission Distribution
For each person who receives commission:
- ✅ `userId` - Who received commission
- ✅ `position` - Their position in chain (first, middle, second-from-last)
- ✅ `commissionAmount` - Amount in points
- ✅ `commissionPercentage` - Percentage (20%, 30%, or split)
- ✅ `distributedAt` - When commission was distributed
- ✅ `reason` - Why they got commission

---

## 📊 Analytics Breakdown

### Platform Breakdown
Track how many shares/clicks came from each platform:
- WhatsApp: 45%
- LinkedIn: 30%
- Twitter: 15%
- Facebook: 10%
- etc.

### Device Breakdown
Track which devices are being used:
- Mobile: 60%
- Desktop: 35%
- Tablet: 5%

### Location Breakdown
Track geographic distribution:
- Mumbai, India: 25 people
- Delhi, India: 18 people
- Bangalore, India: 15 people
- etc.

### Browser Breakdown
- Chrome: 70%
- Safari: 20%
- Firefox: 8%
- Edge: 2%

### OS Breakdown
- Android: 45%
- iOS: 25%
- Windows: 20%
- macOS: 8%
- Linux: 2%

### Network Breakdown
- 4G: 55%
- WiFi: 30%
- 5G: 10%
- 3G: 5%

### Time Breakdown
- Hourly distribution (0-23 hours)
- Daily distribution (Mon-Sun)
- Peak activity times

---

## 🔍 Complete Chain Visualization

For each user, we can show:

```
Chain: A(you) → B → C → D

Your Position: 0 (Original Sharer)

A (you):
  - Shared: Dec 15, 2024 at 3:45 PM IST
  - Platform: WhatsApp
  - Device: iPhone 14 Pro (iOS 17.2)
  - Browser: Safari 17.1
  - Screen: 1170x2532
  - Network: 5G (50 Mbps)
  - Location: Mumbai, Maharashtra, India (19.0760°N, 72.8777°E)
  - Clicks on your link: 5
  - Views: 8
  - Re-shares: 2

B:
  - Clicked: Dec 15, 2024 at 4:10 PM IST
  - Registered: Dec 15, 2024 at 4:12 PM IST
  - Platform: WhatsApp
  - Device: Samsung Galaxy S23 (Android 14)
  - Browser: Chrome 120.0
  - Screen: 1080x2400
  - Network: 4G (15 Mbps)
  - Location: Delhi, Delhi, India (28.6139°N, 77.2090°E)
  - Distance from A: 1,150 km
  - Travel time: 25 minutes
  - Clicks on B's link: 3
  - Views: 4
  - Re-shares: 1

C:
  - Clicked: Dec 15, 2024 at 5:30 PM IST
  - Registered: Dec 15, 2024 at 5:35 PM IST
  - Platform: LinkedIn
  - Device: MacBook Air (macOS 14.1)
  - Browser: Chrome 120.0
  - Screen: 1440x900
  - Network: WiFi (100 Mbps)
  - Location: Bangalore, Karnataka, India (12.9716°N, 77.5946°E)
  - Distance from B: 1,740 km
  - Travel time: 1 hour 20 minutes
  - Clicks on C's link: 2
  - Views: 2
  - Re-shares: 1

D:
  - Clicked: Dec 15, 2024 at 7:00 PM IST
  - Registered: Dec 15, 2024 at 7:05 PM IST
  - Platform: Twitter
  - Device: HP Laptop (Windows 11)
  - Browser: Edge 120.0
  - Screen: 1920x1080
  - Network: WiFi (50 Mbps)
  - Location: Hyderabad, Telangana, India (17.3850°N, 78.4867°E)
  - Distance from C: 502 km
  - Travel time: 1 hour 30 minutes
  - Purchased: Dec 15, 2024 at 7:45 PM IST
```

---

## 📦 Database Storage

All this data is stored in:

### Post Collection
- `analytics.viewHistory[]` - Every view with complete data
- `analytics.shareHistory[]` - Every share with complete data
- `analytics.conversionHistory[]` - Every purchase

### ReferralChain Collection
- `chain[]` - Each person in chain with all their data
- `analytics.journeyMap[]` - Complete journey visualization
- `analytics.platformBreakdown` - Platform statistics
- `analytics.deviceBreakdown` - Device statistics
- `analytics.locationBreakdown` - Location statistics
- `conversion.commissionDetails[]` - Commission distribution

### Referral Collection
- Individual referral records with engagement data

---

## 🎯 Real-World Example

**Scenario:** iPhone user in Mumbai shares product on WhatsApp

**Captured Data:**
```json
{
  "userId": "user_A",
  "timestamp": "2024-12-15T15:45:30.123Z",
  "platform": "whatsapp",
  "device": "smartphone",
  "browser": "Safari",
  "browserVersion": "17.1",
  "os": "iOS",
  "osVersion": "17.2",
  "deviceModel": "iPhone 14 Pro",
  "screenSize": { "width": 1170, "height": 2532 },
  "viewport": { "width": 393, "height": 852 },
  "networkInfo": {
    "connectionType": "cellular",
    "effectiveType": "5g",
    "downlink": 50.5,
    "rtt": 50,
    "saveData": false
  },
  "location": {
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "coordinates": {
      "latitude": 19.0760,
      "longitude": 72.8777,
      "accuracy": 10
    },
    "timezone": "Asia/Kolkata"
  },
  "language": "en-IN",
  "colorScheme": "dark",
  "touchSupport": true,
  "isIncognito": false,
  "shareMethod": "native_share",
  "ipAddress": "103.XXX.XXX.XXX"
}
```

**Everything** is tracked and stored for complete analytics and journey visualization!

---

## ✅ Summary

**Total Data Points Tracked Per Interaction: 40+**

Including:
- Device type, model, OS version
- Browser name and version
- Screen size and viewport
- Network type and speed
- GPS coordinates and location
- Platform (WhatsApp, LinkedIn, etc.)
- Date, time, and timezone
- Language and preferences
- User agent and IP
- Session information
- Journey metrics (distance, time)
- Engagement data (clicks, views, shares)

**This is the MOST comprehensive tracking system possible!** 🚀

