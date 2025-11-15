const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Storage for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = './blogs';
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Ensure blogs directory and metadata file exist
async function initializeStorage() {
  try {
    await fs.access('./blogs');
  } catch {
    await fs.mkdir('./blogs', { recursive: true });
  }

  try {
    await fs.access('./blogs/metadata.json');
  } catch {
    await fs.writeFile('./blogs/metadata.json', JSON.stringify([], null, 2));
  }
}

// Get all blog posts
app.get('/api/blogs', async (req, res) => {
  try {
    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    const blogs = JSON.parse(data);
    // Sort by date, newest first
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load blogs' });
  }
});

// Get single blog post
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    const blogs = JSON.parse(data);
    const blog = blogs.find(b => b.id === req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const content = await fs.readFile(`./blogs/${blog.filename}`, 'utf-8');
    const htmlContent = marked(content);

    res.json({
      ...blog,
      content: htmlContent,
      rawContent: content
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load blog' });
  }
});

// Create new blog post
app.post('/api/blogs', upload.single('file'), async (req, res) => {
  try {
    const { title, author, excerpt } = req.body;
    let content = '';
    let filename = '';

    if (req.file) {
      // Markdown file uploaded
      filename = req.file.filename;
      content = await fs.readFile(req.file.path, 'utf-8');
    } else if (req.body.content) {
      // Content provided directly
      content = req.body.content;
      filename = Date.now() + '-' + title.replace(/\s+/g, '-').toLowerCase() + '.md';
      await fs.writeFile(`./blogs/${filename}`, content);
    } else {
      return res.status(400).json({ error: 'No content provided' });
    }

    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    const blogs = JSON.parse(data);

    const newBlog = {
      id: Date.now().toString(),
      title,
      author: author || 'Anonymous',
      date: new Date().toISOString(),
      excerpt: excerpt || content.substring(0, 150).replace(/[#*_]/g, '') + '...',
      filename
    };

    blogs.push(newBlog);
    await fs.writeFile('./blogs/metadata.json', JSON.stringify(blogs, null, 2));

    res.json(newBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// Delete blog post
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    let blogs = JSON.parse(data);
    const blog = blogs.find(b => b.id === req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Delete the file
    await fs.unlink(`./blogs/${blog.filename}`);

    // Remove from metadata
    blogs = blogs.filter(b => b.id !== req.params.id);
    await fs.writeFile('./blogs/metadata.json', JSON.stringify(blogs, null, 2));

    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete blog' });
  }
});

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
initializeStorage().then(() => {
  app.listen(PORT, () => {
    console.log(`Sophia's Scribbles is running on http://localhost:${PORT}`);
  });
});
