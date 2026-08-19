import { getPresignedUploadUrl } from '../services/r2.service.js';

export const getUploadUrl = async (req, res) => {
    try {
        const customerid = req.body.customerId;
        const uploadType = req.body.uploadType || 'misc';
        const fileType = req.body.fileType || 'image/jpeg';
        
        // Basic file type validation based on reference code
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-matroska",
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "audio/mpeg",
            "audio/mp4",
            "audio/aac",
            "audio/ogg",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
            "audio/3gpp"
        ];

        if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({ message: "Invalid file type. Only images, audio, video, PDFs, and documents are allowed." });
        }

        if (req.body.fileSize && req.body.fileSize > 10 * 1024 * 1024) {
            return res.status(400).json({ message: "File size exceeds 10MB limit." });
        }

        const timestamp = Date.now();
        
        let keyPath = '';
        if (customerid) {
            keyPath += `customers/${customerid}`;
        } else {
            keyPath += `system`;
        }

        keyPath += `/${uploadType}`;
        
        const extMap = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "video/mp4": "mp4",
            "application/pdf": "pdf",
            "text/plain": "txt"
        };
        const ext = extMap[fileType] ? `.${extMap[fileType]}` : '';
        
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
