require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { marked } = require('marked');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Configure marked to be safe
marked.setOptions({
  sanitize: false,
  breaks: true,
  gfm: true
});

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply API rate limiter to all API routes
app.use('/api/', apiLimiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
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
    // Sanitize filename to prevent path traversal
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const uniqueName = Date.now() + '-' + sanitizedName;
    cb(null, uniqueName);
  }
});

// File filter for upload validation
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['text/markdown', 'text/plain', 'application/octet-stream'];
  const allowedExtensions = ['.md', '.markdown', '.txt'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .md, .markdown, and .txt files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1
  }
});

// Helper function to prevent path traversal
function sanitizePath(filename) {
  // Remove any path separators and parent directory references
  return path.basename(filename);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
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

    // Sanitize filename to prevent path traversal
    const safeFilename = sanitizePath(blog.filename);
    const content = await fs.readFile(`./blogs/${safeFilename}`, 'utf-8');
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

// Login endpoint with rate limiting and validation
app.post('/api/login',
  loginLimiter,
  body('username').trim().isLength({ min: 1, max: 50 }).escape(),
  body('password').isLength({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      req.session.username = username;
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  }
);

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
    const { title, author, excerpt } = req.body;

    // Validate inputs
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: 'Title must be less than 200 characters' });
    }

    let content = '';
    let filename = '';

    if (req.file) {
      // Markdown file uploaded
      filename = req.file.filename;
      content = await fs.readFile(req.file.path, 'utf-8');

      // Validate content size
      if (content.length > 1000000) { // 1MB of text
        await fs.unlink(req.file.path); // Clean up uploaded file
        return res.status(400).json({ error: 'Content is too large (max 1MB)' });
      }
    } else if (req.body.content) {
      // Content provided directly
      content = req.body.content;

      if (content.length > 1000000) {
        return res.status(400).json({ error: 'Content is too large (max 1MB)' });
      }

      // Sanitize filename
      const safeTitle = title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      filename = Date.now() + '-' + safeTitle + '.md';
      await fs.writeFile(`./blogs/${filename}`, content);
    } else {
      return res.status(400).json({ error: 'No content provided' });
    }

    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    const blogs = JSON.parse(data);

    const sanitizedAuthor = author ? author.substring(0, 100) : 'Anonymous';
    const autoExcerpt = content.substring(0, 150).replace(/[#*_`]/g, '') + '...';
    const sanitizedExcerpt = excerpt ? excerpt.substring(0, 300) : autoExcerpt;

    const newBlog = {
      id: Date.now().toString(),
      title: title.substring(0, 200),
      author: sanitizedAuthor,
      date: new Date().toISOString(),
      excerpt: sanitizedExcerpt,
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

// Delete blog post (PROTECTED)
app.delete('/api/blogs/:id', requireAuth, async (req, res) => {
  try {
    const data = await fs.readFile('./blogs/metadata.json', 'utf-8');
    let blogs = JSON.parse(data);
    const blog = blogs.find(b => b.id === req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Sanitize filename to prevent path traversal
    const safeFilename = sanitizePath(blog.filename);

    // Delete the file
    await fs.unlink(`./blogs/${safeFilename}`);

    // Remove from metadata
    blogs = blogs.filter(b => b.id !== req.params.id);
    await fs.writeFile('./blogs/metadata.json', JSON.stringify(blogs, null, 2));

    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete blog' });
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

    // Validate input lengths
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title must be less than 200 characters' });
    }

    if (content.length > 100000) {
      return res.status(400).json({ error: 'Content is too large (max 100KB)' });
    }

    const aboutData = {
      title: title.substring(0, 200),
      content: content.substring(0, 100000)
    };

    await fs.writeFile('./about.json', JSON.stringify(aboutData, null, 2));

    const htmlContent = marked(aboutData.content);
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

// Newsletter subscription endpoint with validation
app.post('/api/newsletter/subscribe',
  body('email').isEmail().normalizeEmail().isLength({ max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    try {
      const { email } = req.body;

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
  }
);

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
