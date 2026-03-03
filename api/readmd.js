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

    try {
        const { repo } = req.query;
        const currentDate = new Date().toLocaleDateString('id-ID', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        const currentYear = new Date().getFullYear();

        // Gunakan repo name dari parameter, default ke [nama-repository] jika tidak ada
        const repoName = repo || '[nama-repository]';

        const readmeContent = `<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=28&duration=3000&pause=1000&color=2F81F7&center=true&vCenter=true&width=500&lines=%F0%9F%93%81+Repository+%3A+${repoName};%F0%9F%91%A4+Author+%3A+%40branpedia;%F0%9F%9A%80+Created+via+GitHub+Uploader" alt="Typing SVG" />
</div>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/Repository-${repoName}-2F81F7?style=for-the-badge&logo=github" />
  <img src="https://img.shields.io/badge/Author-%40branpedia-2F81F7?style=for-the-badge&logo=github" />
</p>

<br>

## 📋 Repository Information

<div align="center">
  <table>
    <tr>
      <td align="right" width="150"><strong>📦 Repository Name</strong></td>
      <td><code>${repoName}</code></td>
    </tr>
    <tr>
      <td align="right"><strong>👤 Author</strong></td>
      <td><a href="https://github.com/branpedia">@branpedia</a></td>
    </tr>
    <tr>
      <td align="right"><strong>⚡ Created Via</strong></td>
      <td><a href="https://branpediaid.vercel.app">GitHub Uploader</a></td>
    </tr>
    <tr>
      <td align="right"><strong>📅 Created Date</strong></td>
      <td>${currentDate}</td>
    </tr>
    <tr>
      <td align="right"><strong>📝 Description</strong></td>
      <td>Repository created automatically via GitHub Uploader</td>
    </tr>
  </table>
</div>

<br>

## 👨‍💻 Author Details

<div align="center">
  <table>
    <tr>
      <td align="center" width="200">
        <img src="https://github.com/branpedia.png" width="100" height="100" style="border-radius: 50%; border: 3px solid #2F81F7" />
        <br>
        <strong>@branpedia</strong>
      </td>
      <td>
        <table>
          <tr>
            <td align="right"><strong>🔰 Author</strong></td>
            <td>Branpedia</td>
          </tr>
          <tr>
            <td align="right"><strong>💻 Developer</strong></td>
            <td>Bran</td>
          </tr>
          <tr>
            <td align="right"><strong>🚀 Project</strong></td>
            <td>GitHub Uploader</td>
          </tr>
          <tr>
            <td align="right"><strong>🌐 Website</strong></td>
            <td><a href="https://branpediaid.vercel.app">branpediaid.vercel.app</a></td>
          </tr>
          <tr>
            <td align="right"><strong>📚 API Docs</strong></td>
            <td><em>Coming Soon</em></td>
          </tr>
          <tr>
            <td align="right"><strong>© Copyright</strong></td>
            <td>© ${currentYear} Branpedia</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>

<br>`;

        // Set content type to text/plain agar tidak di-escape
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        return res.status(200).send(readmeContent);

    } catch (error) {
        console.error('Error generating README:', error);
        return res.status(500).json({ 
            error: 'Failed to generate README',
            details: error.message 
        });
    }
};
