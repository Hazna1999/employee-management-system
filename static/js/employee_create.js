// static/js/employee_create.js

let employeeId = null;
let dynamicFields = [];
let isAdmin = false;

// Get employee ID from URL
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ employee_create.js loaded');
    
    const urlParams = new URLSearchParams(window.location.search);
    employeeId = urlParams.get('id');
    console.log('Employee ID from URL:', employeeId);
    
    // Check if user is logged in
    const token = localStorage.getItem('access_token');
    console.log('Token present:', !!token);
    
    if (!token) {
        console.log('No token, redirecting to home');
        window.location.href = '/';
        return;
    }
    
    // Check if user is admin
    isAdmin = localStorage.getItem('is_admin') === 'true';
    console.log('Is Admin:', isAdmin);
    
    // If this is the profile page (no ID in URL) and user is not admin
    if (!employeeId && !isAdmin) {
        console.log('Profile page access - fetching employee ID for current user');
        
        try {
            // Fetch the current user's employee ID
            const response = await axios.get('/employees/', {
                headers: getAuthHeaders()
            });
            
            const employees = response.data;
            const currentUser = localStorage.getItem('username');
            const employee = employees.find(emp => emp.user?.username === currentUser);
            
            if (employee) {
                employeeId = employee.employee_record_id || employee.id;
                console.log('Found employee ID for profile:', employeeId);
                
                // Update URL without reloading page
                const url = new URL(window.location);
                url.searchParams.set('id', employeeId);
                window.history.pushState({}, '', url);
                
                // Now proceed with initialization
                initializePage();
            } else {
                console.error('No employee record found for current user');
                showToast('Employee profile not found', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        } catch (error) {
            console.error('Error fetching employee data:', error);
            showToast('Error loading profile', 'error');
        }
    } else {
        // Normal flow - either admin or has ID
        initializePage();
    }
});

// ============================================
// Get auth headers
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ============================================
// Main initialization
// ============================================
async function initializePage() {
    showToast('Loading form data...', 'info');
    
    try {
        if (employeeId) {
            // EDIT MODE
            console.log('🔧 EDIT MODE - Loading employee data first');
            
            // First load employee data to get user info
            await loadEmployeeData();
            
            // Then load dynamic fields (grouped by form)
            await loadDynamicFields();
            
            // Finally load dynamic data for this employee
            await loadDynamicDataForEmployee();
            
            // Update title
            const titleElement = document.querySelector('.card-header h5');
            if (titleElement) {
                if (isAdmin) {
                    titleElement.innerHTML = '<i class="fas fa-edit me-2"></i>Edit Employee';
                } else {
                    titleElement.innerHTML = '<i class="fas fa-user-circle me-2"></i>My Profile';
                }
            }
        // In initializePage function, update the CREATE MODE section:
        } else {
            // CREATE MODE - Only admins can create
            if (!isAdmin) {
                showToast('You do not have permission to create employees', 'error');
                setTimeout(() => {
                    window.location.href = '/profile/';
                }, 2000);
                return;
            }
            
            console.log('➕ CREATE MODE - Loading dropdown and fields');
            
            // Make sure all fields are editable for admin create mode
            document.getElementById('employee_id').removeAttribute('readonly');
            document.getElementById('email').removeAttribute('readonly');
            document.getElementById('department').removeAttribute('readonly');
            document.getElementById('designation').removeAttribute('readonly');
            document.getElementById('date_of_joining').removeAttribute('readonly');
            
            await loadUsersDropdown();
            await loadDynamicFields();
            
            // Update title for create mode
            const titleElement = document.querySelector('.card-header h5');
            if (titleElement) {
                titleElement.innerHTML = '<i class="fas fa-user-plus me-2"></i>Create New Employee';
            }
        }
                
                showToast('Form ready', 'success');
            } catch (error) {
                console.error('❌ Initialization error:', error);
                showToast('Error loading form data', 'error');
            }
        }

