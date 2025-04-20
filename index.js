// index.js - Main addon file
const { addonBuilder } = require('stremio-addon-sdk')
const fetch = require('node-fetch')
const { startOverlayService } = require('./overlay-service')

// Replace with your actual OMDB API key
const OMDB_API_KEY = '1aa1dd73'

// Overlay service port
const OVERLAY_PORT = 7001

// IP address of your Raspberry Pi
const HOST_IP = '192.168.1.161'

// Create a new addon with proper base URL
const addon = new addonBuilder({
    id: 'org.imdbratings',
    version: '1.0.0',
    name: 'IMDB Ratings Overlay',
    description: 'Displays IMDB ratings directly on posters in Stremio',
    resources: ['catalog'],
    types: ['movie', 'series'],
    catalogs: [],
    // Include this line to specify the correct base URL
    background: `http://${HOST_IP}:7000/background.jpg`,
    logo: `http://${HOST_IP}:7000/logo.png`,
    contactEmail: 'your-email@example.com'
})

// Start the overlay service (on a different port)
startOverlayService(OVERLAY_PORT, HOST_IP)

// Helper function to fetch IMDB rating
async function getIMDBRating(imdbId) {
    try {
        const response = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`)
        const data = await response.json()
        return data.imdbRating !== 'N/A' ? data.imdbRating : null
    } catch (error) {
        console.error(`Error fetching IMDB rating for ${imdbId}:`, error)
        return null
    }
}

// Define catalog handler
addon.defineCatalogHandler(async ({ type, id, extra }) => {
    // Only proceed if we're dealing with a catalog
    if (!type || !id) {
        return { metas: [] }
    }

    try {
        // First, call the original addon to get the catalog
        const originalAddonUrl = `https://v3-cinemeta.strem.io/catalog/${type}/${id}.json`
        const response = await fetch(originalAddonUrl)
        const catalog = await response.json()

        // Get the base URL for our overlay service
        const baseUrl = `http://${HOST_IP}:${OVERLAY_PORT}`

        // Process each item to add IMDB rating
        const promises = catalog.metas.map(async (meta) => {
            // Only process items with IMDB IDs
            if (meta.imdbId || (meta.id && meta.id.startsWith('tt'))) {
                const imdbId = meta.imdbId || meta.id
                const rating = await getIMDBRating(imdbId)
                
                if (rating && meta.poster) {
                    // Replace the poster URL with our overlay service URL
                    // Position parameter: 'top-left' or 'bottom-left'
                    meta.poster = `${baseUrl}/overlay?posterUrl=${encodeURIComponent(meta.poster)}&rating=${rating}&position=top-left`
                }
            }
            return meta
        })

        const updatedMetas = await Promise.all(promises)
        return { metas: updatedMetas }
    } catch (error) {
        console.error('Error in catalog handler:', error)
        return { metas: [] }
    }
})

// Start the addon with proper CORS settings
const { serveHTTP } = require('stremio-addon-sdk')
serveHTTP(addon.getInterface(), { 
    port: 7000, 
    host: '0.0.0.0', // Use 0.0.0.0 instead of specific IP to listen on all interfaces
    static: null,
    customHandler: (req, res) => {
        // Set proper CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        
        // For OPTIONS requests (preflight), return immediately
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return true; // Indicate that we've handled the request
        }
        
        return false; // Let the default handler continue for non-OPTIONS requests
    }
})

console.log(`IMDB Ratings addon running at http://${HOST_IP}:7000`)
console.log(`Overlay service running at http://${HOST_IP}:7001`)
console.log(`Add this URL in Stremio: http://${HOST_IP}:7000/manifest.json`)
