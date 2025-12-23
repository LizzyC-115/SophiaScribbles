require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { marked } = require('marked');

// Simple token-based auth for serverless (works across function invocations)
const AUTH_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-this';

function generateAuthToken(username) {
  const data = `${username}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(data);
  return `${Buffer.from(data).toString('base64')}.${hmac.digest('hex')}`;
}

function verifyAuthToken(token) {
  if (!token) return null;
  try {
    const [dataB64, signature] = token.split('.');
    if (!dataB64 || !signature) return null;
    
    const data = Buffer.from(dataB64, 'base64').toString();
    const hmac = crypto.createHmac('sha256', AUTH_SECRET);
    hmac.update(data);
    const expectedSig = hmac.digest('hex');
    
    if (signature !== expectedSig) return null;
    
    const [username, timestamp] = data.split(':');
    const age = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) return null;
    return username;
  } catch {
    return null;
  }
}

let db, bucket, firebaseError;
try {
  const firebase = require('./firebaseClient');
  db = firebase.db;
  bucket = firebase.bucket;
} catch (error) {
  firebaseError = error.message;
  console.error('Firebase initialization error:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    firebase: db ? 'connected' : 'not connected',
    error: firebaseError || null,
    env: {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasStorageBucket: !!process.env.FIREBASE_STORAGE_BUCKET,
      serviceAccountStart: process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 20) : null
    }
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(AUTH_SECRET));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Use memory storage for multer (files go to Firebase Storage)
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });
const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  const token = req.signedCookies.authToken;
  const username = verifyAuthToken(token);
  if (username) {
    req.username = username;
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

// Check if user is authenticated (for page redirects)
function isAuthenticated(req, res, next) {
  const token = req.signedCookies.authToken;
  const username = verifyAuthToken(token);
  if (username) {
    req.username = username;
    return next();
  }
  res.redirect('/login.html');
}

// Initialize Firestore collections with defaults if needed
async function initializeStorage() {
  try {
    // Ensure aboutPage doc exists with default content
    const aboutRef = db.collection('config').doc('aboutPage');
    const aboutSnap = await aboutRef.get();
    if (!aboutSnap.exists) {
      await aboutRef.set({
        title: "About Sophia",
        content: "# About Me\n\nWelcome to my cozy corner of the internet! I'm Sophia, and this is where I share my thoughts, stories, and musings.\n\n## Who I Am\n\nI'm a writer, dreamer, and lover of all things creative. This blog is my space to explore ideas, share experiences, and connect with wonderful people like you.\n\n## What You'll Find Here\n\nOn this blog, I write about:\n- Life's little moments\n- Creative inspiration\n- Personal growth\n- And whatever else captures my imagination\n\n## Let's Connect\n\nI'd love to hear from you! Subscribe to my newsletter below to stay updated on new posts.\n\nThank you for being here. ✨"
      });
    }
  } catch (error) {
    console.error('Warning: Could not initialize storage:', error.message);
    // Continue anyway - the server can still start
  }
}

// Get all blog posts
app.get('/api/blogs', async (req, res) => {
  try {
    const snapshot = await db.collection('posts').orderBy('date', 'desc').get();
    const blogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(blogs);
  } catch (error) {
    console.error('Error loading blogs:', error);
    res.status(500).json({ error: 'Failed to load blogs' });
  }
});

// Get single blog post
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const docRef = db.collection('posts').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const blog = { id: docSnap.id, ...docSnap.data() };
    const rawContent = blog.content || '';
    const htmlContent = marked(rawContent);

    res.json({
      ...blog,
      content: htmlContent,
      rawContent
    });
  } catch (error) {
    console.error('Error loading blog:', error);
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
      const token = generateAuthToken(username);
      res.cookie('authToken', token, {
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
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
  res.clearCookie('authToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  const token = req.signedCookies.authToken;
  const username = verifyAuthToken(token);
  if (username) {
    res.json({ authenticated: true, username });
  } else {
    res.json({ authenticated: false });
  }
});

// Create new blog post (PROTECTED)
app.post('/api/blogs', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, author, excerpt, coverImage } = req.body;
    let content = '';

    if (req.file) {
      content = req.file.buffer.toString('utf8');
    } else if (req.body.content) {
      content = req.body.content;
    } else {
      return res.status(400).json({ error: 'No content provided' });
    }

    const normalizedCover = normalizeCoverImage(coverImage);
    const postId = Date.now().toString();

    const newBlog = {
      title,
      author: author || 'Anonymous',
      date: new Date().toISOString(),
      excerpt: excerpt || content.substring(0, 150).replace(/[#*_]/g, '') + '...',
      content,
      coverImage: normalizedCover
    };

    // Save to Firestore (content stored directly in document)
    await db.collection('posts').doc(postId).set(newBlog);

    res.json({ id: postId, ...newBlog });
  } catch (error) {
    console.error('Error creating blog:', error);
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

    const docRef = db.collection('posts').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const blog = docSnap.data();
    const normalizedCover = coverImage !== undefined ? normalizeCoverImage(coverImage) : undefined;

    const updatedBlog = {
      ...blog,
      title,
      author: author || blog.author,
      excerpt: excerpt || content.substring(0, 150).replace(/[#*_]/g, '') + '...',
      content,
      coverImage: normalizedCover !== undefined ? normalizedCover : (blog.coverImage || '')
    };

    await docRef.update(updatedBlog);

    res.json({
      success: true,
      message: 'Blog updated successfully',
      blog: { id: req.params.id, ...updatedBlog }
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// Delete blog post (PROTECTED)
app.delete('/api/blogs/:id', requireAuth, async (req, res) => {
  try {
    const docRef = db.collection('posts').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    await docRef.delete();
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
});

// Upload image (PROTECTED - admin only) - uses Firebase Storage
app.post('/api/upload-image', requireAuth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const filename = `images/${Date.now()}-${req.file.originalname.replace(/\s+/g, '-').toLowerCase()}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    const markdownSyntax = `![Image](${publicUrl})`;

    res.json({
      success: true,
      url: publicUrl,
      filename: req.file.originalname,
      markdown: markdownSyntax,
      message: 'Image uploaded to Firebase Storage'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// Get About page content (PUBLIC)
app.get('/api/about', async (req, res) => {
  try {
    const aboutRef = db.collection('config').doc('aboutPage');
    const aboutSnap = await aboutRef.get();
    if (!aboutSnap.exists) {
      return res.status(404).json({ error: 'About page not found' });
    }
    const about = aboutSnap.data();
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

    const aboutData = { title, content };
    await db.collection('config').doc('aboutPage').set(aboutData);

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
