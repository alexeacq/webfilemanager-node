const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const mime = require('mime-types');
const archiver = require('archiver');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = '/mnt/test';

// Ensure root directory exists
fs.ensureDirSync(ROOT_DIR);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.body.path || ROOT_DIR;
    const fullPath = path.join(ROOT_DIR, uploadPath.replace(ROOT_DIR, ''));
    fs.ensureDirSync(fullPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Helper function to get safe path
function getSafePath(relativePath) {
  const safePath = path.join(ROOT_DIR, relativePath || '');
  if (!safePath.startsWith(ROOT_DIR)) {
    throw new Error('Invalid path');
  }
  return safePath;
}

// Helper function to get file info
async function getFileInfo(filePath, relativePath) {
  const stats = await fs.stat(filePath);
  const isDirectory = stats.isDirectory();
  
  return {
    name: path.basename(filePath),
    path: relativePath,
    isDirectory,
    size: isDirectory ? null : stats.size,
    modified: stats.mtime,
    type: isDirectory ? 'folder' : mime.lookup(filePath) || 'unknown'
  };
}

// Routes

// Get directory contents
app.get('/api/files', async (req, res) => {
  try {
    const relativePath = req.query.path || '';
    const fullPath = getSafePath(relativePath);
    
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const items = await fs.readdir(fullPath);
    const fileInfos = [];
    
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const itemRelativePath = path.join(relativePath, item);
      try {
        const info = await getFileInfo(itemPath, itemRelativePath);
        fileInfos.push(info);
      } catch (err) {
        console.warn(`Could not get info for ${item}:`, err.message);
      }
    }
    
    // Sort: directories first, then files
    fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json(fileInfos);
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

// Get directory tree (for sidebar)
app.get('/api/tree', async (req, res) => {
  try {
    async function buildTree(dirPath, relativePath = '') {
      const items = await fs.readdir(dirPath);
      const tree = [];
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          if (stats.isDirectory()) {
            tree.push({
              name: item,
              path: itemRelativePath,
              isDirectory: true,
              children: await buildTree(itemPath, itemRelativePath)
            });
          }
        } catch (err) {
          console.warn(`Could not process ${item}:`, err.message);
        }
      }
      
      return tree.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const tree = await buildTree(ROOT_DIR);
    res.json(tree);
  } catch (error) {
    console.error('Error building tree:', error);
    res.status(500).json({ error: 'Failed to build directory tree' });
  }
});

// Create directory
app.post('/api/directory', async (req, res) => {
  try {
    const { path: relativePath, name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Directory name is required' });
    }
    
    const parentPath = getSafePath(relativePath || '');
    const newDirPath = path.join(parentPath, name);
    
    await fs.ensureDir(newDirPath);
    res.json({ message: 'Directory created successfully' });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

// Upload files
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    res.json({ 
      message: 'Files uploaded successfully',
      files: req.files.map(file => file.filename)
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Download file
app.get('/api/download', async (req, res) => {
  try {
    const relativePath = req.query.path;
    if (!relativePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const filePath = getSafePath(relativePath);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    
    if (stats.isDirectory()) {
      // Create zip for directory
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.zip"`);
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(filePath, false);
      archive.finalize();
    } else {
      // Send file directly
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(filePath);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file/directory
app.delete('/api/files', async (req, res) => {
  try {
    const relativePath = req.query.path;
    if (!relativePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const filePath = getSafePath(relativePath);
    await fs.remove(filePath);
    res.json({ message: 'File/directory deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file/directory' });
  }
});

// Copy file/directory
app.post('/api/copy', async (req, res) => {
  try {
    const { source, destination } = req.body;
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }
    
    const sourcePath = getSafePath(source);
    const destPath = getSafePath(destination);
    
    await fs.copy(sourcePath, destPath);
    res.json({ message: 'File/directory copied successfully' });
  } catch (error) {
    console.error('Error copying file:', error);
    res.status(500).json({ error: 'Failed to copy file/directory' });
  }
});

// Move file/directory
app.post('/api/move', async (req, res) => {
  try {
    const { source, destination } = req.body;
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }
    
    const sourcePath = getSafePath(source);
    const destPath = getSafePath(destination);
    
    await fs.move(sourcePath, destPath);
    res.json({ message: 'File/directory moved successfully' });
  } catch (error) {
    console.error('Error moving file:', error);
    res.status(500).json({ error: 'Failed to move file/directory' });
  }
});

// Get file properties
app.get('/api/properties', async (req, res) => {
  try {
    const relativePath = req.query.path;
    if (!relativePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const filePath = getSafePath(relativePath);
    const info = await getFileInfo(filePath, relativePath);
    
    if (info.isDirectory) {
      // Count directory contents
      const contents = await fs.readdir(filePath);
      info.itemCount = contents.length;
    }
    
    res.json(info);
  } catch (error) {
    console.error('Error getting file properties:', error);
    res.status(500).json({ error: 'Failed to get file properties' });
  }
});

app.listen(PORT, () => {
  console.log(`File manager server running on http://localhost:${PORT}`);
  console.log(`Managing directory: ${ROOT_DIR}`);
});