// ============================================
// CREATE MODE: Load users dropdown (Admin only)
// ============================================
async function loadUsersDropdown() {
    const userContainer = document.getElementById('userFieldContainer');
    if (!userContainer) {
        console.error('❌ userFieldContainer not found');
        return;
    }
    
    // Create dropdown HTML for CREATE mode
    userContainer.innerHTML = `
        <label for="user_id" class="form-label">Select User <span class="text-danger">*</span></label>
        <select class="form-select" id="user_id" required>
            <option value="">Loading users...</option>
        </select>
        <small class="text-muted"><i class="fas fa-info-circle"></i> Select the user account for this employee</small>
    `;
    
    const userSelect = document.getElementById('user_id');
    
    try {
        console.log('📡 Fetching users from /users/...');
        const response = await axios.get('/users/', {
            headers: getAuthHeaders()
        });
        
        const users = response.data;
        console.log('👥 Users loaded:', users.length);
        
        userSelect.innerHTML = '<option value="">-- Choose a user --</option>';
        
        if (users.length === 0) {
            userSelect.innerHTML = '<option value="">No users available</option>';
            return;
        }
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;  // Show only username
            userSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        userSelect.innerHTML = '<option value="">Error loading users</option>';
        
        if (error.response?.status === 401) {
            showToast('Session expired', 'error');
            setTimeout(() => window.location.href = '/', 2000);
        }
    }
}

