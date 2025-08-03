const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 7860;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'account-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

let posts = [];

const dataFile = path.join(__dirname, 'data', 'posts.json');

function loadPosts() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, 'utf8');
      posts = JSON.parse(data);
    }
  } catch (error) {
    console.log('No existing posts file found, starting with empty array');
    posts = [];
  }
}

function savePosts() {
  try {
    const dataDir = path.dirname(dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dataFile, JSON.stringify(posts, null, 2));
  } catch (error) {
    console.error('Error saving posts:', error);
  }
}

loadPosts();

app.get('/', (req, res) => {
  res.render('index', { posts: posts });
});

app.get('/admin', (req, res) => {
  res.render('admin', { message: null });
});

app.post('/admin/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.render('admin', { message: 'Please select an image file!' });
    }

    const { caption, price } = req.body;
    
    if (!caption || !price) {
      return res.render('admin', { message: 'Please fill in all fields!' });
    }

    const newPost = {
      id: Date.now(),
      image: '/uploads/' + req.file.filename,
      caption: caption.trim(),
      price: parseFloat(price),
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    savePosts();

    res.render('admin', { message: 'Account listing posted successfully!' });
  } catch (error) {
    console.error('Upload error:', error);
    res.render('admin', { message: 'Error uploading account. Please try again.' });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.render('admin', { message: 'File too large! Maximum size is 5MB.' });
    }
  }
  res.render('admin', { message: 'Upload error: ' + error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 JokkerShop Nx server running on port ${PORT}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🏠 Homepage: http://localhost:${PORT}/`);
});