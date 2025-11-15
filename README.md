# Sophia's Scribbles

A cozy, purple-themed blogging website where you can easily write, upload, and share blog posts with your readers.

## Features

- Beautiful, cozy purple theme designed for comfortable reading
- Easy-to-use admin interface for creating and managing blog posts
- Support for Markdown formatting in blog posts
- Upload markdown files or write directly in the browser
- Responsive design that works on desktop and mobile
- Simple and lightweight - no database required!

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

3. Start the server:
```bash
npm start
```

4. Open your browser and visit:
   - **Blog**: http://localhost:3000
   - **Admin Panel**: http://localhost:3000/admin

## How to Use

### For Blog Authors

1. Visit http://localhost:3000/admin
2. Fill in the post details:
   - **Title**: Your blog post title
   - **Author**: Your name (optional)
   - **Excerpt**: A short preview (optional - will auto-generate if left blank)
3. Choose how to add content:
   - **Write here**: Type or paste your markdown content directly
   - **Upload file**: Upload a .md or .txt file
4. Click "Publish Post"
5. Your post is now live!

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

### For Readers

Simply visit http://localhost:3000 to:
- See all blog posts
- Click on any post to read the full content
- Navigate back to see all posts

## Project Structure

```
SophiaScribbles/
├── server.js           # Express server and API endpoints
├── package.json        # Project dependencies
├── public/            # Frontend files
│   ├── index.html     # Main blog page
│   ├── admin.html     # Admin interface
│   └── styles.css     # Cozy purple theme styling
├── blogs/             # Blog storage
│   ├── metadata.json  # Blog post metadata
│   └── *.md          # Individual blog post files
└── README.md          # This file
```

## Deployment

### Deploy to a Server

1. Copy all files to your server
2. Install dependencies: `npm install`
3. Set the PORT environment variable if needed: `export PORT=3000`
4. Start the server: `npm start`
5. Consider using a process manager like PM2 for production:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "sophias-scribbles"
   pm2 save
   ```

### Environment Variables

- `PORT`: The port to run the server on (default: 3000)

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

### Add Authentication

Currently, the admin panel is open to anyone. To add password protection, consider:
- Adding a simple password check
- Using middleware like `express-basic-auth`
- Implementing a full authentication system

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