// ============================================
// Load dynamic fields - GROUPED BY FORM
// ============================================
async function loadDynamicFields() {
    const container = document.getElementById('dynamicFieldsContainer');
    if (!container) {
        console.error('❌ dynamicFieldsContainer not found');
        return;
    }
    
    container.innerHTML = '<div class="col-12 text-muted"><i class="fas fa-spinner fa-spin"></i> Loading fields...</div>';
    
    try {
        console.log('📡 Fetching all fields from /fields/...');
        const fieldsResponse = await axios.get('/fields/', {
            headers: getAuthHeaders()
        });
        
        const allFields = fieldsResponse.data;
        console.log('🔧 All fields loaded:', allFields.length);
        
        // Fetch all forms to get form names
        console.log('📡 Fetching forms from /forms/...');
        const formsResponse = await axios.get('/forms/', {
            headers: getAuthHeaders()
        });
        const forms = formsResponse.data;
        console.log('📋 Forms loaded:', forms.length);
        
        // Create a map of form ID to form data with fields array
        const formMap = new Map();
        
        // Initialize form map with all forms
        forms.forEach(form => {
            formMap.set(form.id, {
                id: form.id,
                name: form.name,
                fields: []
            });
        });
        
        // Group fields by form ID
        allFields.forEach(field => {
            if (formMap.has(field.form)) {
                formMap.get(field.form).fields.push(field);
            }
        });
        
        // Filter out forms with no fields and sort fields within each form
        const activeForms = [];
        formMap.forEach((form, formId) => {
            if (form.fields.length > 0) {
                // Sort fields by order
                form.fields.sort((a, b) => (a.order || 0) - (b.order || 0));
                activeForms.push(form);
            }
        });
        
        console.log('📊 Active forms with fields:', activeForms.length);
        
        if (activeForms.length === 0) {
            container.innerHTML = '<div class="col-12 text-muted">No additional fields configured</div>';
            return;
        }
        
        // Render fields grouped by form
        let html = '';
        
        activeForms.forEach(form => {
            html += `
                <div class="col-12 mb-4">
                    <div class="card border-primary">
                        <div class="card-header bg-light">
                            <h5 class="mb-0">
                                <i class="fas fa-layer-group me-2 text-primary"></i>
                                ${form.name}
                            </h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
            `;
            
            form.fields.forEach(field => {
                html += `
                    <div class="col-md-6 mb-3">
                        <label for="field_${field.id}" class="form-label">${field.label}</label>
                        <input type="${field.field_type}" 
                               class="form-control dynamic-field-input" 
                               id="field_${field.id}" 
                               data-field-id="${field.id}"
                               data-form-id="${form.id}"
                               placeholder="Enter ${field.label}">
                    </div>
                `;
            });
            
            html += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ Grouped dynamic fields rendered successfully');
        
    } catch (error) {
        console.error('❌ Error loading fields:', error);
        container.innerHTML = '<div class="col-12 text-danger">Error loading fields: ' + error.message + '</div>';
    }
}

// ============================================
// Load employee data for editing
// ============================================
async function loadEmployeeData() {
    try {
        console.log('📡 Loading employee data for ID:', employeeId);
        
        const response = await axios.get(`/employees/${employeeId}/`, {
            headers: getAuthHeaders()
        });
        
        const employee = response.data;
        console.log('👤 Employee data received:', employee);
        
        // Fill static fields
        document.getElementById('employee_id').value = employee.employee_id || '';
        document.getElementById('department').value = employee.department || '';
        document.getElementById('designation').value = employee.designation || '';
        document.getElementById('phone').value = employee.phone || '';
        document.getElementById('date_of_joining').value = employee.date_of_joining || '';
        document.getElementById('email').value = employee.user?.email || '';
        document.getElementById('email').setAttribute('data-old-value', employee.user?.email || '');
        
        // Handle user field based on role and mode
        const userContainer = document.getElementById('userFieldContainer');
        if (userContainer) {
            if (isAdmin && !employeeId) {
                // CREATE MODE - Admin sees dropdown
                await loadUsersDropdown();
            } else {
                // EDIT MODE - Show username as text field (both admin and employee)
                userContainer.innerHTML = `
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" 
                           value="${employee.user?.username || ''}" 
                           data-old-value="${employee.user?.username || ''}"
                           ${!isAdmin ? 'readonly' : ''}>
                    <input type="hidden" id="user_id" value="${employee.user?.id || ''}">
                `;
                console.log('✅ Username field set to:', employee.user?.username);
            }
        }
        
        // Set readonly attributes for non-admin users
        if (!isAdmin) {
            document.getElementById('employee_id').setAttribute('readonly', true);
            document.getElementById('department').setAttribute('readonly', true);
            document.getElementById('designation').setAttribute('readonly', true);
            document.getElementById('date_of_joining').setAttribute('readonly', true);
            document.getElementById('email').setAttribute('readonly', true);
        } else if (employeeId) {
            // Admin in edit mode - fields are editable
            document.getElementById('employee_id').removeAttribute('readonly');
            document.getElementById('department').removeAttribute('readonly');
            document.getElementById('designation').removeAttribute('readonly');
            document.getElementById('date_of_joining').removeAttribute('readonly');
            document.getElementById('email').removeAttribute('readonly');
        }
        
    } catch (error) {
        console.error('❌ Error loading employee data:', error);
        showToast('Error loading employee data', 'error');
    }
}

// ============================================
// Load dynamic data for employee - IMPROVED
// ============================================
async function loadDynamicDataForEmployee() {
    try {
        console.log('📡 Loading dynamic data for employee:', employeeId);
        
        if (!employeeId) {
            console.error('❌ No employee ID provided');
            return;
        }
        
        // Wait for dynamic fields to be fully rendered
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const response = await axios.get(`/dynamic-data/?employee=${employeeId}`, {
            headers: getAuthHeaders()
        });
        
        const dynamicData = response.data;
        console.log('📊 Dynamic data received for employee', employeeId, ':', dynamicData);
        
        // Clear all fields first
        document.querySelectorAll('.dynamic-field-input').forEach(input => {
            input.value = '';
        });
        
        if (dynamicData.length === 0) {
            console.log('ℹ️ No dynamic data found for this employee');
            return;
        }
        
        // Fill dynamic fields
        let populatedCount = 0;
        dynamicData.forEach(data => {
            const input = document.getElementById(`field_${data.field}`);
            if (input) {
                input.value = data.value || '';
                populatedCount++;
                console.log(`✅ Populated field ${data.field} with:`, data.value);
            } else {
                console.log(`⚠️ Field input not found for field ID: ${data.field}`);
            }
        });
        
        console.log(`✅ Populated ${populatedCount} dynamic fields for employee ${employeeId}`);
        
    } catch (error) {
        console.error('❌ Error loading dynamic data:', error);
    }
}

// ============================================
// Handle form submission - WITH CREATE MODE VALIDATION
// ============================================
const employeeForm = document.getElementById('employeeForm');
if (employeeForm) {
    employeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        submitBtn.disabled = true;
        
        try {
            const employeeId_field = document.getElementById('employee_id').value.trim();
            const department = document.getElementById('department').value.trim();
            const designation = document.getElementById('designation').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const date_of_joining = document.getElementById('date_of_joining').value;
            const email = document.getElementById('email').value.trim();
            const userId = document.getElementById('user_id')?.value;
            
            // Validation
            let errors = [];
            
            // For CREATE mode (no employeeId) - Admin creating new employee
            if (!employeeId) {
                // All fields are required for creation
                if (!userId) {
                    errors.push('Please select a user');
                    document.getElementById('user_id')?.classList.add('is-invalid');
                }
                
                if (!employeeId_field) {
                    errors.push('Employee ID is required');
                    document.getElementById('employee_id').classList.add('is-invalid');
                } else {
                    document.getElementById('employee_id').classList.remove('is-invalid');
                }
                
                if (!department) {
                    errors.push('Department is required');
                    document.getElementById('department').classList.add('is-invalid');
                } else {
                    document.getElementById('department').classList.remove('is-invalid');
                }
                
                if (!designation) {
                    errors.push('Designation is required');
                    document.getElementById('designation').classList.add('is-invalid');
                } else {
                    document.getElementById('designation').classList.remove('is-invalid');
                }
                
                if (!date_of_joining) {
                    errors.push('Date of Joining is required');
                    document.getElementById('date_of_joining').classList.add('is-invalid');
                } else {
                    document.getElementById('date_of_joining').classList.remove('is-invalid');
                }
                
                if (!email) {
                    errors.push('Email is required');
                    document.getElementById('email').classList.add('is-invalid');
                } else if (!isValidEmail(email)) {
                    errors.push('Please enter a valid email address');
                    document.getElementById('email').classList.add('is-invalid');
                } else {
                    document.getElementById('email').classList.remove('is-invalid');
                }
            } 
            // For EDIT MODE - Admin editing existing employee
            else if (isAdmin) {
                if (!employeeId_field) {
                    errors.push('Employee ID is required');
                    document.getElementById('employee_id').classList.add('is-invalid');
                } else {
                    document.getElementById('employee_id').classList.remove('is-invalid');
                }
                
                if (!department) {
                    errors.push('Department is required');
                    document.getElementById('department').classList.add('is-invalid');
                } else {
                    document.getElementById('department').classList.remove('is-invalid');
                }
                
                if (!designation) {
                    errors.push('Designation is required');
                    document.getElementById('designation').classList.add('is-invalid');
                } else {
                    document.getElementById('designation').classList.remove('is-invalid');
                }
                
                if (!date_of_joining) {
                    errors.push('Date of Joining is required');
                    document.getElementById('date_of_joining').classList.add('is-invalid');
                } else {
                    document.getElementById('date_of_joining').classList.remove('is-invalid');
                }
                
                if (!email) {
                    errors.push('Email is required');
                    document.getElementById('email').classList.add('is-invalid');
                } else if (!isValidEmail(email)) {
                    errors.push('Please enter a valid email address');
                    document.getElementById('email').classList.add('is-invalid');
                } else {
                    document.getElementById('email').classList.remove('is-invalid');
                }
            }
            
            // Phone is required for EVERYONE (both admin create/edit and employee edit)
            if (!phone) {
                errors.push('Phone number is required');
                document.getElementById('phone').classList.add('is-invalid');
            } else {
                document.getElementById('phone').classList.remove('is-invalid');
            }

            // For employees in edit mode, we DON'T validate other fields
            // because we're not sending them to the backend
            if (!isAdmin && employeeId) {
                // Employee edit mode - only validate phone (already done above)
                console.log('Employee edit mode - only validating phone');
            } 
            // For CREATE mode or Admin edit mode, validate all fields
            else {
                // Your existing validation for other fields
                if (!employeeId_field) {
                    errors.push('Employee ID is required');
                    document.getElementById('employee_id').classList.add('is-invalid');
                } else {
                    document.getElementById('employee_id').classList.remove('is-invalid');
                }
                
                if (!department) {
                    errors.push('Department is required');
                    document.getElementById('department').classList.add('is-invalid');
                } else {
                    document.getElementById('department').classList.remove('is-invalid');
                }
                
                if (!designation) {
                    errors.push('Designation is required');
                    document.getElementById('designation').classList.add('is-invalid');
                } else {
                    document.getElementById('designation').classList.remove('is-invalid');
                }
                
                if (!date_of_joining) {
                    errors.push('Date of Joining is required');
                    document.getElementById('date_of_joining').classList.add('is-invalid');
                } else {
                    document.getElementById('date_of_joining').classList.remove('is-invalid');
                }
                
                if (!email) {
                    errors.push('Email is required');
                    document.getElementById('email').classList.add('is-invalid');
                } else if (!isValidEmail(email)) {
                    errors.push('Please enter a valid email address');
                    document.getElementById('email').classList.add('is-invalid');
                } else {
                    document.getElementById('email').classList.remove('is-invalid');
                }
            }
            if (errors.length > 0) {
                showToast(errors.join('<br>'), 'error');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
            
            let employeeData;
            let userData = null;
            
            if (employeeId) {
                // EDIT MODE
                if (isAdmin) {
                    // ADMIN: Can update ALL fields
                    employeeData = {
                        employee_id: employeeId_field,
                        user_id: parseInt(userId),
                        department: department,
                        designation: designation,
                        phone: phone,
                        date_of_joining: date_of_joining
                    };
                    
                    // Admin can also update email
                    const oldEmail = document.getElementById('email').getAttribute('data-old-value');
                    if (email && email !== oldEmail) {
                        userData = { email: email };
                    }
                    
                    // Admin can update username if changed
                    const newUsername = document.getElementById('username')?.value;
                    const oldUsername = document.getElementById('username')?.getAttribute('data-old-value');
                    if (newUsername && newUsername !== oldUsername) {
                        if (!userData) userData = {};
                        userData.username = newUsername;
                    }
                    
                } else {
                    // EMPLOYEE: Can ONLY update phone number and dynamic data
                    // Send ONLY the phone field - don't include other fields
                    employeeData = {
                        phone: phone
                    };
                    console.log('Employee updating only phone number');
                    
                    // No userData for employees - they can't change username/email
                    userData = null;
                }
                
                console.log('📤 Updating employee data:', employeeData);
                
                // Update employee data
                await axios.put(`/employees/${employeeId}/`, employeeData, {
                    headers: getAuthHeaders()
                });
                
                // Update user data if changed (admin only)
                if (userData && Object.keys(userData).length > 0) {
                    console.log('📤 Updating user data:', userData);
                    await axios.put(`/accounts/users/${userId}/`, userData, {
                        headers: getAuthHeaders()
                    });
                }
                
            } else {
                // CREATE MODE - Admin only
                employeeData = {
                    employee_id: employeeId_field,
                    user_id: parseInt(userId),
                    department: department,
                    designation: designation,
                    phone: phone,
                    date_of_joining: date_of_joining
                };
                
                console.log('📤 Creating employee:', employeeData);
                const response = await axios.post('/employees/', employeeData, {
                    headers: getAuthHeaders()
                });
                employeeId = response.data.employee_record_id;
                
                // Update email for the user
                if (email) {
                    await axios.put(`/accounts/users/${userId}/`, {
                        email: email
                    }, {
                        headers: getAuthHeaders()
                    });
                }
            }
            
            // Save dynamic data (both admin and employee can edit)
            await saveDynamicData();
            
            showToast('Profile updated successfully!', 'success');
            
            setTimeout(() => {
                if (isAdmin) {
                    window.location.href = '/list/';
                } else {
                    window.location.href = '/profile/';
                }
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error saving:', error);
            
            // Check if it's a backend validation error
            if (error.response?.data) {
                const backendErrors = error.response.data;
                let errorMsg = '';
                
                // Handle different error formats
                if (typeof backendErrors === 'object') {
                    errorMsg = Object.entries(backendErrors)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n');
                } else {
                    errorMsg = backendErrors.detail || 'Error saving';
                }
                
                showToast(errorMsg, 'error');
            } else {
                showToast('Error saving', 'error');
            }
            
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Email validation helper function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ============================================
// Save dynamic data - FIXED VERSION
// ============================================
async function saveDynamicData() {
    const dynamicInputs = document.querySelectorAll('.dynamic-field-input');
    
    if (!employeeId) {
        console.error('❌ No employee ID for saving dynamic data');
        return;
    }
    
    console.log(`📤 Saving dynamic data for employee ${employeeId}`);
    
    // Get existing dynamic data for this specific employee
    let existingData = [];
    try {
        const response = await axios.get(`/dynamic-data/?employee=${employeeId}`, {
            headers: getAuthHeaders()
        });
        existingData = response.data;
        console.log('📊 Existing dynamic data for employee', employeeId, ':', existingData);
    } catch (error) {
        console.log('No existing dynamic data found');
    }
    
    // Create a map of field_id to existing record
    const existingMap = {};
    existingData.forEach(item => {
        existingMap[item.field] = item;
    });
    
    // Save each field
    let savedCount = 0;
    for (const input of dynamicInputs) {
        const fieldValue = input.value.trim();
        const fieldId = parseInt(input.dataset.fieldId);
        
        console.log(`🔍 Processing field ${fieldId} for employee ${employeeId}: value="${fieldValue}"`);
        
        try {
            if (fieldValue) {
                // Only save if there's a value
                const data = {
                    employee: parseInt(employeeId),
                    field: fieldId,
                    value: fieldValue
                };
                
                if (existingMap[fieldId]) {
                    // Update existing record
                    const response = await axios.put(`/dynamic-data/${existingMap[fieldId].id}/`, data, {
                        headers: getAuthHeaders()
                    });
                    console.log(`✅ Updated field ${fieldId}:`, response.data);
                } else {
                    // Create new record
                    const response = await axios.post('/dynamic-data/', data, {
                        headers: getAuthHeaders()
                    });
                    console.log(`✅ Created field ${fieldId}:`, response.data);
                }
                savedCount++;
            } else if (existingMap[fieldId]) {
                // If value is empty and record exists, delete it
                await axios.delete(`/dynamic-data/${existingMap[fieldId].id}/`, {
                    headers: getAuthHeaders()
                });
                console.log(`🗑️ Deleted empty field ${fieldId}`);
            }
        } catch (error) {
            console.error(`❌ Error saving field ${fieldId}:`, error.response?.data || error.message);
        }
    }
    
    console.log(`✅ Saved ${savedCount} dynamic fields for employee ${employeeId}`);
}

// ============================================
// Toast function
// ============================================
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        alert(message);
        return;
    }
    
    const toastId = 'toast-' + Date.now();
    const bgColor = {
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
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

// Make functions global
window.showToast = showToast;
window.getAuthHeaders = getAuthHeaders;