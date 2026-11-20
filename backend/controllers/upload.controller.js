import { getPresignedUploadUrl } from '../services/r2.service.js';
import ApiResponse from '../utils/ApiResponse.js';

export const getUploadUrl = async (req, res) => {
    try {
        const customerid = (req.body.customerId && typeof req.body.customerId === 'object')
            ? req.body.customerId._id
            : req.body.customerId;
        const uploadType = req.body.uploadType || 'misc';
        const fileType = req.body.fileType || 'application/octet-stream';

        const timestamp = Date.now();
        
        let keyPath = customerid ? `customers/${customerid}` : `system`;
        keyPath += `/${uploadType}`;
        
        // Derive extension from mime type if possible, otherwise from filename
        const mimeToExt = {
            "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
            "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov",
            "application/pdf": "pdf", "text/plain": "txt",
            "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav"
        };
        let ext = mimeToExt[fileType] ? `.${mimeToExt[fileType]}` : '';
        if (!ext && req.body.fileName) {
            const dotIdx = req.body.fileName.lastIndexOf('.');
            if (dotIdx !== -1) ext = req.body.fileName.substring(dotIdx).toLowerCase();
        }
        
        const key = `${keyPath}/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;

        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, fileType);
        
        return ApiResponse.success(res, {
            uploadUrl,
            publicUrl,
            key
        }, 'Upload URL generated');
    } catch (error) {
        console.error('Error in getUploadUrl:', error);
        return ApiResponse.error(res, error.message);
    }
};
