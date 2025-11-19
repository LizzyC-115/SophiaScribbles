require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const bcrypt = require('bcrypt');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

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

// Storage for image uploads
const imageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = './uploads';
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

const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

function normalizeCoverImage(input) {
  if (!input) return '';
  const value = input.trim();

  const markdownMatch = value.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }

  return value;
}

// Check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login.html');
}

// Ensure blogs directory and metadata file exist
async function initializeStorage() {
  try {
    await fs.access('./blogs');
  } catch {
    await fs.mkdir('./blogs', { recursive: true });
  }

  try {
    await fs.access('./uploads');
  } catch {
    await fs.mkdir('./uploads', { recursive: true });
  }

  try {
    await fs.access('./blogs/metadata.json');
  } catch {
    await fs.writeFile('./blogs/metadata.json', JSON.stringify([], null, 2));
  }

  try {
    await fs.access('./newsletter-subscribers.json');
  } catch {
    await fs.writeFile('./newsletter-subscribers.json', JSON.stringify([], null, 2));
  }

  try {
    await fs.access('./about.json');
  } catch {
    const defaultAbout = {
      title: "About Sophia",
      content: "# About Me\n\nWelcome to my cozy corner of the internet! I'm Sophia, and this is where I share my thoughts, stories, and musings.\n\n## Who I Am\n\nI'm a writer, dreamer, and lover of all things creative. This blog is my space to explore ideas, share experiences, and connect with wonderful people like you.\n\n## What You'll Find Here\n\nOn this blog, I write about:\n- Life's little moments\n- Creative inspiration\n- Personal growth\n- And whatever else captures my imagination\n\n## Let's Connect\n\nI'd love to hear from you! Subscribe to my newsletter below to stay updated on new posts.\n\nThank you for being here. ✨"
    };
    await fs.writeFile('./about.json', JSON.stringify(defaultAbout, null, 2));
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

// Determine if the stored password is hashed (bcrypt hash starts with $2)
async function verifyAdminPassword(inputPassword) {
  const storedPassword = process.env.ADMIN_PASSWORD || '';

  if (storedPassword.startsWith('$2')) {
    try {
      return await bcrypt.compare(inputPassword, storedPassword);
    } catch (error) {
      console.error('Password comparison failed:', error);
      return false;
    }
  }

  return inputPassword === storedPassword;
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const passwordValid = await verifyAdminPassword(password);

    if (username === process.env.ADMIN_USERNAME && passwordValid) {
      req.session.isAdmin = true;
      req.session.username = username;
      return res.json({ success: true, message: 'Login successful' });
    }

    res.status(401).json({ success: false, error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// Create new blog post (PROTECTED)
app.post('/api/blogs', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, author, excerpt, coverImage } = req.body;
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

    const normalizedCover = normalizeCoverImage(coverImage);

    const newBlog = {
      id: Date.now().toString(),
      title,
      author: author || 'Anonymous',
      date: new Date().toISOString(),
      excerpt: excerpt || content.substring(0, 150).replace(/[#*_]/g, '') + '...',
      filename,
      coverImage: normalizedCover
    };

    blogs.push(newBlog);
    await fs.writeFile('./blogs/metadata.json', JSON.stringify(blogs, null, 2));

    res.json(newBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// Update blog post (PROTECTED)
app.put('/api/blogs/:id', requireAuth, async (req, res) => {
  try {
    const { title, author, excerpt, content, coverImage } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    let blogs = JSON.parse(data);
    const blogIndex = blogs.findIndex(b => b.id === req.params.id);

    if (blogIndex === -1) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const blog = blogs[blogIndex];

    // Update the markdown file
    await fs.writeFile(`./blogs/${blog.filename}`, content);

    // Update metadata
    const normalizedCover = coverImage !== undefined ? normalizeCoverImage(coverImage) : undefined;

    blogs[blogIndex] = {
      ...blog,
      title,
      author: author || blog.author,
      excerpt: excerpt || content.substring(0, 150).replace(/[#*_]/g, '') + '...',
      coverImage: normalizedCover !== undefined ? normalizedCover : (blog.coverImage || ''),
      // Keep original date and filename
    };

    await fs.writeFile('./blogs/metadata.json', JSON.stringify(blogs, null, 2));

    res.json({
      success: true,
      message: 'Blog updated successfully',
      blog: blogs[blogIndex]
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// Delete blog post (PROTECTED)
app.delete('/api/blogs/:id', requireAuth, async (req, res) => {
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

// Upload image (PROTECTED - admin only)
app.post('/api/upload-image', requireAuth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const markdownSyntax = `![Image description](${imageUrl})`;

    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      markdown: markdownSyntax,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// Get About page content (PUBLIC)
app.get('/api/about', async (req, res) => {
  try {
    const data = await fs.readFile('./about.json', 'utf-8');
    const about = JSON.parse(data);
    const htmlContent = marked(about.content);
    res.json({
      ...about,
      htmlContent
    });
  } catch (error) {
    console.error('Error loading about page:', error);
    res.status(500).json({ error: 'Failed to load about page' });
  }
});

// Update About page content (PROTECTED - admin only)
app.put('/api/about', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const aboutData = {
      title,
      content
    };

    await fs.writeFile('./about.json', JSON.stringify(aboutData, null, 2));
    
    const htmlContent = marked(content);
    res.json({ 
      success: true, 
      message: 'About page updated successfully',
      ...aboutData,
      htmlContent
    });
  } catch (error) {
    console.error('Error updating about page:', error);
    res.status(500).json({ error: 'Failed to update about page' });
  }
});

// Newsletter subscription endpoint
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const data = await fs.readFile('./newsletter-subscribers.json', 'utf-8');
    let subscribers = JSON.parse(data);

    // Check if email already exists
    const existingSubscriber = subscribers.find(sub => sub.email.toLowerCase() === email.toLowerCase());
    
    if (existingSubscriber) {
      return res.status(400).json({ error: 'This email is already subscribed!' });
    }

    // Add new subscriber
    const newSubscriber = {
      email: email.toLowerCase(),
      subscribedAt: new Date().toISOString(),
      id: Date.now().toString()
    };

    subscribers.push(newSubscriber);
    await fs.writeFile('./newsletter-subscribers.json', JSON.stringify(subscribers, null, 2));

    res.json({ 
      success: true, 
      message: 'Thank you for subscribing! You\'ll receive updates about new posts.' 
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe. Please try again later.' });
  }
});

// Get newsletter subscribers (PROTECTED - admin only)
app.get('/api/newsletter/subscribers', requireAuth, async (req, res) => {
  try {
    const data = await fs.readFile('./newsletter-subscribers.json', 'utf-8');
    const subscribers = JSON.parse(data);
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load subscribers' });
  }
});

// Delete newsletter subscriber (PROTECTED - admin only)
app.delete('/api/newsletter/subscribers/:id', requireAuth, async (req, res) => {
  try {
    const data = await fs.readFile('./newsletter-subscribers.json', 'utf-8');
    let subscribers = JSON.parse(data);
    
    const subscriber = subscribers.find(sub => sub.id === req.params.id);
    
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    // Remove subscriber
    subscribers = subscribers.filter(sub => sub.id !== req.params.id);
    await fs.writeFile('./newsletter-subscribers.json', JSON.stringify(subscribers, null, 2));

    res.json({ success: true, message: 'Subscriber removed successfully' });
  } catch (error) {
    console.error('Error removing subscriber:', error);
    res.status(500).json({ error: 'Failed to remove subscriber' });
  }
});

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page (PROTECTED)
app.get('/admin', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
initializeStorage().then(() => {
  app.listen(PORT, () => {
    console.log(`Sophia's Scribbles is running on http://localhost:${PORT}`);
  });
});
