const { Octokit } = require('@octokit/rest');
const JSZip = require('jszip');
const multiparty = require('multiparty');
const fs = require('fs');
const https = require('https');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse FormData
        const form = new multiparty.Form();
        
        const formData = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('Form parse error:', err);
                    reject(err);
                }
                resolve({ fields, files });
            });
        });

        const { fields, files } = formData;
        
        const repo = fields.repo?.[0];
        const path = fields.path?.[0] || '';
        const commitMessage = fields.commitMessage?.[0] || 'Upload files via GitHub Uploader';
        const autoExtract = fields.autoExtract?.[0] === 'true';
        const token = fields.token?.[0];

        console.log('Upload request:', { repo, path, autoExtract, filesCount: files.files?.length });

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        if (!repo) {
            return res.status(400).json({ error: 'Repository name is required' });
        }

        if (repo.includes('/')) {
            return res.status(400).json({ error: 'Repository name cannot contain "/". Enter only the repository name.' });
        }

        // Initialize Octokit
        const octokit = new Octokit({ 
            auth: token,
            request: {
                timeout: 30000
            }
        });

        // Dapatkan username dari token
        let username;
        try {
            const { data: user } = await octokit.users.getAuthenticated();
            username = user.login;
            console.log('Authenticated as:', username);
        } catch (error) {
            console.error('Failed to get user:', error);
            return res.status(401).json({ error: 'Invalid token or unable to get user info' });
        }

        // Format repository: username/repo-name
        const fullRepo = `${username}/${repo}`;

        // Check repo access
        let repoExists = true;
        try {
            await octokit.repos.get({ 
                owner: username, 
                repo: repo
            });
            console.log('Repository exists:', fullRepo);
        } catch (error) {
            if (error.status === 404) {
                repoExists = false;
                console.log('Repository does not exist, will create:', fullRepo);
            } else {
                console.error('Error checking repo:', error);
                throw error;
            }
        }

        // Fungsi untuk mengambil konten dari API readmd
        function getReadmeContent() {
            return new Promise((resolve, reject) => {
                https.get('https://upload2-tan.vercel.app/api/readmd', (response) => {
                    let data = '';
                    
                    response.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    response.on('end', () => {
                        resolve(data);
                    });
                    
                }).on('error', (error) => {
                    reject(error);
                });
            });
        }

        // Buat repository jika belum ada
        if (!repoExists) {
            try {
                // Ambil konten dari API readmd
                let readmeContent = '';
                try {
                    readmeContent = await getReadmeContent();
                    console.log('Successfully fetched README content from API');
                } catch (apiError) {
                    console.error('Failed to fetch from API, using fallback:', apiError);
                    readmeContent = `# ${repo}\n\nRepository created via GitHub Uploader`;
                }

                // Buat repository dengan description dari API readmd
                await octokit.repos.createForAuthenticatedUser({
                    name: repo,
                    private: false,
                    auto_init: true,
                    description: readmeContent
                });
                console.log('Repository created successfully with README content as description');
                
            } catch (error) {
                console.error('Failed to create repository:', error);
                return res.status(400).json({ 
                    error: 'Failed to create repository',
                    details: error.message
                });
            }
        }

        const uploadResults = [];
        const fileList = files.files || [];
        const historyItems = [];

        if (fileList.length === 0) {
            return res.status(400).json({ error: 'No files selected for upload' });
        }

        console.log(`Processing ${fileList.length} files...`);

        // Proses setiap file
        for (const file of fileList) {
            try {
                const fileBuffer = fs.readFileSync(file.path);
                const fileSize = fileBuffer.length;
                const isZip = file.originalFilename.toLowerCase().endsWith('.zip');
                
                console.log(`Processing file: ${file.originalFilename} (${fileSize} bytes, isZip: ${isZip})`);

                // Handle ZIP files with auto-extract
                if (isZip && autoExtract) {
                    console.log(`Extracting ZIP: ${file.originalFilename}`);
                    const zipFiles = await extractZip(file);
                    
                    for (const zipFile of zipFiles) {
                        try {
                            await uploadFileToGitHub(
                                octokit,
                                username,
                                repo,
                                path,
                                zipFile.name,
                                zipFile.content,
                                commitMessage
                            );
                            
                            uploadResults.push({
                                name: zipFile.name,
                                status: 'success',
                                type: 'extracted',
                                size: zipFile.content.length
                            });

                            historyItems.push({
                                id: Date.now() + Math.random(),
                                name: zipFile.name,
                                repo: fullRepo,
                                status: 'success',
                                timestamp: new Date().toISOString(),
                                type: 'extracted',
                                size: zipFile.content.length,
                                user: username
                            });
                            
                            console.log(`Extracted file uploaded: ${zipFile.name}`);
                        } catch (error) {
                            console.error(`Failed to upload extracted file ${zipFile.name}:`, error);
                            uploadResults.push({
                                name: zipFile.name,
                                status: 'error',
                                error: error.message,
                                type: 'extracted'
                            });

                            historyItems.push({
                                id: Date.now() + Math.random(),
                                name: zipFile.name,
                                repo: fullRepo,
                                status: 'error',
                                timestamp: new Date().toISOString(),
                                type: 'extracted',
                                error: error.message,
                                user: username
                            });
                        }
                    }
                    
                    uploadResults.push({
                        name: `${file.originalFilename} (${zipFiles.length} files extracted)`,
                        status: 'success',
                        type: 'zip'
                    });
                    
                } else {
                    // Upload regular file (any type)
                    await uploadFileToGitHub(
                        octokit,
                        username,
                        repo,
                        path,
                        file.originalFilename,
                        fileBuffer,
                        commitMessage
                    );
                    
                    uploadResults.push({
                        name: file.originalFilename,
                        status: 'success',
                        type: 'file',
                        size: fileSize
                    });

                    historyItems.push({
                        id: Date.now() + Math.random(),
                        name: file.originalFilename,
                        repo: fullRepo,
                        status: 'success',
                        timestamp: new Date().toISOString(),
                        type: 'file',
                        size: fileSize,
                        user: username
                    });
                    
                    console.log(`File uploaded successfully: ${file.originalFilename}`);
                }

                // Clean up temp file
                fs.unlinkSync(file.path);

            } catch (error) {
                console.error(`Error uploading ${file.originalFilename}:`, error);
                uploadResults.push({
                    name: file.originalFilename,
                    status: 'error',
                    error: error.message,
                    type: 'file'
                });

                historyItems.push({
                    id: Date.now() + Math.random(),
                    name: file.originalFilename,
                    repo: fullRepo,
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    type: 'file',
                    error: error.message,
                    user: username
                });
            }
        }

        const successfulUploads = uploadResults.filter(r => r.status === 'success');
        const failedUploads = uploadResults.filter(r => r.status === 'error');

        console.log(`Upload complete. Success: ${successfulUploads.length}, Failed: ${failedUploads.length}`);

        // Return data lengkap termasuk history items
        return res.status(200).json({
            success: successfulUploads.length > 0,
            message: successfulUploads.length > 0 
                ? `Successfully uploaded ${successfulUploads.length} files${!repoExists ? ' (new repository created)' : ''}` 
                : 'Upload failed',
            files: uploadResults,
            successfulCount: successfulUploads.length,
            failedCount: failedUploads.length,
            history: historyItems,
            repo: fullRepo,
            username: username
        });

    } catch (error) {
        console.error('Upload error:', error);
        
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'Authentication failed',
                details: 'The provided token is invalid or expired'
            });
        }
        
        if (error.status === 403) {
            return res.status(403).json({ 
                error: 'Rate limit exceeded',
                details: 'GitHub API rate limit exceeded. Please try again later.'
            });
        }

        return res.status(500).json({ 
            error: 'Upload failed',
            details: error.message
        });
    }
};

