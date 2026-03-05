// static/js/form_builder.js

let currentFormId = null;

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Form builder loaded');
    
    if (!localStorage.getItem('access_token')) {
        window.location.href = '/';
        return;
    }
    
    setTimeout(initializeFormBuilder, 200);
});

function initializeFormBuilder() {
    const tbody = document.getElementById('formsTableBody');
    
    if (!tbody) {
        console.log('Table body not ready, retrying...');
        setTimeout(initializeFormBuilder, 500);
        return;
    }
    
    loadForms();
}

// ============================================
// Form Management
// ============================================
function manageFields(formId) {
    window.location.href = `/form-fields/?form_id=${formId}`;
}

async function loadForms() {
    const tbody = document.getElementById('formsTableBody');
    if (!tbody) return;

    try {
        const response = await axios.get('/forms/', {
            headers: getAuthHeaders()
        });
        
        const forms = response.data;
        
        if (!forms.length) {
            tbody.innerHTML = getEmptyStateHTML();
            return;
        }
        
        tbody.innerHTML = forms.map(form => `
            <tr>
                <td>${form.id}</td>
                <td><strong>${form.name}</strong></td>
                <td><span class="badge bg-info">${form.fields?.length || 0} fields</span></td>
                <td>${form.created_by_username || 'Admin'}</td>
                <td>${new Date(form.created_at).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="editForm(${form.id})" title="Edit Form">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="manageFields(${form.id})" title="Manage Fields">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="showDeleteFormModal(${form.id})" title="Delete Form">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading forms:', error);
        if (tbody) {
            tbody.innerHTML = getErrorHTML(error);
        }
    }
}

function getEmptyStateHTML() {
    return `
        <tr>
            <td colspan="6" class="text-center py-5">
                <i class="fas fa-table fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No forms yet</h5>
                <p class="text-muted">Create your first dynamic form</p>
                <button class="btn btn-primary" onclick="showCreateFormModal()">
                    <i class="fas fa-plus me-2"></i>Create Form
                </button>
            </td>
        </tr>
    `;
}

function getErrorHTML(error) {
    return `
        <tr>
            <td colspan="6" class="text-center py-5">
                <i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i>
                <h5 class="text-danger">Error loading forms</h5>
                <p class="text-muted">${error.response?.data?.detail || error.message}</p>
                <button class="btn btn-primary mt-3" onclick="loadForms()">
                    <i class="fas fa-sync-alt me-2"></i>Try Again
                </button>
            </td>
        </tr>
    `;
}

// ============================================
// Modal Functions
// ============================================
function showCreateFormModal() {
    currentFormId = null;
    document.getElementById('formModalLabel').textContent = 'Create New Form';
    document.getElementById('formName').value = '';
    new bootstrap.Modal(document.getElementById('formModal')).show();
}

function editForm(formId) {
    currentFormId = formId;
    
    axios.get(`/forms/${formId}/`, { headers: getAuthHeaders() })
        .then(response => {
            document.getElementById('formModalLabel').textContent = 'Edit Form';
            document.getElementById('formName').value = response.data.name;
            new bootstrap.Modal(document.getElementById('formModal')).show();
        })
        .catch(error => {
            console.error('Error loading form:', error);
            showToast('Error loading form details', 'error');
        });
}

async function saveForm() {
    const formName = document.getElementById('formName').value.trim();
    
    if (!formName) {
        showToast('Form name is required', 'error');
        return;
    }
    
    const saveBtn = document.querySelector('#formModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    saveBtn.disabled = true;
    
    try {
        const payload = { name: formName };
        
        if (currentFormId) {
            await axios.put(`/forms/${currentFormId}/`, payload, { headers: getAuthHeaders() });
            showToast('Form updated successfully', 'success');
        } else {
            await axios.post('/forms/', payload, { headers: getAuthHeaders() });
            showToast('Form created successfully', 'success');
        }
        
        // Close modal properly
        const modal = bootstrap.Modal.getInstance(document.getElementById('formModal'));
        if (modal) modal.hide();
        
        // Clean up modal backdrop
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        document.getElementById('formName').value = '';
        currentFormId = null;
        await loadForms();
        
    } catch (error) {
        console.error('Error saving form:', error);
        const errorMsg = error.response?.data?.detail || 'Error saving form';
        showToast(errorMsg, 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

function showDeleteFormModal(formId) {
    currentFormId = formId;
    new bootstrap.Modal(document.getElementById('deleteFormModal')).show();
}

async function confirmDeleteForm() {
    if (!currentFormId) return;
    
    const deleteBtn = document.querySelector('#deleteFormModal .btn-danger');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
    deleteBtn.disabled = true;
    
    try {
        await axios.delete(`/forms/${currentFormId}/`, { headers: getAuthHeaders() });
        showToast('Form deleted successfully', 'success');
        
        // Close modal properly
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteFormModal'));
        if (modal) modal.hide();
        
        // Clean up modal backdrop
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        await loadForms();
        
    } catch (error) {
        console.error('Error deleting form:', error);
        
        if (error.response?.status === 401) {
            showToast('Your session has expired. Please login again.', 'error');
            setTimeout(() => window.location.href = '/', 2000);
        } else {
            showToast(error.response?.data?.detail || 'Error deleting form', 'error');
        }
    } finally {
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled = false;
        currentFormId = null;
    }
}

// ============================================
// Helpers
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
    };
}

// ============================================
// Toast Helper - FIXED (No recursion)
// ============================================
function showToast(message, type = 'info') {
    // Use global toast function if available and it's not this function
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Fallback
    alert(message);
}

// ============================================
// Global exports
// ============================================
window.showCreateFormModal = showCreateFormModal;
window.editForm = editForm;
window.saveForm = saveForm;
window.showDeleteFormModal = showDeleteFormModal;
window.confirmDeleteForm = confirmDeleteForm;
window.manageFields = manageFields;