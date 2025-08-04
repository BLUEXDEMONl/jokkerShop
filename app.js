require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    ErrorHandler,
    uploadToHuggingFace,
    getPosts,
    savePosts,
    generatePostId
} = require('./func');

const app = express();
const PORT = 7860;

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
            id: generatePostId(),
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
            id: generatePostId(),
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