// Global state
let currentPath = '';
let selectedItem = null;
let clipboard = null;
let clipboardOperation = null; // 'copy' or 'cut'

// DOM elements
const fileGrid = document.getElementById('fileGrid');
const directoryTree = document.getElementById('directoryTree');
const breadcrumb = document.getElementById('breadcrumb');
const actionsSection = document.getElementById('actionsSection');
const loadingIndicator = document.getElementById('loadingIndicator');
const uploadProgress = document.getElementById('uploadProgress');

// Buttons
const darkModeToggle = document.getElementById('darkModeToggle');
const newFolderBtn = document.getElementById('newFolderBtn');
const fileUpload = document.getElementById('fileUpload');
const propertiesBtn = document.getElementById('propertiesBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const cutBtn = document.getElementById('cutBtn');
const pasteBtn = document.getElementById('pasteBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Modals
const newFolderModal = document.getElementById('newFolderModal');
const propertiesModal = document.getElementById('propertiesModal');
const folderNameInput = document.getElementById('folderNameInput');
const createFolderBtn = document.getElementById('createFolderBtn');
const cancelFolderBtn = document.getElementById('cancelFolderBtn');
const closePropertiesBtn = document.getElementById('closePropertiesBtn');
const propertiesContent = document.getElementById('propertiesContent');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    loadDirectoryTree();
    loadFiles(currentPath);
    setupEventListeners();
});

// Dark mode functionality
function initializeDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.setAttribute('data-theme', 'dark');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleDarkMode() {
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    if (isDarkMode) {
        document.body.removeAttribute('data-theme');
        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('darkMode', 'false');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('darkMode', 'true');
    }
}

// Event listeners setup
function setupEventListeners() {
    darkModeToggle.addEventListener('click', toggleDarkMode);
    newFolderBtn.addEventListener('click', () => showModal(newFolderModal));
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Action buttons
    propertiesBtn.addEventListener('click', showProperties);
    downloadBtn.addEventListener('click', downloadItem);
    copyBtn.addEventListener('click', () => copyItem('copy'));
    cutBtn.addEventListener('click', () => copyItem('cut'));
    pasteBtn.addEventListener('click', pasteItem);
    deleteBtn.addEventListener('click', deleteItem);
    
    // Modal buttons
    createFolderBtn.addEventListener('click', createFolder);
    cancelFolderBtn.addEventListener('click', () => hideModal(newFolderModal));
    closePropertiesBtn.addEventListener('click', () => hideModal(propertiesModal));
    
    // Modal backdrop clicks
    newFolderModal.addEventListener('click', (e) => {
        if (e.target === newFolderModal) hideModal(newFolderModal);
    });
    propertiesModal.addEventListener('click', (e) => {
        if (e.target === propertiesModal) hideModal(propertiesModal);
    });
    
    // Enter key for folder creation
    folderNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createFolder();
    });
}

