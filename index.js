// index.js - Main addon file
const { addonBuilder } = require('stremio-addon-sdk')
const fetch = require('node-fetch')

// Replace with your actual OMDB API key
const OMDB_API_KEY = '1aa1dd73'

// Get port from environment variable (Render provides this)
const PORT = process.env.PORT || 3000

// Get the hostname from environment or use localhost for local development
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`

// Create a new addon with proper base URL
const addon = new addonBuilder({
    id: 'org.imdbratings',
    version: '1.0.0',
    name: 'IMDB Ratings Overlay',
    description: 'Displays IMDB ratings directly in Stremio',
    resources: ['catalog', 'meta'],  // Add 'meta' resource for metadetails
    types: ['movie', 'series'],
    catalogs: [],
    // Use the Render URL for assets
    background: `${BASE_URL}/background.jpg`,
    logo: `${BASE_URL}/logo.png`,
    contactEmail: 'your-email@example.com'
})

// Helper function to fetch IMDB rating
async function getIMDBRating(imdbId) {
    try {
        const response = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`)
        const data = await response.json()
        
        if (data.Response === 'False') {
            console.error(`OMDB API error for ${imdbId}: ${data.Error}`)
            return null
        }
        
        // Return more data for meta handler
        return {
            imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
            imdbVotes: data.imdbVotes !== 'N/A' ? data.imdbVotes : null,
            plot: data.Plot !== 'N/A' ? data.Plot : null,
            director: data.Director !== 'N/A' ? data.Director : null,
            actors: data.Actors !== 'N/A' ? data.Actors : null,
            year: data.Year !== 'N/A' ? data.Year : null
        }
    } catch (error) {
        console.error(`Error fetching IMDB data for ${imdbId}:`, error)
        return null
    }
}

// Define catalog handler
addon.defineCatalogHandler(async ({ type, id }) => {
    // Only proceed if we're dealing with a catalog
    if (!type || !id) {
        return { metas: [] }
    }

    try {
        // Call the original addon to get the catalog
        const originalAddonUrl = `https://v3-cinemeta.strem.io/catalog/${type}/${id}.json`
        const response = await fetch(originalAddonUrl)
        const catalog = await response.json()

        // Process each item to add a visual cue that this has IMDB ratings
        // (we'll actually add the ratings in the meta handler)
        const updatedMetas = catalog.metas.map(meta => {
            // Add a prefix to show this has enhanced data
            meta.name = `★ ${meta.name}`;
            return meta;
        });

        return { metas: updatedMetas }
    } catch (error) {
        console.error('Error in catalog handler:', error)
        return { metas: [] }
    }
})

// Define meta handler to enhance metadata with IMDB ratings
addon.defineMetaHandler(async ({ type, id }) => {
    if (!type || !id) {
        return { meta: null }
    }

    try {
        // First get the original metadata
        const originalMetaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`
        const response = await fetch(originalMetaUrl)
        const originalMeta = await response.json()

        if (!originalMeta.meta) {
            return { meta: null }
        }

        const meta = originalMeta.meta
        const imdbId = meta.imdbId || (meta.id && meta.id.startsWith('tt') ? meta.id : null)

        if (imdbId) {
            const imdbData = await getIMDBRating(imdbId)
            
            if (imdbData && imdbData.imdbRating) {
                // Enhance the metadata with IMDB ratings
                meta.name = `${meta.name} (IMDb: ${imdbData.imdbRating})`
                
                // Add more detailed information if available
                if (meta.description && imdbData.plot) {
                    meta.description = `${meta.description}\n\nIMDb: ${imdbData.imdbRating}/10 (${imdbData.imdbVotes} votes)`
                    
                    // Add director and actors if available and not already in description
                    if (imdbData.director && !meta.description.includes(imdbData.director)) {
                        meta.description += `\nDirector: ${imdbData.director}`
                    }
                    
                    if (imdbData.actors && !meta.description.includes(imdbData.actors)) {
                        meta.description += `\nStars: ${imdbData.actors}`
                    }
                }
            }
        }

        return { meta }
    } catch (error) {
        console.error('Error in meta handler:', error)
        return { meta: null }
    }
})

// Start the addon with proper CORS settings
const express = require('express')
const cors = require('cors')
const { serveHTTP } = require('stremio-addon-sdk')

const app = express()
app.use(cors())

// Add a health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('IMDB Ratings addon is running');
});

// Serve the addon
serveHTTP(addon.getInterface(), { 
    port: PORT, 
    host: '0.0.0.0', // Use 0.0.0.0 to listen on all interfaces
    app
})

console.log(`IMDB Ratings addon running at ${BASE_URL}`)
console.log(`Add this URL in Stremio: ${BASE_URL}/manifest.json`)
