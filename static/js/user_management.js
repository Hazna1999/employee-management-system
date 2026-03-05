// static/js/user_management.js

let deleteUserId = null;

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('access_token')) {
        window.location.href = '/';
        return;
    }
    
    if (localStorage.getItem('is_admin') !== 'true') {
        window.location.href = '/';
        return;
    }
    
    loadUsers();
});

// ============================================
// API Helpers
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
    };
}

// ============================================
// Load Users
// ============================================
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    try {
        const response = await axios.get('/users/', {
            headers: getAuthHeaders()
        });
        
        const users = response.data;
        
        if (!users?.length) {
            tbody.innerHTML = getEmptyUsersHTML();
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.username}</strong></td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.first_name || '-'}</td>
                <td>${user.last_name || '-'}</td>
                <td>${getBadgeHTML(user.is_superuser, 'success')}</td>
                <td>${getBadgeHTML(user.is_staff, 'info')}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-warning" 
                                onclick="editUser(${user.id})" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="showDeleteUserModal(${user.id})" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading users:', error);
        if (tbody) {
            tbody.innerHTML = getErrorHTML(error);
        }
    }
}

function getBadgeHTML(value, type) {
    return value 
        ? `<span class="badge bg-${type}">Yes</span>`
        : '<span class="badge bg-secondary">No</span>';
}

function getEmptyUsersHTML() {
    return `
        <tr>
            <td colspan="8" class="text-center py-5">
                <i class="fas fa-users fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No users found</h5>
            </td>
        </tr>
    `;
}

function getErrorHTML(error) {
    return `
        <tr>
            <td colspan="8" class="text-center py-5">
                <i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i>
                <h5 class="text-danger">Error loading users</h5>
                <p class="text-muted">${error.response?.data?.detail || error.message}</p>
                <button class="btn btn-primary mt-3" onclick="loadUsers()">
                    <i class="fas fa-sync-alt me-2"></i>Try Again
                </button>
            </td>
        </tr>
    `;
}

// ============================================
// Create User
// ============================================
function showCreateUserModal() {
    document.getElementById('createUserForm').reset();
    new bootstrap.Modal(document.getElementById('createUserModal')).show();
}

async function createUser() {
    const formData = {
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        first_name: document.getElementById('first_name').value.trim(),
        last_name: document.getElementById('last_name').value.trim(),
        is_superuser: document.getElementById('is_superuser').checked,
        is_staff: document.getElementById('is_staff').checked
    };
    
    if (!formData.username || !formData.email || !formData.password) {
        showToast('Username, email and password are required', 'error');
        return;
    }
    
    if (formData.password !== formData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const saveBtn = document.querySelector('#createUserModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
    saveBtn.disabled = true;
    
    try {
        const userData = {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            password2: formData.confirmPassword,
            first_name: formData.first_name,
            last_name: formData.last_name
        };
        
        if (formData.is_superuser) userData.is_superuser = true;
        if (formData.is_staff) userData.is_staff = true;
        
        await axios.post('/accounts/users/create/', userData, {
            headers: getAuthHeaders()
        });
        
        showToast('User created successfully', 'success');
        
        // Close modal properly
        const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
        if (modal) modal.hide();
        
        // Clean up modal backdrop
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        // Reset form
        document.getElementById('createUserForm').reset();
        
        // Reload users
        await loadUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        
        if (error.response?.status === 400) {
            const errorMessage = formatValidationErrors(error.response.data);
            showToast(errorMessage, 'error');
        } else {
            showToast('Error creating user. Please try again.', 'error');
        }
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// ============================================
// Edit User
// ============================================
async function editUser(userId) {
    try {
        const response = await axios.get(`/accounts/users/${userId}/details/`, {
            headers: getAuthHeaders()
        });
        
        const user = response.data;
        
        document.getElementById('edit_user_id').value = user.id;
        document.getElementById('edit_username').value = user.username;
        document.getElementById('edit_email').value = user.email || '';
        document.getElementById('edit_first_name').value = user.first_name || '';
        document.getElementById('edit_last_name').value = user.last_name || '';
        document.getElementById('edit_is_superuser').checked = user.is_superuser;
        document.getElementById('edit_is_staff').checked = user.is_staff;
        
        new bootstrap.Modal(document.getElementById('editUserModal')).show();
        
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Error loading user details', 'error');
    }
}

// ============================================
// Update User
// ============================================
async function updateUser() {
    const userId = document.getElementById('edit_user_id').value;
    const userData = {
        username: document.getElementById('edit_username').value.trim(),
        email: document.getElementById('edit_email').value.trim(),
        first_name: document.getElementById('edit_first_name').value.trim(),
        last_name: document.getElementById('edit_last_name').value.trim(),
        is_superuser: document.getElementById('edit_is_superuser').checked,
        is_staff: document.getElementById('edit_is_staff').checked
    };
    
    if (!userData.username || !userData.email) {
        showToast('Username and email are required', 'error');
        return;
    }
    
    const saveBtn = document.querySelector('#editUserModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
    saveBtn.disabled = true;
    
    try {
        await axios.put(`/accounts/users/${userId}/`, userData, {
            headers: getAuthHeaders()
        });
        
        showToast('User updated successfully', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        if (modal) modal.hide();
        
        // Clean up modal backdrop
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        await loadUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        
        if (error.response?.status === 400) {
            const errorMessage = formatValidationErrors(error.response.data);
            showToast(errorMessage, 'error');
        } else {
            showToast('Error updating user. Please try again.', 'error');
        }
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// ============================================
// Delete User
// ============================================
function showDeleteUserModal(userId) {
    deleteUserId = userId;
    new bootstrap.Modal(document.getElementById('deleteUserModal')).show();
}

async function confirmDeleteUser() {
    if (!deleteUserId) return;
    
    const deleteBtn = document.querySelector('#deleteUserModal .btn-danger');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
    deleteBtn.disabled = true;
    
    try {
        await axios.delete(`/accounts/users/${deleteUserId}/delete/`, {
            headers: getAuthHeaders()
        });
        
        showToast('User deleted successfully', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
        if (modal) modal.hide();
        
        // Clean up modal backdrop
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        await loadUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(error.response?.data?.detail || 'Error deleting user', 'error');
    } finally {
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled = false;
        deleteUserId = null;
    }
}

// ============================================
// Helper Functions
// ============================================
function formatValidationErrors(data) {
    if (!data) return 'Validation error';
    
    if (typeof data === 'string') return data;
    
    if (typeof data === 'object') {
        const messages = [];
        Object.entries(data).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                messages.push(`${key}: ${value.join(', ')}`);
            } else if (typeof value === 'string') {
                messages.push(`${key}: ${value}`);
            }
        });
        return messages.join('\n');
    }
    
    return data.detail || 'Validation error';
}

// ============================================
// Toast Helper - FIXED (No recursion)
// ============================================
function showToast(message, type = 'info') {
    // Use global toast function if available and different
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Fallback
    alert(message);
}

// ============================================
// Global Exports
// ============================================
window.showCreateUserModal = showCreateUserModal;
window.createUser = createUser;
window.editUser = editUser;
window.updateUser = updateUser;
window.showDeleteUserModal = showDeleteUserModal;
window.confirmDeleteUser = confirmDeleteUser;