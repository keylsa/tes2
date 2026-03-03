const axios = require('axios');

// HARDCODE Client ID dan Client Secret ANDA
const CLIENT_ID = 'Ov23liYzweXughPOoOEj';
const CLIENT_SECRET = '7e1d5e4e362780fc42dd5d5f16bc9833bde2a80e';

module.exports = async (req, res) => {
    console.log('=== AUTH ENDPOINT HIT ===');
    console.log('Method:', req.method);
    console.log('Query:', req.query);
    console.log('URL:', req.url);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        console.log('OPTIONS request received');
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        console.log('Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;

    if (!code) {
        console.log('No code provided');
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        console.log('Exchanging code for access token...');
        console.log('Code:', code);

        // Exchange code for access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: 'https://upload2-tan.vercel.app/api/auth'
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log('Token response:', tokenResponse.data);

        const { access_token, error, error_description, scope } = tokenResponse.data;

        if (error) {
            console.log('GitHub error:', error, error_description);
            throw new Error(error_description || error);
        }

        if (!access_token) {
            throw new Error('No access token received from GitHub');
        }

        console.log('Access token received, fetching user info...');

        // Get user info
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            timeout: 10000
        });

        console.log('User authenticated:', userResponse.data.login);

        // Create HTML response that saves token and redirects
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Successful</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #f6f8fa;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .success {
                    color: #2ea043;
                }
            </style>
            <script>
                console.log('Saving token to localStorage...');
                localStorage.setItem('github_token', '${access_token}');
                localStorage.setItem('github_user', '${JSON.stringify(userResponse.data).replace(/'/g, "\\'")}');
                console.log('Token saved, redirecting...');
                setTimeout(() => {
                    window.location.href = 'https://upload2-tan.vercel.app';
                }, 1000);
            </script>
        </head>
        <body>
            <div class="container">
                <h1 class="success">✓ Authentication Successful</h1>
                <p>Redirecting to upload page...</p>
                <p><small>If redirect doesn't work, <a href="https://upload2-tan.vercel.app">click here</a></small></p>
            </div>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        
        const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Failed</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #f6f8fa;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .error {
                    color: #cf222e;
                }
            </style>
            <script>
                console.log('Cleaning localStorage...');
                localStorage.removeItem('github_token');
                localStorage.removeItem('github_user');
                setTimeout(() => {
                    window.location.href = 'https://upload2-tan.vercel.app?error=auth_failed&message=${encodeURIComponent(error.message)}';
                }, 1000);
            </script>
        </head>
        <body>
            <div class="container">
                <h1 class="error">✗ Authentication Failed</h1>
                <p>${error.message}</p>
                <p>Redirecting to login page...</p>
                <p><small>If redirect doesn't work, <a href="https://upload2-tan.vercel.app">click here</a></small></p>
            </div>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.send(errorHtml);
    }
};
