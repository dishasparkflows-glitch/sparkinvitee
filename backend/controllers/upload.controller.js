import { getPresignedUploadUrl } from '../services/r2.service.js';

export const getUploadUrl = async (req, res) => {
    try {
        const customerid = req.body.customerId;
        const uploadType = req.body.uploadType || 'misc';
        const fileType = req.body.fileType || 'application/octet-stream';
        // No file type restrictions — allow any file

        const timestamp = Date.now();
        
        let keyPath = '';
        if (customerid) {
            keyPath += `customers/${customerid}`;
        } else {
            keyPath += `system`;
        }

        keyPath += `/${uploadType}`;
        
        // Derive extension from mime type if possible, otherwise from filename
        const mimeToExt = {
            "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
            "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov",
            "application/pdf": "pdf", "text/plain": "txt",
            "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav"
        };
        const ext = mimeToExt[fileType] ? `.${mimeToExt[fileType]}` : '';
        
        const key = `${keyPath}/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;

        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, fileType);
        
        res.json({
            success: true,
            message: 'Upload URL generated',
            data: {
                uploadUrl,
                publicUrl,
                key
            }
        });
    } catch (error) {
        console.error('Error in getUploadUrl:', error);
        res.status(500).json({ message: 'Error generating upload URL', error: error.message });
    }
};
