const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    uploadFile
} = require("@huggingface/hub");

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

function generatePostId(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

module.exports = {
    ErrorHandler,
    uploadToHuggingFace,
    getPosts,
    savePosts,
    generatePostId
};