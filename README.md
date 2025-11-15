# Sophia's Scribbles

A cozy, purple-themed blogging website where you can easily write, upload, and share blog posts with your readers.

## Features

- Beautiful, cozy purple theme designed for comfortable reading
- **Secure authentication** - Only authorized users can create/delete posts
- Easy-to-use admin interface for creating and managing blog posts
- Support for Markdown formatting in blog posts
- Upload markdown files or write directly in the browser
- Responsive design that works on desktop and mobile
- Simple and lightweight - no database required!
- Session-based login with secure password hashing

## Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd SophiaScribbles
```

2. Install dependencies:
```bash
npm install
```

3. **IMPORTANT - Set up admin credentials:**

   Create a `.env` file in the project root (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and change the default credentials:
   ```env
   ADMIN_USERNAME=your-username
   ADMIN_PASSWORD=your-secure-password
   SESSION_SECRET=generate-a-random-string-here
   ```

   **Security Note:** The default credentials are:
   - Username: `sophia`
   - Password: `changeme123`

   **You MUST change these before deploying to production!**

4. Start the server:
```bash
npm start
```

5. Open your browser and visit:
   - **Blog**: http://localhost:3000
   - **Admin Login**: http://localhost:3000/login
   - **Admin Panel**: http://localhost:3000/admin (requires login)

## How to Use

### For Blog Owners (Admin)

1. Visit http://localhost:3000/login
2. Log in with your admin credentials (default: username `sophia`, password `changeme123`)
3. Once logged in, you'll be redirected to the admin dashboard
4. Create a new post:
   - **Title**: Your blog post title
   - **Author**: Your name (optional)
   - **Excerpt**: A short preview (optional - will auto-generate if left blank)
   - **Content**: Choose to write directly or upload a markdown file
5. Click "Publish Post"
6. Your post is now live!
7. Manage existing posts in the "Manage Posts" section
8. Click "Logout" when you're done

**Note:** Only logged-in admin users can create or delete posts. Sessions last 24 hours.

### Writing in Markdown

Markdown is a simple way to format text. Here are some examples:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

[Link text](https://example.com)

- Bullet point 1
- Bullet point 2

> This is a blockquote

\`\`\`
Code block
\`\`\`
```

### Managing Posts

- View all your posts in the "Manage Posts" section on the admin page
- Delete posts you no longer want by clicking the "Delete" button

### For Readers (Everyone)

Simply visit http://localhost:3000 to:
- See all blog posts
- Click on any post to read the full content
- Navigate back to see all posts

No authentication required - the blog is publicly readable!

## Project Structure

```
SophiaScribbles/
├── server.js           # Express server with authentication & API
├── package.json        # Project dependencies
├── .env.example        # Example environment configuration
├── .env               # Your environment variables (create this!)
├── .gitignore         # Git ignore file
├── public/            # Frontend files
│   ├── index.html     # Main blog page (public)
│   ├── login.html     # Admin login page
│   ├── admin.html     # Admin dashboard (protected)
│   └── styles.css     # Cozy purple theme styling
├── blogs/             # Blog storage (file-based)
│   ├── metadata.json  # Blog post metadata
│   └── *.md          # Individual blog post files
└── README.md          # This file
```

## Deployment

### Deploy to a Server

1. Copy all files to your server
2. Install dependencies: `npm install`
3. **CRITICAL - Configure environment variables** (see below)
4. Set up environment variables on your server
5. Start the server: `npm start`
6. Consider using a process manager like PM2 for production:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "sophias-scribbles"
   pm2 save
   ```

### Environment Variables

Configure these in your `.env` file or server environment:

- `ADMIN_USERNAME`: The admin username for login (default: `sophia`)
- `ADMIN_PASSWORD`: The admin password (default: `changeme123` - **CHANGE THIS!**)
- `SESSION_SECRET`: A random string for session encryption (default: weak - **CHANGE THIS!**)
- `PORT`: The port to run the server on (default: 3000)
- `NODE_ENV`: Set to `production` for production deployments (enables secure cookies)

**Production Security:**
```bash
# Generate a strong session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Set strong credentials
ADMIN_USERNAME=your-username
ADMIN_PASSWORD=your-very-secure-password
NODE_ENV=production
```

## Customization

### Change the Theme

Edit `public/styles.css` and modify the CSS variables at the top:

```css
:root {
  --primary-purple: #8B7AB8;
  --deep-purple: #6B5B95;
  --light-purple: #B4A7D6;
  /* ... modify colors as desired ... */
}
```

### Change the Site Title

Edit the `<h1>` tags in:
- `public/index.html`
- `public/admin.html`
- `public/login.html`

### Change Admin Credentials

To change the admin username or password:
1. Edit your `.env` file
2. Update `ADMIN_USERNAME` and `ADMIN_PASSWORD`
3. Restart the server

The password is automatically hashed using bcrypt for security.

## Security

This blog uses session-based authentication with the following security features:
- **Password hashing** with bcrypt
- **Session management** with express-session
- **HTTP-only cookies** to prevent XSS attacks
- **Secure cookies** in production (when NODE_ENV=production)
- **Protected API endpoints** - only authenticated users can create/delete posts
- **24-hour session expiration**

**Important Security Notes:**
- Always change the default credentials before deploying
- Use a strong, random SESSION_SECRET
- Keep your `.env` file private (it's already in `.gitignore`)
- Consider adding HTTPS in production for encrypted communication
- The blog content is publicly readable - only admin functions require authentication

## Tips

- **Backup your blogs**: The `blogs/` folder contains all your posts - back it up regularly!
- **Preview markdown**: Use the example in the admin panel as a guide for formatting
- **Images**: You can use image URLs in your markdown: `![Alt text](https://example.com/image.jpg)`
- **Keep it simple**: The beauty of this blog is its simplicity - perfect for focused writing

## Troubleshooting

**Posts not showing up?**
- Check that the blogs directory exists and contains metadata.json
- Check the browser console for errors

**Can't upload files?**
- Make sure the file is .md, .markdown, or .txt format
- Check that the blogs directory has write permissions

**Server won't start?**
- Make sure port 3000 isn't already in use
- Run `npm install` to ensure all dependencies are installed

## License

ISC

## Support

This is a simple blogging platform perfect for personal use. Enjoy your cozy writing space!

---

Made with love for cozy blogging
