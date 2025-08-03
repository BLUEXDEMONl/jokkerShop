require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
    uploadFile
} = require("@huggingface/hub");

const app = express();
const PORT = 7860;

const repo = "api-ix/IMAGES";
const HUG_KEY = process.env.HUG_KEY;

class ErrorHandler extends Error {
    constructor(statusCode, message) {
        super();
        this.statusCode = statusCode;
        this.message = message;
    }
}

async function uploadToHuggingFace(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new ErrorHandler(404, `❌ Error: File not found at '${filePath}'`);
    }

    const originalFilename = path.basename(filePath);
    const randomName =
        crypto.randomBytes(4).toString("hex") + path.extname(originalFilename);
    const fileContent = fs.readFileSync(filePath);
    const file = new File([fileContent], randomName);

    try {
        await uploadFile({
            repo: {
                name: repo,
                type: "space"
            },
            file: file,
            path: randomName,
            credentials: {
                accessToken: HUG_KEY,
            },
        });
        return `https://huggingface.co/spaces/${repo}/resolve/main/${randomName}`;
    } catch (err) {
        throw new ErrorHandler(500, `❌ Upload failed: ${err.message}`);
    }
}

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

const upload = multer({
    dest: 'public/media/uploads/',
    fileFilter: function(req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const dataFile = path.join(__dirname, 'data', 'posts.json');

function getPosts() {
    try {
        if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('No existing posts file found or error reading, starting with empty array');
    }
    return [];
}

function savePosts(posts) {
    try {
        const dataDir = path.dirname(dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {
                recursive: true
            });
        }
        fs.writeFileSync(dataFile, JSON.stringify(posts, null, 2));
    } catch (error) {
        console.error('Error saving posts:', error);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
});

app.get('/jokker', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jokker.html'))
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'))
});

app.get('/api/posts', (req, res) => {
    const posts = getPosts();
    res.json(posts);
});

app.post('/api/posts/:id/like', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex !== -1) {
        posts[postIndex].likes = (posts[postIndex].likes || 0) + 1;
        savePosts(posts);
        res.json(posts[postIndex]);
    } else {
        res.status(404).json({
            message: 'Post not found'
        });
    }
});

app.get('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const posts = getPosts();
    const post = posts.find(p => p.id === postId);

    if (post) {
        res.json(post.comments || []);
    } else {
        res.status(404).json({
            message: 'Post not found'
        });
    }
});

app.post('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Comment text is required' });
    }

    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex !== -1) {
        const newComment = {
            id: Date.now(),
            text: text,
            createdAt: new Date().toISOString()
        };

        if (!posts[postIndex].comments) {
            posts[postIndex].comments = [];
        }

        posts[postIndex].comments.push(newComment);
        savePosts(posts);
        res.status(201).json(newComment);
    } else {
        res.status(404).json({
            message: 'Post not found'
        });
    }
});

app.post('/api/upload', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: 'Please select one or more image files!'
            });
        }

        const {
            caption,
            price
        } = req.body;

        if (!caption || !price) {
            return res.status(400).json({
                message: 'Please fill in all fields!'
            });
        }

        const imageUrls = [];
        for (const file of req.files) {
            const imageUrl = await uploadToHuggingFace(file.path);
            imageUrls.push(imageUrl);
            fs.unlinkSync(file.path);
        }

        const newPost = {
            id: Date.now(),
            images: imageUrls,
            caption: caption.trim(),
            price: parseFloat(price),
            createdAt: new Date().toISOString(),
            likes: 0,
            comments: 0,
            shares: 0
        };

        const posts = getPosts();
        posts.unshift(newPost);
        savePosts(posts);

        res.status(201).json({
            message: 'Account listing posted successfully!'
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (error instanceof ErrorHandler) {
            res.status(error.statusCode).json({
                message: error.message
            });
        } else {
            res.status(500).json({
                message: 'Error uploading account. Please try again.'
            });
        }
    }
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'File too large! Maximum size is 5MB.'
            });
        }
    }
    res.status(500).json({
        message: 'Upload error: ' + error.message
    });
});

app.listen(PORT, () => {
    console.log(`🚀 JokkerShop Nx server running on port ${PORT}`);
    console.log(`📱 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`🏠 Homepage: http://localhost:${PORT}/`);
});