async function extractZip(zipFile) {
    try {
        const zip = new JSZip();
        const fileBuffer = fs.readFileSync(zipFile.path);
        const zipData = await zip.loadAsync(fileBuffer);
        
        const files = [];
        
        for (const [filename, file] of Object.entries(zipData.files)) {
            if (!file.dir) {
                const content = await file.async('nodebuffer');
                files.push({
                    name: filename,
                    content: content
                });
            }
        }
        
        return files;
    } catch (error) {
        throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
}

async function uploadFileToGitHub(octokit, owner, repo, basePath, filename, content, commitMessage) {
    const cleanFilename = filename.replace(/^\/+/, '').replace(/\/+/g, '/');
    const cleanBasePath = basePath.replace(/\/+$/, '').replace(/\/+/g, '/');
    const fullPath = cleanBasePath ? `${cleanBasePath}/${cleanFilename}` : cleanFilename;
    
    try {
        let sha;
        try {
            const existingFile = await octokit.repos.getContent({
                owner,
                repo,
                path: fullPath
            });
            sha = existingFile.data.sha;
        } catch (error) {
            sha = undefined;
        }

        const response = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: fullPath,
            message: commitMessage,
            content: content.toString('base64'),
            sha: sha
        });

        return {
            success: true,
            url: response.data.content.html_url
        };

    } catch (error) {
        if (error.status === 409) {
            throw new Error(`File conflict: ${filename} already exists`);
        }
        if (error.status === 422) {
            throw new Error(`Validation failed for ${filename}. The file may be too large.`);
        }
        throw new Error(`Failed to upload ${filename}: ${error.message}`);
    }
}
