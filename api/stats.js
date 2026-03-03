const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const octokit = new Octokit({ auth: token });

        // Get user info
        const { data: user } = await octokit.users.getAuthenticated();

        // Get user's repositories
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            per_page: 100,
            sort: 'updated',
            direction: 'desc'
        });

        // Get upload history stats
        const history = global.uploadHistory || [];
        const userHistory = history.filter(h => h.repo?.startsWith(user.login));

        // Calculate stats
        const totalFiles = userHistory.length;
        const totalSize = userHistory.reduce((acc, h) => acc + (h.size || 0), 0);
        const successfulUploads = userHistory.filter(h => h.status === 'success').length;
        const lastUpload = userHistory[0]?.timestamp;

        // Get recent repositories with file counts
        const recentRepos = repos.slice(0, 5).map(r => ({
            name: r.name,
            private: r.private,
            updated_at: r.updated_at,
            files_count: userHistory.filter(h => h.repo === `${user.login}/${r.name}`).length
        }));

        return res.status(200).json({
            success: true,
            stats: {
                totalFiles,
                totalSize,
                successfulUploads,
                failedUploads: totalFiles - successfulUploads,
                lastUpload,
                repositories: repos.length,
                recentRepos
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        return res.status(500).json({ 
            error: 'Failed to get stats',
            details: error.message 
        });
    }
};
