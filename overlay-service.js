// overlay-service.js - Image processing service optimized for Render hosting
const { createCanvas, loadImage } = require('canvas')
const cors = require('cors')

// Function to setup the overlay service routes on an existing Express app
function setupOverlayService(app) {
    // Enable CORS for all routes
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
        credentials: true,
        maxAge: 86400
    }))
    
    // Add request logging
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url} from ${req.ip || 'unknown'}`);
        next();
    });

    // Overlay endpoint to add ratings to posters
    app.get('/overlay', async (req, res) => {
        const { posterUrl, rating, position = 'top-left' } = req.query
        
        if (!posterUrl || !rating) {
            return res.status(400).send('Missing required parameters');
        }
        
        console.log(`Processing overlay for poster: ${posterUrl}`);
        console.log(`Adding rating: ${rating} at position: ${position}`);
        
        try {
            // Load the poster image
            const image = await loadImage(posterUrl)
            console.log(`Loaded image: ${image.width}x${image.height}`);
            
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
            
            console.log('Overlay applied successfully');
            
            // Send the modified image with caching headers
            res.set({
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            });
            
            canvas.createPNGStream().pipe(res)
        } catch (error) {
            console.error('Error processing image:', error)
            res.status(500).send(`Error processing image: ${error.message}`)
        }
    })
    
    // Information page about the overlay service
    app.get('/overlay-info', (req, res) => {
        res.send(`
            <html>
                <head>
                    <title>IMDB Ratings Overlay Service</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        code {
                            background-color: #f4f4f4;
                            padding: 2px 5px;
                            border-radius: 4px;
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
                    <h1>IMDB Ratings Overlay Service</h1>
                    <p>This service adds IMDB ratings to poster images.</p>
                    
                    <h2>API Usage</h2>
                    <pre>/overlay?posterUrl=ENCODED_POSTER_URL&rating=8.5&position=top-left</pre>
                    
                    <h3>Parameters:</h3>
                    <ul>
                        <li><code>posterUrl</code>: URL-encoded path to the original poster image</li>
                        <li><code>rating</code>: IMDB rating to display (e.g., 8.5)</li>
                        <li><code>position</code>: Where to place the rating (top-left or bottom-left, defaults to top-left)</li>
                    </ul>
                    
                    <h2>Example</h2>
                    <p>Adding a rating of 9.2 to a poster:</p>
                    <pre>/overlay?posterUrl=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2FrPdtLWNsZmAtoZl9PK7S2wE3qiS.jpg&rating=9.2&position=top-left</pre>
                </body>
            </html>
        `);
    });

    console.log('Overlay service routes configured');
    
    return app;
}

module.exports = { setupOverlayService }
