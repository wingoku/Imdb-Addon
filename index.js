// index.js - Main addon file optimized for Render hosting
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const fetch = require('node-fetch')
const express = require('express')
const { setupOverlayService } = require('./overlay-service')

// Replace with your actual OMDB API key
const OMDB_API_KEY = '1aa1dd73'

// Get port from environment variable (Render sets this automatically)
const PORT = process.env.PORT || 3000

// Get the host URL (this will be set by Render)
// For local development, default to localhost
const isDev = process.env.NODE_ENV !== 'production'
const HOST_URL = isDev ? `http://localhost:${PORT}` : process.env.RENDER_EXTERNAL_URL

// Create Express app
const app = express()

// Setup the overlay service routes on the same Express app
setupOverlayService(app)

// Create a new addon with proper configuration
const addon = new addonBuilder({
    id: 'org.imdbratings',
    version: '1.0.0',
    name: 'IMDB Ratings Overlay',
    description: 'Displays IMDB ratings directly on posters in Stremio',
    resources: ['catalog'],
    types: ['movie', 'series'],
    catalogs: [],
    // Use the auto-detected URL provided by Render
    endpoint: `${HOST_URL}/manifest.json`,
    logo: `${HOST_URL}/logo.png`,
    background: `${HOST_URL}/background.jpg`
})

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
    // Log the request for debugging
    console.log(`Received catalog request: ${type}/${id}`)
    
    // Only proceed if we're dealing with a catalog
    if (!type || !id) {
        return { metas: [] }
    }

    try {
        // First, call the original addon to get the catalog
        const originalAddonUrl = `https://v3-cinemeta.strem.io/catalog/${type}/${id}.json`
        console.log(`Fetching catalog from: ${originalAddonUrl}`)
        
        const response = await fetch(originalAddonUrl)
        const catalog = await response.json()
        console.log(`Received ${catalog.metas ? catalog.metas.length : 0} items from Cinemeta`)

        // Process each item to add IMDB rating
        const promises = catalog.metas.map(async (meta) => {
            // Only process items with IMDB IDs
            if (meta.imdbId || (meta.id && meta.id.startsWith('tt'))) {
                const imdbId = meta.imdbId || meta.id
                const rating = await getIMDBRating(imdbId)
                
                if (rating && meta.poster) {
                    // Replace the poster URL with our overlay service URL
                    const originalPoster = meta.poster
                    
                    // Use our overlay service URL
                    // Note that we're now using the same domain since both 
                    // services are combined in one Express app
                    meta.poster = `${HOST_URL}/overlay?posterUrl=${encodeURIComponent(meta.poster)}&rating=${rating}&position=top-left`
                    
                    console.log(`Added rating overlay for ${imdbId}: ${rating}`)
                    console.log(`Original poster: ${originalPoster}`)
                    console.log(`New poster URL: ${meta.poster}`)
                }
            }
            return meta
        })

        const updatedMetas = await Promise.all(promises)
        console.log(`Returning ${updatedMetas.length} items with ratings`)
        return { metas: updatedMetas }
    } catch (error) {
        console.error('Error in catalog handler:', error)
        return { metas: [] }
    }
})

// Add static file serving for the logo and background
app.use(express.static('static'))

// Create the stremio addon routes
// This uses the serveHTTP function internally to create all the necessary endpoints
const addonRouter = addon.getRouter()
app.use('/', addonRouter)

// Add a specific route for manifest.json with proper CORS
app.get('/manifest.json', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(addon.getInterface()))
})

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Addon service is running')
})

// Add a landing page that links to the manifest
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>IMDB Ratings Overlay for Stremio</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .button {
                        display: inline-block;
                        background-color: #4CAF50;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 4px;
                        font-weight: bold;
                        margin-top: 20px;
                    }
                    pre {
                        background-color: #f4f4f4;
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <h1>IMDB Ratings Overlay for Stremio</h1>
                <p>This addon displays IMDB ratings directly on movie and series posters in Stremio.</p>
                
                <h2>How to install</h2>
                <p>To install this addon in Stremio:</p>
                <ol>
                    <li>Open Stremio</li>
                    <li>Go to the addons section</li>
                    <li>Click "Add Addon URL" at the bottom of the page</li>
                    <li>Enter this URL: <pre>${HOST_URL}/manifest.json</pre></li>
                    <li>Click Install</li>
                </ol>
                
                <a href="stremio://addon/${encodeURIComponent(HOST_URL + '/manifest.json')}" class="button">Install in Stremio</a>
                
                <h2>Information</h2>
                <p>This addon uses the OMDB API to fetch ratings and overlays them on posters.</p>
                <p>It works with movies and TV series.</p>
                
                <h2>Links</h2>
                <ul>
                    <li><a href="/manifest.json">Addon Manifest</a></li>
                </ul>
            </body>
        </html>
    `)
})

// Start the server
app.listen(PORT, () => {
    console.log(`IMDB Ratings addon running on port ${PORT}`)
    console.log(`Add this URL in Stremio: ${HOST_URL}/manifest.json`)
})
