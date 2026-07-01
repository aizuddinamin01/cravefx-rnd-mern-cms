import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer'; // <-- New import
import Asset from './models/Asset.js'; // <-- Import your new schema

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json()); 

// Serve the uploads folder publicly so the React frontend can fetch the 3D files later
app.use('/uploads', express.static('uploads'));

// Set up Multer storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files to the uploads folder
    },
    filename: (req, file, cb) => {
        // Add a timestamp to prevent overwriting files with the same name
        cb(null, Date.now() + '-' + file.originalname); 
    }
});
const upload = multer({ storage: storage });

// --- API ROUTES ---

// 1. Test Route
app.get('/', (req, res) => {
    res.send('3D CMS Backend is running!');
});

// 2. Upload Route (Accepts text data + 1 file)
app.post('/api/upload-3d', upload.single('3dFile'), async (req, res) => {
    try {
        // req.file contains the file info, req.body contains the text fields (title, etc)
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Save metadata to MongoDB
        const newAsset = new Asset({
            title: req.body.title || 'Untitled Asset',
            description: req.body.description || '',
            filename: req.file.filename,
            fileUrl: `http://localhost:${process.env.PORT}/uploads/${req.file.filename}`
        });

        const savedAsset = await newAsset.save();
        res.status(201).json({ message: 'Asset uploaded successfully!', data: savedAsset });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload asset' });
    }
});

// 3. Get All Assets Route (For the React Frontend)
app.get('/api/assets', async (req, res) => {
    try {
        // Fetch all assets from MongoDB, sorted by newest first
        const assets = await Asset.find().sort({ uploadDate: -1 });
        res.status(200).json(assets);
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log(' Connected to MongoDB');
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });