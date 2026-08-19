import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 Client — lazy initialization to avoid crash if env vars are missing
 */
let _r2Client = null;

export const getR2Client = () => {
    if (_r2Client) return _r2Client;

    if (!process.env.CLOUDFLARE_ENDPOINT || !process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_ACCESS_KEY) {
        throw new Error('Cloudflare R2 credentials are not configured in .env');
    }

    _r2Client = new S3Client({
        region: 'auto',
        endpoint: process.env.CLOUDFLARE_ENDPOINT,
        forcePathStyle: true,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_ACCESS_KEY,
        },
    });

    return _r2Client;
};

/**
 * Uploads a Buffer (like a PDF) to Cloudflare R2.
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} fileName - Destination file path/name inside the bucket.
 * @param {string} contentType - MIME type of the file (e.g., 'application/pdf').
 * @returns {Promise<string>} - The public URL to access the file.
 */
export const uploadBufferToR2 = async (buffer, fileName, contentType = 'application/pdf') => {
    try {
        const client = getR2Client();

        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        });

        await client.send(command);

        // Return the public URL
        const base = (process.env.CLOUDFLARE_URL || '').replace(/\/+$/, '');
        return `${base}/${fileName}`;

    } catch (error) {
        console.error('❌ Error uploading to Cloudflare R2:', error.message);
        throw new Error('Failed to upload file to cloud storage');
    }
};

/**
 * Generates a presigned URL for direct file upload to Cloudflare R2.
 * @param {string} fileName - Destination file path/name inside the bucket.
 * @param {string} contentType - MIME type of the file.
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour).
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string}>}
 */
export const getPresignedUploadUrl = async (fileName, contentType, expiresIn = 3600) => {
    try {
        const client = getR2Client();
        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: fileName,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn });
        const base = (process.env.CLOUDFLARE_URL || '').replace(/\/+$/, '');
        const publicUrl = `${base}/${fileName}`;

        return { uploadUrl, publicUrl, key: fileName };
    } catch (error) {
        console.error('❌ Error generating presigned URL:', error.message);
        throw new Error('Failed to generate upload URL');
    }
};

/**
 * Generates a presigned URL for downloading a file from Cloudflare R2.
 * @param {string} fileName - Destination file path/name inside the bucket.
 * @param {number} expiresIn - Expiration time in seconds (default 24 hours).
 * @returns {Promise<string>}
 */
export const getPresignedDownloadUrl = async (fileName) => {
    if (!fileName || fileName.startsWith('http')) return fileName;

    try {
        const client = getR2Client();

        const command = new GetObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: fileName,
        });

        const downloadUrl = await getSignedUrl(client, command, { expiresIn: 86400 });
        return downloadUrl;
    } catch (error) {
        console.error('❌ Error generating presigned download URL:', error.message);
        throw new Error('Failed to generate download URL');
    }
};

/**
 * Deletes a file/object from Cloudflare R2 / AWS S3 storage.
 * @param {string} keyOrUrl - Key or URL of the file to delete.
 * @returns {Promise<boolean>}
 */
export const deleteMedia = async (keyOrUrl) => {
    if (!keyOrUrl) return false;

    let key = keyOrUrl;
    if (keyOrUrl.startsWith('http')) {
        try {
            const parsed = new URL(keyOrUrl);
            key = parsed.pathname.startsWith('/') ? parsed.pathname.substring(1) : parsed.pathname;
        } catch (e) {
            console.error('Failed to parse key from URL:', e.message);
        }
    }

    try {
        const client = getR2Client();
        const command = new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: key,
        });

        await client.send(command);
        return true;
    } catch (error) {
        console.error('❌ Error deleting file from R2:', error.message);
        return false;
    }
};
