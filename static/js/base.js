// static/js/base.js

// ============================================
// Global Axios Configuration
// ============================================
axios.defaults.baseURL = window.location.origin;

// Add authentication token to all requests
axios.interceptors.request.use(
    config => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

// Handle token refresh on 401 responses
axios.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refresh_token');
                const response = await axios.post('/api/token/refresh/', {
                    refresh: refreshToken
                });
                localStorage.setItem('access_token', response.data.access);
                originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
                return axios(originalRequest);
            } catch (refreshError) {
                logout();
            }
        }
        return Promise.reject(error);
    }
);

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.log(`${type}: ${message}`);
        return;
    }
    
    const toastId = 'toast-' + Date.now();
    const bgColor = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    }[type] || 'bg-info';
    
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgColor} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
}

// ============================================
// Profile Data Loading
// ============================================
async function loadProfileData() {
    const profileContent = document.getElementById('profileContent');
    if (!profileContent) return;
    
    profileContent.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    
    try {
        const response = await axios.get('/employees/', {
            headers: getAuthHeaders()
        });
        
        const employees = response.data;
        const currentUser = localStorage.getItem('username');
        const employee = employees.find(emp => emp.user?.username === currentUser);
        
        if (employee) {
            // Load dynamic field data
            const dynamicResponse = await axios.get(`/dynamic-data/?employee=${employee.employee_record_id || employee.id}`, {
                headers: getAuthHeaders()
            });
            const dynamicData = dynamicResponse.data;
            
            let dynamicFieldsHtml = '';
            if (dynamicData.length > 0) {
                dynamicFieldsHtml = '<tr><th colspan="2" class="bg-light">Additional Information</th></tr>';
                dynamicData.forEach(item => {
                    dynamicFieldsHtml += `
                        <tr>
                            <th style="width: 40%">${item.field_label}:</th>
                            <td>${item.value}</td>
                        </tr>
                    `;
                });
            }
            
            profileContent.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-bordered">
                        <tr>
                            <th style="width: 40%">Employee ID:</th>
                            <td><strong>${employee.employee_id}</strong></td>
                        </tr>
                        <tr>
                            <th>Username:</th>
                            <td>${employee.user?.username}</td>
                        </tr>
                        <tr>
                            <th>Email:</th>
                            <td>${employee.user?.email || 'N/A'}</td>
                        </tr>
                        <tr>
                            <th>Department:</th>
                            <td>${employee.department}</td>
                        </tr>
                        <tr>
                            <th>Designation:</th>
                            <td>${employee.designation}</td>
                        </tr>
                        <tr>
                            <th>Phone:</th>
                            <td>${employee.phone}</td>
                        </tr>
                        <tr>
                            <th>Date of Joining:</th>
                            <td>${new Date(employee.date_of_joining).toLocaleDateString()}</td>
                        </tr>
                        ${dynamicFieldsHtml}
                    </table>
                </div>
            `;
        } else {
            profileContent.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No employee profile found. Please contact admin.
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        profileContent.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                Error loading profile: ${error.response?.data?.detail || 'Unknown error'}
            </div>
        `;
    }
}

// ============================================
// Change Password
// ============================================
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('All fields are required', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
    btn.disabled = true;
    
    try {
        // Try POST first
        await axios.post('/accounts/change-password/', {
            old_password: currentPassword,
            new_password: newPassword
        }, {
            headers: getAuthHeaders()
        });
        
        showToast('Password changed successfully! Please login again.', 'success');
        
        // Close modal and reset form
        bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
        document.getElementById('changePasswordForm').reset();
        
        // Logout after successful password change
        setTimeout(() => {
            localStorage.clear();
            window.location.href = '/';
        }, 1500);
        
    } catch (error) {
        console.error('Error changing password:', error);
        
        // If POST fails (405), try PUT
        if (error.response?.status === 405) {
            try {
                await axios.put('/accounts/change-password/', {
                    old_password: currentPassword,
                    new_password: newPassword
                }, {
                    headers: getAuthHeaders()
                });
                
                showToast('Password changed successfully! Please login again.', 'success');
                
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
                document.getElementById('changePasswordForm').reset();
                
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = '/';
                }, 1500);
                
            } catch (putError) {
                showToast(putError.response?.data?.detail || 'Error changing password', 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } else {
            showToast(error.response?.data?.detail || 'Error changing password', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// ============================================
// Sidebar Menu Generation
// ============================================
async function updateSidebarForRole() {
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const sidebarMenu = document.getElementById('dynamicSidebarMenu');
    
    if (!sidebarMenu) {
        console.error('Sidebar menu container not found!');
        return;
    }
    
    // Get profile URL with employee ID
    let profileUrl = '/profile/';
    try {
        const response = await axios.get('/employees/', {
            headers: getAuthHeaders()
        });
        const employees = response.data;
        const currentUser = localStorage.getItem('username');
        const employee = employees.find(emp => emp.user?.username === currentUser);
        
        if (employee) {
            const empId = employee.employee_record_id || employee.id;
            profileUrl = `/create/?id=${empId}`;
        }
    } catch (error) {
        console.error('Error fetching employee ID:', error);
    }
    
    // Common menu items
    let menuHtml = `
        <div class="menu-section">My Account</div>
        <a href="${profileUrl}" class="menu-item">
            <i class="fas fa-user-circle"></i>
            <span>My Profile</span>
        </a>
        <a href="#" class="menu-item" data-bs-toggle="modal" data-bs-target="#changePasswordModal">
            <i class="fas fa-key"></i>
            <span>Change Password</span>
        </a>
    `;
    
    // Admin-only menu items
    if (isAdmin) {
        menuHtml = `
            <div class="menu-section">Admin Menu</div>
            <a href="/accounts/users/list/" class="menu-item">
                <i class="fas fa-users-cog"></i>
                <span>Users</span>
            </a>
            <a href="/list/" class="menu-item">
                <i class="fas fa-users"></i>
                <span>All Employees</span>
            </a>
            <a href="/create/" class="menu-item">
                <i class="fas fa-user-plus"></i>
                <span>Add Employee</span>
            </a>
            <a href="/forms-builder/" class="menu-item">
                <i class="fas fa-table"></i>
                <span>Form Builder</span>
            </a>
            <div class="menu-divider"></div>
        ` + menuHtml;
    }
    
    sidebarMenu.innerHTML = menuHtml;
    console.log('Sidebar updated - isAdmin:', isAdmin);
}

// ============================================
// Authentication Functions
// ============================================
function setUsername() {
    const username = localStorage.getItem('username');
    const displayElement = document.getElementById('usernameDisplay');
    if (username && displayElement) {
        displayElement.textContent = username;
    }
}

function logout(e) {
    if (e) e.preventDefault();
    localStorage.clear();
    showToast('Logged out successfully', 'success');
    setTimeout(() => window.location.href = '/', 1500);
}

function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('show');
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Base.js loaded');
    
    const token = localStorage.getItem('access_token');
    const isPublicPage = window.location.pathname === '/';
    
    if (!token && !isPublicPage) {
        window.location.href = '/';
        return;
    }
    
    if (token) {
        setUsername();
        await updateSidebarForRole();
    }
    
    // Profile modal event listener
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('show.bs.modal', loadProfileData);
    }
    
    // Logout button listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// ============================================
// Login Handler
// ============================================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await axios.post('/accounts/login/', { username, password });
        
        // Store tokens
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        localStorage.setItem('username', username);
        
        // Check admin status
        try {
            const userResponse = await axios.get('/users/', {
                headers: { Authorization: `Bearer ${response.data.access}` }
            });
            
            const currentUser = userResponse.data.find(u => u.username === username);
            const isAdmin = currentUser?.is_superuser || false;
            
            localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
            
            showToast('Login successful!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            
            setTimeout(() => {
                window.location.href = isAdmin ? '/list/' : '/dashboard/';
            }, 1500);
            
        } catch (error) {
            localStorage.setItem('is_admin', 'false');
            showToast('Login successful!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            setTimeout(() => window.location.href = '/dashboard/', 1500);
        }
        
    } catch (error) {
        const message = error.response?.data?.detail || 'Invalid username or password';
        showToast(message, 'error');
    }
});

// ============================================
// Helper Functions
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
    };
}

// ============================================
// Global Exports
// ============================================
window.showToast = showToast;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.changePassword = changePassword;
window.loadProfileData = loadProfileData;
window.updateSidebarForRole = updateSidebarForRole;
window.getAuthHeaders = getAuthHeaders;