// API calls
async function apiCall(url, options = {}) {
    showLoading();
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showNotification(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Loading indicator
function showLoading() {
    loadingIndicator.classList.add('show');
}

function hideLoading() {
    loadingIndicator.classList.remove('show');
}

// Modal functions
function showModal(modal) {
    modal.classList.add('show');
    if (modal === newFolderModal) {
        folderNameInput.focus();
        folderNameInput.value = '';
    }
}

function hideModal(modal) {
    modal.classList.remove('show');
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        box-shadow: var(--shadow-hover);
        z-index: 1001;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    if (type === 'error') {
        notification.style.borderColor = 'var(--danger-color)';
        notification.style.color = 'var(--danger-color)';
    } else if (type === 'success') {
        notification.style.borderColor = 'var(--success-color)';
        notification.style.color = 'var(--success-color)';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// File icon helper
function getFileIcon(item) {
    if (item.isDirectory) {
        return '<i class="fas fa-folder file-icon folder"></i>';
    }
    
    const ext = item.name.split('.').pop().toLowerCase();
    const type = item.type || '';
    
    if (type.startsWith('image/')) {
        return '<i class="fas fa-image file-icon image"></i>';
    } else if (type.startsWith('video/')) {
        return '<i class="fas fa-video file-icon video"></i>';
    } else if (type.startsWith('audio/')) {
        return '<i class="fas fa-music file-icon audio"></i>';
    } else if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
        return '<i class="fas fa-file-alt file-icon document"></i>';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return '<i class="fas fa-file-archive file-icon archive"></i>';
    } else if (['js', 'html', 'css', 'php', 'py', 'java', 'cpp', 'c'].includes(ext)) {
        return '<i class="fas fa-code file-icon code"></i>';
    } else {
        return '<i class="fas fa-file file-icon"></i>';
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
}

// Load directory tree
async function loadDirectoryTree() {
    try {
        const tree = await apiCall('/api/tree');
        renderDirectoryTree(tree, directoryTree);
    } catch (error) {
        console.error('Failed to load directory tree:', error);
    }
}

// Render directory tree
function renderDirectoryTree(items, container, level = 0) {
    container.innerHTML = '';
    
    items.forEach(item => {
        if (item.isDirectory) {
            const treeItem = document.createElement('div');
            treeItem.className = 'tree-item';
            treeItem.style.paddingLeft = `${level * 1}rem`;
            treeItem.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${item.name}</span>
            `;
            
            treeItem.addEventListener('click', () => {
                navigateToPath(item.path);
                // Update selected state
                document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                treeItem.classList.add('selected');
            });
            
            container.appendChild(treeItem);
            
            if (item.children && item.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children';
                renderDirectoryTree(item.children, childContainer, level + 1);
                container.appendChild(childContainer);
            }
        }
    });
}

// Load files in current path
async function loadFiles(path) {
    try {
        const files = await apiCall(`/api/files?path=${encodeURIComponent(path)}`);
        renderFiles(files);
        updateBreadcrumb(path);
        currentPath = path;
    } catch (error) {
        console.error('Failed to load files:', error);
    }
}

// Render files in grid
function renderFiles(files) {
    fileGrid.innerHTML = '';
    
    if (files.length === 0) {
        fileGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin: 2rem;">This folder is empty</p>';
        return;
    }
    
    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        fileElement.innerHTML = `
            ${getFileIcon(file)}
            <div class="file-name">${file.name}</div>
            <div class="file-info">
                ${file.isDirectory ? '' : formatFileSize(file.size)}
            </div>
        `;
        
        fileElement.addEventListener('click', () => selectItem(file, fileElement));
        fileElement.addEventListener('dblclick', () => {
            if (file.isDirectory) {
                navigateToPath(file.path);
            } else {
                downloadItem();
            }
        });
        
        fileGrid.appendChild(fileElement);
    });
}

// Select item
function selectItem(item, element) {
    // Remove previous selection
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    
    // Select current item
    element.classList.add('selected');
    selectedItem = item;
    
    // Show actions section
    actionsSection.style.display = 'block';
    
    // Update paste button state
    pasteBtn.disabled = !clipboard;
}

// Navigate to path
function navigateToPath(path) {
    loadFiles(path);
    selectedItem = null;
    actionsSection.style.display = 'none';
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
}

// Update breadcrumb
function updateBreadcrumb(path) {
    breadcrumb.innerHTML = '';
    
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.setAttribute('data-path', '');
    rootItem.innerHTML = '<i class="fas fa-home"></i> Root';
    rootItem.addEventListener('click', () => navigateToPath(''));
    breadcrumb.appendChild(rootItem);
    
    if (path) {
        const parts = path.split('/').filter(part => part);
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath += '/' + part;
            
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = ' / ';
            breadcrumb.appendChild(separator);
            
            const breadcrumbItem = document.createElement('span');
            breadcrumbItem.className = 'breadcrumb-item';
            breadcrumbItem.setAttribute('data-path', currentPath);
            breadcrumbItem.textContent = part;
            breadcrumbItem.addEventListener('click', () => navigateToPath(currentPath));
            breadcrumb.appendChild(breadcrumbItem);
        });
    }
}

// Create new folder
async function createFolder() {
    const name = folderNameInput.value.trim();
    if (!name) {
        showNotification('Please enter a folder name', 'error');
        return;
    }
    
    try {
        await apiCall('/api/directory', {
            method: 'POST',
            body: JSON.stringify({
                path: currentPath,
                name: name
            })
        });
        
        hideModal(newFolderModal);
        loadFiles(currentPath);
        loadDirectoryTree();
        showNotification('Folder created successfully', 'success');
    } catch (error) {
        showNotification('Failed to create folder', 'error');
    }
}

// Handle file upload
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('path', currentPath);
    
    try {
        // Show upload progress
        uploadProgress.style.display = 'block';
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // Simulate progress (you can implement real progress tracking)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            progressFill.style.width = progress + '%';
            progressText.textContent = `Uploading... ${progress}%`;
            
            if (progress >= 90) {
                clearInterval(progressInterval);
            }
        }, 100);
        
        await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = 'Upload complete!';
        
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 1000);
        
        loadFiles(currentPath);
        showNotification('Files uploaded successfully', 'success');
    } catch (error) {
        uploadProgress.style.display = 'none';
        showNotification('Upload failed', 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

// Show properties
async function showProperties() {
    if (!selectedItem) return;
    
    try {
        const properties = await apiCall(`/api/properties?path=${encodeURIComponent(selectedItem.path)}`);
        
        propertiesContent.innerHTML = `
            <div class="property-item">
                <span class="property-label">Name:</span>
                <span class="property-value">${properties.name}</span>
            </div>
            <div class="property-item">
                <span class="property-label">Type:</span>
                <span class="property-value">${properties.isDirectory ? 'Folder' : 'File'}</span>
            </div>
            <div class="property-item">
                <span class="property-label">Size:</span>
                <span class="property-value">${properties.isDirectory ? `${properties.itemCount || 0} items` : formatFileSize(properties.size)}</span>
            </div>
            <div class="property-item">
                <span class="property-label">Modified:</span>
                <span class="property-value">${formatDate(properties.modified)}</span>
            </div>
            <div class="property-item">
                <span class="property-label">Path:</span>
                <span class="property-value">${properties.path}</span>
            </div>
        `;
        
        showModal(propertiesModal);
    } catch (error) {
        showNotification('Failed to get properties', 'error');
    }
}

// Download item
function downloadItem() {
    if (!selectedItem) return;
    
    const downloadUrl = `/api/download?path=${encodeURIComponent(selectedItem.path)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = selectedItem.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Copy/Cut item
function copyItem(operation) {
    if (!selectedItem) return;
    
    clipboard = selectedItem;
    clipboardOperation = operation;
    pasteBtn.disabled = false;
    
    showNotification(`Item ${operation === 'copy' ? 'copied' : 'cut'}`, 'success');
}

// Paste item
async function pasteItem() {
    if (!clipboard) return;
    
    const sourcePath = clipboard.path;
    const fileName = clipboard.name;
    const destinationPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    
    try {
        if (clipboardOperation === 'copy') {
            await apiCall('/api/copy', {
                method: 'POST',
                body: JSON.stringify({
                    source: sourcePath,
                    destination: destinationPath
                })
            });
        } else if (clipboardOperation === 'cut') {
            await apiCall('/api/move', {
                method: 'POST',
                body: JSON.stringify({
                    source: sourcePath,
                    destination: destinationPath
                })
            });
            
            // Clear clipboard after move
            clipboard = null;
            clipboardOperation = null;
            pasteBtn.disabled = true;
        }
        
        loadFiles(currentPath);
        loadDirectoryTree();
        showNotification('Item pasted successfully', 'success');
    } catch (error) {
        showNotification('Paste failed', 'error');
    }
}

// Delete item
async function deleteItem() {
    if (!selectedItem) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${selectedItem.name}"?`);
    if (!confirmDelete) return;
    
    try {
        await apiCall(`/api/files?path=${encodeURIComponent(selectedItem.path)}`, {
            method: 'DELETE'
        });
        
        loadFiles(currentPath);
        loadDirectoryTree();
        actionsSection.style.display = 'none';
        selectedItem = null;
        showNotification('Item deleted successfully', 'success');
    } catch (error) {
        showNotification('Delete failed', 'error');
    }
}
