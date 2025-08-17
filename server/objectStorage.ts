import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import { firebaseStorage } from "./firebase.js";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Save audio buffer to object storage and return public URL
  async saveAudioFile(audioBuffer: Buffer, banterId?: string): Promise<string> {
    const audioId = randomUUID();
    const fileName = `audio/${audioId}.mp3`;
    
    try {
      // Try Firebase Storage first (works everywhere including Render)
      if (firebaseStorage.isAvailable()) {
        const firebaseUrl = await firebaseStorage.saveAudioFile(audioBuffer);
        if (firebaseUrl) {
          console.log('Audio saved to Firebase Storage');
          return firebaseUrl;
        }
      }
      
      // Check if object storage is configured (for local/Replit)
      const publicPathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
      if (publicPathsStr) {
        // Object storage is configured, use it
        const publicPaths = this.getPublicObjectSearchPaths();
        const publicPath = publicPaths[0]; // Use first public path
        const fullPath = `${publicPath}/${fileName}`;
        
        const { bucketName, objectName } = parseObjectPath(fullPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);

        // Upload the audio buffer
        await file.save(audioBuffer, {
          metadata: {
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=3600',
          },
        });

        // Return the public URL path that can be served by our API
        return `/public-objects/${fileName}`;
      }
      
      // Fallback: Use filesystem storage when nothing else is available
      const fs = await import('fs');
      const path = await import('path');
      
      // Create audio directory if it doesn't exist
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      // Save audio file to filesystem
      const filePath = path.join(audioDir, `${audioId}.mp3`);
      fs.writeFileSync(filePath, audioBuffer);
      
      // Return URL path that can be served
      return `/audio/${audioId}.mp3`;
    } catch (error) {
      console.error('Error saving audio file:', error);
      // Final fallback to base64 data URL
      try {
        const base64Audio = audioBuffer.toString('base64');
        console.log('Using base64 data URL as final fallback');
        return `data:audio/mpeg;base64,${base64Audio}`;
      } catch (fallbackError) {
        console.error('All audio save methods failed:', fallbackError);
        throw new Error('Failed to save audio file');
      }
    }
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}
