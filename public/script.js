class GitHubUploader {
    constructor() {
        this.token = localStorage.getItem('github_token');
        this.user = JSON.parse(localStorage.getItem('github_user') || 'null');
        this.currentPage = 'dashboard';
        this.settings = this.loadSettings();
        this.history = this.loadHistory(); // Load history dari localStorage
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
        this.initPages();
        this.updateDashboardStats();
        this.displayHistory();
        this.applySettings();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });

        // Auth
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Menu toggle for mobile
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Upload page events
        document.getElementById('browseBtn')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input')?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        document.getElementById('dropZone')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.getElementById('dropZone')?.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            document.getElementById('dropZone')?.addEventListener(eventName, () => {
                const dropZone = document.getElementById('dropZone');
                dropZone.style.borderColor = 'var(--accent-color)';
                dropZone.style.background = 'var(--bg-tertiary)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            document.getElementById('dropZone')?.addEventListener(eventName, () => {
                const dropZone = document.getElementById('dropZone');
                dropZone.style.borderColor = '';
                dropZone.style.background = '';
            });
        });

        document.getElementById('dropZone')?.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) {
                this.handleFileSelect(files);
                document.getElementById('file-input').files = files;
            }
        });

        // Upload button
        document.getElementById('upload-btn')?.addEventListener('click', () => this.uploadFiles());

        // Real-time validation
        document.getElementById('repo-name')?.addEventListener('input', () => this.validateForm());
        document.getElementById('commit-message')?.addEventListener('input', () => this.validateForm());

        // History filters
        document.getElementById('historySearch')?.addEventListener('input', () => this.filterHistory());
        document.getElementById('historyFilter')?.addEventListener('change', () => this.filterHistory());

        // Settings
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
        
        // Theme change
        document.getElementById('theme')?.addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
        });
    }

    initPages() {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const currentPage = document.getElementById(`${this.currentPage}-page`);
        if (currentPage) {
            currentPage.classList.add('active');
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === this.currentPage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        document.getElementById('pageTitle').textContent = 
            this.currentPage.charAt(0).toUpperCase() + this.currentPage.slice(1);
    }

    switchPage(page) {
        this.currentPage = page;
        this.initPages();
        document.getElementById('sidebar').classList.remove('open');
        
        if (page === 'dashboard') {
            this.updateDashboardStats();
        } else if (page === 'history') {
            this.displayHistory();
        }
    }

    checkAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorMessage = urlParams.get('message');

        if (error) {
            this.showToast(`Authentication failed: ${errorMessage || error}`, 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (this.token && this.user) {
            this.showUserSection();
            this.updateUserInfo();
        } else {
            this.showAuthSection();
        }
    }

    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('user-section').classList.add('hidden');
    }

    showUserSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('user-section').classList.remove('hidden');
    }

    updateUserInfo() {
        if (this.user) {
            document.getElementById('user-avatar').src = this.user.avatar_url;
            document.getElementById('username').textContent = this.user.login;
            document.getElementById('sidebarAvatar').src = this.user.avatar_url;
            document.getElementById('sidebarUsername').textContent = this.user.login;
            document.getElementById('repoPrefix').textContent = `${this.user.login}/`;
        }
    }

    async login() {
        const clientId = 'Ov23liYzweXughPOoOEj';
        const redirectUri = window.location.origin + '/api/auth';
        const scope = 'repo,user';
        
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        window.location.href = authUrl;
    }

    logout() {
        localStorage.removeItem('github_token');
        localStorage.removeItem('github_user');
        this.token = null;
        this.user = null;
        
        this.showAuthSection();
        this.showToast('Logged out successfully', 'success');
        document.getElementById('repoPrefix').textContent = 'username/';
        this.switchPage('dashboard');
    }

    handleFileSelect(files) {
        const fileArray = Array.from(files);
        const fileList = document.getElementById('file-list');
        
        fileList.innerHTML = '';
        
        fileArray.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${this.formatFileSize(file.size)})</span>
            `;
            fileList.appendChild(fileItem);
        });

        this.validateForm();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    validateForm() {
        const repoName = document.getElementById('repo-name').value;
        const commitMessage = document.getElementById('commit-message').value;
        const files = document.getElementById('file-input').files;
        const uploadBtn = document.getElementById('upload-btn');

        const isValid = repoName && !repoName.includes('/') && commitMessage && files.length > 0;
        uploadBtn.disabled = !isValid;
    }

    loadHistory() {
        const saved = localStorage.getItem('upload_history');
        return saved ? JSON.parse(saved) : [];
    }

    saveHistory() {
        localStorage.setItem('upload_history', JSON.stringify(this.history));
    }

    addToHistory(items) {
        if (Array.isArray(items)) {
            this.history = [...items, ...this.history];
        } else {
            this.history = [items, ...this.history];
        }
        
        // Batasi hanya 100 items
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        
        this.saveHistory();
        this.updateDashboardStats();
        this.displayHistory();
    }

    async uploadFiles() {
        const repoName = document.getElementById('repo-name').value;
        const path = document.getElementById('file-path').value || '';
        const commitMessage = document.getElementById('commit-message').value;
        const autoExtract = document.getElementById('auto-extract').checked;
        const files = document.getElementById('file-input').files;

        if (repoName.includes('/')) {
            this.showToast('Repository name cannot contain "/". Enter only the repository name.', 'error');
            return;
        }

        this.showProgress('Preparing files...');

        try {
            const formData = new FormData();
            formData.append('repo', repoName);
            formData.append('path', path);
            formData.append('commitMessage', commitMessage);
            formData.append('autoExtract', autoExtract);
            formData.append('token', this.token);

            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            this.showProgress('Uploading files to GitHub...');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Simpan history ke localStorage
                if (result.history && result.history.length > 0) {
                    this.addToHistory(result.history);
                }

                const successMsg = `Successfully uploaded ${result.successfulCount} files${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`;
                this.showResult(successMsg, 'success', result.files);
                
                // Reset form
                document.getElementById('file-input').value = '';
                document.getElementById('file-list').innerHTML = '';
                document.getElementById('repo-name').value = '';
                document.getElementById('commit-message').value = this.settings.defaultCommit;
                
                // Update dashboard
                this.updateDashboardStats();
                
            } else {
                throw new Error(result.error || result.details || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showResult('Upload failed: ' + error.message, 'error');
        } finally {
            this.hideProgress();
        }
    }

    showProgress(message) {
        const progress = document.getElementById('progress');
        const progressText = progress.querySelector('.progress-text');
        const progressBar = document.getElementById('progressBar');
        
        progressText.textContent = message;
        progress.classList.remove('hidden');
        document.getElementById('upload-btn').disabled = true;
        
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 90) {
                clearInterval(interval);
            } else {
                width += 10;
                progressBar.style.width = width + '%';
            }
        }, 300);
    }

    hideProgress() {
        document.getElementById('progress').classList.add('hidden');
        document.getElementById('progressBar').style.width = '0%';
        this.validateForm();
    }

    showResult(message, type, files = []) {
        const result = document.getElementById('result');
        result.className = `result ${type}`;
        
        let html = `<strong>${message}</strong>`;
        
        if (files.length > 0) {
            html += '<div class="file-list">';
            files.forEach(file => {
                const statusClass = file.status === 'success' ? 'success' : 'error';
                const statusText = file.status === 'success' ? '✓' : '✗';
                
                html += `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <span class="file-status ${statusClass}">${statusText}</span>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        result.innerHTML = html;
        result.classList.remove('hidden');
        
        if (type === 'success') {
            setTimeout(() => {
                result.classList.add('hidden');
            }, 5000);
        }
    }

    updateDashboardStats() {
        if (!this.user) return;

        // Filter history untuk user ini
        const userHistory = this.history.filter(h => h.user === this.user.login);
        
        // Hitung total files
        const totalFiles = userHistory.length;
        document.getElementById('totalFiles').textContent = totalFiles;

        // Hitung total storage
        const totalSize = userHistory.reduce((acc, h) => acc + (h.size || 0), 0);
        document.getElementById('totalStorage').textContent = this.formatFileSize(totalSize);

        // Hitung successful uploads
        const successfulUploads = userHistory.filter(h => h.status === 'success').length;
        document.getElementById('successfulUploads').textContent = successfulUploads;

        // Last upload
        const lastUpload = userHistory[0]?.timestamp;
        document.getElementById('lastUpload').textContent = lastUpload ? 
            new Date(lastUpload).toLocaleDateString() : '-';

        // Group by repository untuk recent repos
        const repoMap = new Map();
        userHistory.forEach(h => {
            if (h.repo) {
                if (!repoMap.has(h.repo)) {
                    repoMap.set(h.repo, 0);
                }
                repoMap.set(h.repo, repoMap.get(h.repo) + 1);
            }
        });

        // Tampilkan recent repos
        const repoList = document.getElementById('repoList');
        const repos = Array.from(repoMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (repos.length > 0) {
            repoList.innerHTML = repos.map(([repo, count]) => `
                <div class="repo-item">
                    <span class="repo-name">
                        <i class="fas fa-repository"></i>
                        ${repo.split('/')[1]}
                    </span>
                    <span class="repo-badge">
                        ${count} file${count > 1 ? 's' : ''}
                    </span>
                </div>
            `).join('');
        } else {
            repoList.innerHTML = '<div class="loading">No uploads yet</div>';
        }
    }

    displayHistory() {
        const historyList = document.getElementById('historyList');
        
        if (!this.user) {
            historyList.innerHTML = '<div class="loading">Please login to view history</div>';
            return;
        }

        // Filter history untuk user ini
        const userHistory = this.history.filter(h => h.user === this.user.login);
        
        if (userHistory.length === 0) {
            historyList.innerHTML = '<div class="loading">No upload history yet</div>';
            return;
        }

        historyList.innerHTML = userHistory.map(item => `
            <div class="history-item ${item.status}">
                <div class="history-icon">
                    <i class="fas ${item.type === 'file' ? 'fa-file' : 'fa-file-archive'}"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">${item.name}</div>
                    <div class="history-meta">
                        <span><i class="fas fa-repository"></i> ${item.repo}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(item.timestamp).toLocaleString()}</span>
                        ${item.size ? `<span><i class="fas fa-database"></i> ${this.formatFileSize(item.size)}</span>` : ''}
                    </div>
                </div>
                <span class="history-status ${item.status}">
                    ${item.status === 'success' ? '✓ Success' : '✗ Failed'}
                </span>
            </div>
        `).join('');
    }

    filterHistory() {
        const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';
        const filter = document.getElementById('historyFilter')?.value || 'all';
        
        if (!this.user) return;

        let filtered = this.history.filter(h => h.user === this.user.login);
        
        if (filter !== 'all') {
            filtered = filtered.filter(item => item.status === filter);
        }
        
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.name?.toLowerCase().includes(searchTerm) ||
                item.repo?.toLowerCase().includes(searchTerm)
            );
        }

        const historyList = document.getElementById('historyList');
        
        if (filtered.length === 0) {
            historyList.innerHTML = '<div class="loading">No history found</div>';
            return;
        }

        historyList.innerHTML = filtered.map(item => `
            <div class="history-item ${item.status}">
                <div class="history-icon">
                    <i class="fas ${item.type === 'file' ? 'fa-file' : 'fa-file-archive'}"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">${item.name}</div>
                    <div class="history-meta">
                        <span><i class="fas fa-repository"></i> ${item.repo}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(item.timestamp).toLocaleString()}</span>
                        ${item.size ? `<span><i class="fas fa-database"></i> ${this.formatFileSize(item.size)}</span>` : ''}
                    </div>
                </div>
                <span class="history-status ${item.status}">
                    ${item.status === 'success' ? '✓ Success' : '✗ Failed'}
                </span>
            </div>
        `).join('');
    }

    loadSettings() {
        const saved = localStorage.getItem('uploader_settings');
        const defaults = {
            theme: 'dark',
            defaultCommit: 'Add files via GitHub Uploader',
            defaultAutoExtract: true,
            defaultPath: ''
        };

        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    applySettings() {
        this.applyTheme(this.settings.theme);

        document.getElementById('defaultCommit').value = this.settings.defaultCommit;
        document.getElementById('defaultAutoExtract').checked = this.settings.defaultAutoExtract;
        document.getElementById('defaultPath').value = this.settings.defaultPath;
        document.getElementById('theme').value = this.settings.theme;
        
        document.getElementById('commit-message').value = this.settings.defaultCommit;
        document.getElementById('auto-extract').checked = this.settings.defaultAutoExtract;
        document.getElementById('file-path').value = this.settings.defaultPath;
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.style.setProperty('--bg-primary', '#ffffff');
            document.documentElement.style.setProperty('--bg-secondary', '#f6f8fa');
            document.documentElement.style.setProperty('--bg-tertiary', '#eaeef2');
            document.documentElement.style.setProperty('--text-primary', '#24292e');
            document.documentElement.style.setProperty('--text-secondary', '#586069');
            document.documentElement.style.setProperty('--border-color', '#e1e4e8');
        } else if (theme === 'dark') {
            document.documentElement.style.setProperty('--bg-primary', '#0d1117');
            document.documentElement.style.setProperty('--bg-secondary', '#161b22');
            document.documentElement.style.setProperty('--bg-tertiary', '#21262d');
            document.documentElement.style.setProperty('--text-primary', '#c9d1d9');
            document.documentElement.style.setProperty('--text-secondary', '#8b949e');
            document.documentElement.style.setProperty('--border-color', '#30363d');
        } else if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme(prefersDark ? 'dark' : 'light');
        }
    }

    saveSettings() {
        this.settings = {
            theme: document.getElementById('theme').value,
            defaultCommit: document.getElementById('defaultCommit').value,
            defaultAutoExtract: document.getElementById('defaultAutoExtract').checked,
            defaultPath: document.getElementById('defaultPath').value
        };

        localStorage.setItem('uploader_settings', JSON.stringify(this.settings));
        this.applySettings();
        this.showToast('Settings saved', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new GitHubUploader();
});
