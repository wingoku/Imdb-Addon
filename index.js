// server.js - Simplified Stremio IMDB Ratings Addon
const { addonBuilder } = require('stremio-addon-sdk')
const fetch = require('node-fetch')
const express = require('express')
const cors = require('cors')

// Replace with your actual OMDB API key
const OMDB_API_KEY = '1aa1dd73'

// Get port from environment variable
const PORT = process.env.PORT || 3000

// Create a new addon builder
const addon = new addonBuilder({
    id: 'org.imdbratings',
    version: '1.0.0',
    name: 'IMDB Ratings',
    description: 'Add IMDB ratings to movies and series',
    // IMPORTANT: Define only the resources we actually use
    resources: ['meta'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']  // Only handle IMDB IDs
})

// Helper function to fetch IMDB rating
async function fetchOMDBData(imdbId) {
    try {
        console.log(`Fetching OMDB data for: ${imdbId}`)
        const response = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`)
        const data = await response.json()
        
        if (data.Response === 'False') {
            console.error(`OMDB API error for ${imdbId}: ${data.Error}`)
            return null
        }
        
        console.log(`Successfully retrieved data for ${imdbId}: Rating=${data.imdbRating}`)
        return data
    } catch (error) {
        console.error(`Error fetching IMDB data for ${imdbId}:`, error)
        return null
    }
}

// Define meta handler - this is the only handler we actually need
addon.defineMetaHandler(async ({ type, id }) => {
    // Only handle movie/series with IMDB IDs
    if (!id || !id.startsWith('tt') || !['movie', 'series'].includes(type)) {
        console.log(`Skipping non-IMDB ID: ${id}, type: ${type}`)
        return { meta: null }
    }

    console.log(`Processing meta request for ${type}/${id}`)
    
    try {
        // Get original metadata from Cinemeta
        const cinemetaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`
        console.log(`Fetching original metadata from: ${cinemetaUrl}`)
        
        const response = await fetch(cinemetaUrl)
        const data = await response.json()
        
        if (!data || !data.meta) {
            console.error(`Failed to get metadata from Cinemeta for ${id}`)
            return { meta: null }
        }
        
        // Get the metadata we'll enhance
        const meta = data.meta
        
        // Fetch IMDB data
        const imdbData = await fetchOMDBData(id)
        
        if (imdbData && imdbData.imdbRating && imdbData.imdbRating !== 'N/A') {
            // Update name to include the rating
            meta.name = `${meta.name} [IMDb: ${imdbData.imdbRating}]`
            
            // Update description
            if (meta.description) {
                const ratingInfo = `IMDb Rating: ${imdbData.imdbRating}/10`
                const votesInfo = imdbData.imdbVotes && imdbData.imdbVotes !== 'N/A' 
                    ? ` (${imdbData.imdbVotes} votes)` 
                    : ''
                
                meta.description = `${meta.description}\n\n${ratingInfo}${votesInfo}`
            }
            
            console.log(`Enhanced metadata for ${id} with rating: ${imdbData.imdbRating}`)
        } else {
            console.log(`No IMDB rating available for ${id}`)
        }
        
        return { meta }
    } catch (error) {
        console.error(`Error in meta handler for ${id}:`, error)
        return { meta: null }
    }
})

// Create express app
const app = express()
app.use(cors())

// Add verbose logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
    next()
})

// Add a test endpoint to verify the addon is running
app.get('/health', (req, res) => {
    res.send('IMDB Ratings Addon is running!')
})

// Add a debug endpoint to test OMDB API
app.get('/test-omdb/:imdbId', async (req, res) => {
    try {
        const data = await fetchOMDBData(req.params.imdbId)
        res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Serve the addon on our express app
const { serveHTTP } = require('stremio-addon-sdk')
serveHTTP(addon.getInterface(), { app, port: PORT })

app.listen(PORT, () => {
    console.log(`IMDB Ratings addon running on port ${PORT}`)
    console.log(`Add this URL in Stremio: http://localhost:${PORT}/manifest.json`)
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Or this URL if deployed on Render: ${process.env.RENDER_EXTERNAL_URL}/manifest.json`)
    }
})
