import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import { Server } from 'socket.io';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import os from 'node:os'; // Added to tap into system temp folders

// Import your Asset model
import Asset from './models/Asset.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. SOCKET.IO SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allows React to connect
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log(`A user connected to WebSockets: ${socket.id}`);

    // Listen for custom 3D interaction events
    socket.on('changeColor', (data) => {
        console.log(`Color change received: ${data.color}`);
        // Broadcast this change to EVERYONE else
        socket.broadcast.emit('updateColor', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// --- 2. CLOUDINARY & MULTER SETUP ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// FIX: Uses the OS temp directory so it works flawlessly on cloud hosts like Render
const upload = multer({ dest: os.tmpdir() });

// --- 3. API ROUTES ---

// POST Route: Upload File to Cloudinary & Save Data to MongoDB (Secured)
app.post('/api/upload-3d', upload.single('3dFile'), async (req, res) => {
    try {
        // 1. Guard Rail: Verify Admin Passcode before touching Cloudinary
        const clientPasscode = req.headers['x-admin-passcode'];
        const correctPasscode = process.env.ADMIN_PASSCODE;

        if (!correctPasscode || clientPasscode !== correctPasscode) {
            // Clean up the temp file immediately if unauthorized
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({ error: 'Unauthorized: Invalid Admin Passcode' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 2. Push the temporary local file to Cloudinary
        const cloudinaryResponse = await cloudinary.uploader.upload(req.file.path, {
            folder: '3d-cms-assets',
            resource_type: 'auto'
        });

        // 3. Delete the temporary local file from your server
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

       // Update this mapping block inside your app.post route:
        const newAsset = new Asset({
            title: req.body.title || 'Untitled Model',
            filename: req.file.originalname,
            fileUrl: cloudinaryResponse.secure_url,
            fileSize: cloudinaryResponse.bytes, // Save the size in bytes!
        });

        const savedAsset = await newAsset.save();
        res.status(201).json({ message: 'Asset uploaded successfully!', data: savedAsset });

    } catch (error) {
        console.error('Error saving asset:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload asset' });
    }
});

// GET Route: Fetch all assets for the React UI
app.get('/api/assets', async (req, res) => {
    try {
        const assets = await Asset.find().sort({ uploadDate: -1 });
        res.status(200).json(assets);
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// --- 4. START SERVER & DATABASE ---
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`Server and WebSockets running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });