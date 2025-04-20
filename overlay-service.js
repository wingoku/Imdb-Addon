// overlay-service.js - Image processing service
const express = require('express')
const { createCanvas, loadImage } = require('canvas')
const cors = require('cors')

// Function to start the overlay service
function startOverlayService(port, hostIP) {
    const app = express()
    
    // Enable CORS for all routes
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }))

    app.get('/overlay', async (req, res) => {
        const { posterUrl, rating, position = 'top-left' } = req.query
        
        if (!posterUrl || !rating) {
            return res.status(400).send('Missing required parameters')
        }
        
        try {
            // Load the poster image
            const image = await loadImage(posterUrl)
            
            // Create canvas with same dimensions as the poster
            const canvas = createCanvas(image.width, image.height)
            const ctx = canvas.getContext('2d')
            
            // Draw the original poster
            ctx.drawImage(image, 0, 0)
            
            // Badge dimensions
            const badgeWidth = Math.max(50, image.width * 0.2) // Responsive width
            const badgeHeight = 30
            
            // Badge position calculation
            let x = 10; // Default padding from edge
            let y = 10; // Default padding from edge
            
            if (position === 'bottom-left') {
                y = image.height - badgeHeight - 10;
            }
            // For 'top-left', we keep the default values
            
            // Draw a semi-transparent background for the rating
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(x, y, badgeWidth, badgeHeight)
            
            // Draw the rating text
            ctx.fillStyle = '#f5c518' // IMDB yellow
            ctx.font = 'bold 18px Arial'
            ctx.fillText(`★ ${rating}`, x + 8, y + 20)
            
            // Send the modified image
            res.set('Content-Type', 'image/png')
            res.set('Cache-Control', 'public, max-age=86400') // Add caching for 24 hours
            canvas.createPNGStream().pipe(res)
        } catch (error) {
            console.error('Error processing image:', error)
            res.status(500).send(`Error processing image: ${error.message}`)
        }
    })
    
    // Add a health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).send('Overlay service is running');
    });

    // Start the server
    app.listen(port, '0.0.0.0', () => { // Listen on all interfaces
        console.log(`Overlay service started on port ${port}`)
    })
}

module.exports = { startOverlayService }
