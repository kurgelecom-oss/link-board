# Link Board

A simple, mobile-friendly link storage page for quick access on the Samsung Galaxy Z Fold 5 Pro.

## Features

- Add, edit, and delete links
- Links persist in browser storage (localStorage)
- Mobile-optimized design
- Subtle link back to family dashboard
- No backend needed — runs entirely in the browser

## How to Use

1. Open the page on your device
2. Enter a link name (e.g., "Gmail")
3. Enter the URL (e.g., "https://gmail.com")
4. Click "Add Link"
5. Click "Open" on any card to open the link
6. Use "Edit" or "Delete" to manage links

## Development

This is a static HTML page with no build step required.

### Local Testing

Simply open `index.html` in your browser.

### Deployment

Deployed to Netlify via GitHub. Push to main branch to auto-deploy.

## Deployment Instructions

1. Create a GitHub repository
2. Push this project to GitHub
3. Connect repository to Netlify
4. Netlify will auto-deploy on every push to main

## Browser Storage

Links are stored in browser localStorage under the key `linkBoard_links`. Data persists across sessions but is device/browser-specific.
