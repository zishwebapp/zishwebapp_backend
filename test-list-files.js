import dotenv from "dotenv";
dotenv.config();

import { getDriveClient } from "./services/googleAuth.js";

async function listFiles() {
  try {
    const drive = await getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    console.log("Listing files in folder:", folderId);
    console.log("");
    
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType)",
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    console.log("Found", listRes.data.files.length, "file(s):");
    console.log("");
    
    listRes.data.files.forEach(file => {
      console.log("- Name:", file.name);
      console.log("  ID:", file.id);
      console.log("  Type:", file.mimeType);
      console.log("");
    });
    
    // Check specifically for master database
    const masterFile = listRes.data.files.find(f => f.name === "Zish-Master-Database");
    if (masterFile) {
      console.log("✅ Found master database!");
      console.log("   ID:", masterFile.id);
    } else {
      console.log("❌ Master database not found");
      console.log("   Expected name: 'Zish-Master-Database' (exact match)");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

listFiles();



