const { Octokit } = require('@octokit/rest');

class GitHubClient {
    constructor(token) {
        this.octokit = new Octokit({ auth: token });
    }

    async getUser() {
        const { data } = await this.octokit.users.getAuthenticated();
        return data;
    }

    async checkRepoAccess(owner, repo) {
        try {
            await this.octokit.repos.get({ owner, repo });
            return true;
        } catch (error) {
            return false;
        }
    }

    async uploadFile(owner, repo, path, content, message) {
        try {
            // Check if file exists
            let sha;
            try {
                const existingFile = await this.octokit.repos.getContent({
                    owner,
                    repo,
                    path
                });
                sha = existingFile.data.sha;
            } catch (error) {
                // File doesn't exist
                sha = undefined;
            }

            const response = await this.octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message,
                content: Buffer.from(content).toString('base64'),
                sha: sha
            });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }
}

module.exports = GitHubClient;
