import mongoose from "mongoose";

// Inside your Asset.js schema, make sure it has a field for size:
const assetSchema = new mongoose.Schema({
    title: String,
    filename: String,
    fileUrl: String,
    fileSize: { type: Number, default: 0 }, // Size in bytes
    uploadDate: { type: Date, default: Date.now }
});
export default mongoose.model('Asset',assetSchema);