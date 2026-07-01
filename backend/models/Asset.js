import mongoose from "mongoose";

const assetSchema = new mongoose.Schema({

    title: {type: String, required: true },
    description:{type:String},
    filename:{ type: String, required: true},
    fileUrl:{ type: String, required: true},
    uploadDate:{ type: Date, default: Date.now},

});

export default mongoose.model('Asset',assetSchema);