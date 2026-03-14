import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = "/home/ubuntu/backend/backend/uploads/2026-03-14";
const R2_BUCKET = "videos";
const R2_PUBLIC_URL = "https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const prisma = new PrismaClient();

function getFilenameFromUrl(url) {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

async function uploadFile(localPath, r2Key) {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  let contentType = "application/octet-stream";
  if ([".jpg", ".jpeg"].includes(ext)) contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".webp") contentType = "image/webp";
  else if (ext === ".pdf") contentType = "application/pdf";
  else {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) contentType = "image/jpeg";
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = "image/png";
    else if (buffer[0] === 0x25 && buffer[1] === 0x50) contentType = "application/pdf";
  }
  await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key, Body: buffer, ContentType: contentType }));
  return R2_PUBLIC_URL + "/" + r2Key;
}

async function migrateRequest(requestId, userId) {
  const request = await prisma.loanRequest.findUnique({ where: { id: requestId } });
  if (!request) { console.log("Request " + requestId + " not found"); return; }
  const suppData = typeof request.supplementalDescription === "string"
    ? JSON.parse(request.supplementalDescription)
    : request.supplementalDescription;
  if (!suppData) return;

  if (suppData.housePhotos && Array.isArray(suppData.housePhotos)) {
    const newPhotos = [];
    for (const url of suppData.housePhotos) {
      if (url.includes("/home/ubuntu")) {
        const filename = getFilenameFromUrl(url);
        const localPath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(localPath)) {
          const r2Key = "solicitacoes/" + userId + "/" + filename;
          const newUrl = await uploadFile(localPath, r2Key);
          console.log("  housePhoto: " + filename + " -> " + newUrl);
          newPhotos.push(newUrl);
        } else {
          console.log("  FILE NOT FOUND: " + localPath);
          newPhotos.push(url);
        }
      } else { newPhotos.push(url); }
    }
    suppData.housePhotos = newPhotos;
  }

  if (suppData.billInName && Array.isArray(suppData.billInName)) {
    const newBills = [];
    for (const url of suppData.billInName) {
      if (url.includes("/home/ubuntu")) {
        const filename = getFilenameFromUrl(url);
        const localPath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(localPath)) {
          const r2Key = "solicitacoes/" + userId + "/" + filename;
          const newUrl = await uploadFile(localPath, r2Key);
          console.log("  billInName: " + filename + " -> " + newUrl);
          newBills.push(newUrl);
        } else {
          console.log("  FILE NOT FOUND: " + localPath);
          newBills.push(url);
        }
      } else { newBills.push(url); }
    }
    suppData.billInName = newBills;
  }

  await prisma.loanRequest.update({ where: { id: requestId }, data: { supplementalDescription: JSON.stringify(suppData) } });
  console.log("  DB updated: " + requestId);
}

async function main() {
  console.log("Starting migration...");
  console.log("--- Jefferson ---");
  await migrateRequest("b0f64e65-4ec5-429c-a78d-094bdf396233", "1681a60b-9cfb-4304-8873-31df268a202d");
  console.log("--- Sandra ---");
  await migrateRequest("0f6d637b-c6ae-4baa-8729-8837a12997e0", "ff14cc1a-2370-4fd2-aaef-65e851c7f1af");
  console.log("Migration complete!");
  await prisma.$disconnect();
}

main().catch(console.error);
