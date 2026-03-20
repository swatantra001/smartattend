import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

// import pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse'; // 🟢 V2 Syntax!


const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3 = async (fileBuffer: Buffer, originalName: string, folder: string): Promise<string> => {
  const uniqueFilename = `${folder}/${crypto.randomUUID()}${path.extname(originalName)}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET || 'smartattend-media',
    Key: uniqueFilename,
    Body: fileBuffer,
    ContentType: 'application/octet-stream',
  }));
  return `https://${process.env.S3_BUCKET || 'smartattend-media'}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${uniqueFilename}`;
};

// // (Keep your existing s3Client import)

export const uploadAssignmentToS3 = async (fileBuffer: Buffer, originalName: string, folder: string, mimeType: string = 'application/pdf') => {
  // 1. Keep the original name, but remove spaces so URLs don't break
  const safeOriginalName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  // 2. Prepend a tiny timestamp so identical filenames don't overwrite each other
  const fileKey = `${folder}/${Date.now()}_${safeOriginalName}`;

  const params = {
    Bucket: process.env.S3_BUCKET || 'smartattend-media',
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mimeType,       // Tells S3 exactly what the file is (PDF, JPG, etc.)
    ContentDisposition: 'inline' // 🟢 CRITICAL: Tells the browser to SHOW the file, not download it
  };

  await s3Client.send(new PutObjectCommand(params));

  // 🟢 FIX: Using the global S3 endpoint format usually works better for cross-region preview engines like Google Docs
  return `https://s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${process.env.S3_BUCKET || 'smartattend-media'}/${fileKey}`;
};


export const deleteFromS3 = async (fileUrl: string) => {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    let bucketName: string;
    let fileKey: string;

    // Logic to handle different S3 URL formats
    if (url.hostname.startsWith('s3.')) {
      // Format: s3.region.amazonaws.com/bucket/key (uploadAssignmentToS3)
      bucketName = pathParts[0];
      fileKey = decodeURIComponent(pathParts.slice(1).join('/'));
    } else {
      // Format: bucket.s3.region.amazonaws.com/key (uploadToS3)
      bucketName = url.hostname.split('.')[0];
      fileKey = decodeURIComponent(pathParts.join('/'));
    }

    console.log(`🗑️ Attempting delete from Bucket: [${bucketName}] | Key: [${fileKey}]`);

    const params = {
      Bucket: bucketName || process.env.S3_BUCKET || 'smartattend-media',
      Key: fileKey,
    };

    await s3Client.send(new DeleteObjectCommand(params));
    console.log(`✅ Successfully deleted from S3: ${fileKey}`);
  } catch (error) {
    console.error("❌ Failed to delete from S3:", error);
  }
};



// 🟢 FIX: This must now be an ASYNC function because PDF/Word parsing takes time!
export const extractFileContent = async (files: Express.Multer.File[]) => {
  const codeExts = ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.go', '.rb', '.html', '.css'];
  let extractedText = "";
  let extractedCode = "";

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    let content = "";

    try {
      if (ext === '.pdf') {
        // 🟢 FIX: Use the brand new v2 Object-Oriented API!
        const parser = new PDFParse({ data: file.buffer });
        const pdfData = await parser.getText();
        content = pdfData.text;

        // Free up memory after extraction
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
      else if (ext === '.docx') {
        // 2. Parse Word Documents safely
        const docxData = await mammoth.extractRawText({ buffer: file.buffer });
        content = docxData.value;
      }
      else {
        // 3. Fallback for plain text and code files (.txt, .cpp, .csv, etc.)
        content = file.buffer.toString('utf-8');
      }

      // 4. Route the content to the correct AI bucket
      if (codeExts.includes(ext)) {
        extractedCode += `\n--- START CODE: ${file.originalname} ---\n${content.trim()}\n--- END CODE ---\n`;
      } else {
        extractedText += `\n--- START DOC: ${file.originalname} ---\n${content.trim()}\n--- END DOC ---\n`;
      }

    } catch (err) {
      console.error(`❌ Failed to parse file ${file.originalname}:`, err);
      // We append a warning so the AI knows the file was corrupt, but it doesn't crash the server
      extractedText += `\n--- [UNABLE TO READ FILE: ${file.originalname}] ---\n`;
    }
  }

  return { extractedText, extractedCode };
};