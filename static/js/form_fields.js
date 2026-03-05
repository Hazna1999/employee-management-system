// static/js/form_fields.js

let currentFormId = null;
let sortable = null;

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('access_token')) {
        window.location.href = '/';
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    currentFormId = urlParams.get('form_id');
    
    if (!currentFormId) {
        showToast('No form ID provided', 'error');
        setTimeout(() => window.location.href = '/forms-builder/', 2000);
        return;
    }
    
    const formIdInput = document.getElementById('formId');
    if (formIdInput) {
        formIdInput.value = currentFormId;
    }
    
    loadFormDetails();
    loadFields();
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
// Load Form Data
// ============================================
async function loadFormDetails() {
    try {
        const response = await axios.get(`/forms/${currentFormId}/`, {
            headers: getAuthHeaders()
        });
        
        const nameDisplay = document.getElementById('formNameDisplay');
        if (nameDisplay) {
            nameDisplay.textContent = response.data.name;
        }
    } catch (error) {
        console.error('Error loading form details:', error);
    }
}

async function loadFields() {
    const fieldsList = document.getElementById('fieldsList');
    if (!fieldsList) return;
    
    fieldsList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Loading fields...</p></div>';
    
    try {
        const response = await axios.get(`/fields/?form=${currentFormId}`, {
            headers: getAuthHeaders()
        });
        
        const fields = response.data;
        
        if (!fields || fields.length === 0) {
            fieldsList.innerHTML = getEmptyFieldsHTML();
            return;
        }
        
        fields.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        const fieldsHTML = fields.map(field => `
            <div class="field-item card mb-2" data-field-id="${field.id}" data-order="${field.order || 0}">
                <div class="card-body d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-grip-vertical me-3 text-muted drag-handle" style="cursor: move;"></i>
                        <div>
                            <strong>${field.label}</strong>
                            <span class="badge bg-secondary ms-2">${field.field_type}</span>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-warning me-1" 
                                onclick="editField(${field.id}, '${field.label}', '${field.field_type}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteField(${field.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        fieldsList.innerHTML = `<div class="field-sortable">${fieldsHTML}</div>`;
        initDragAndDrop();
        
    } catch (error) {
        console.error('Error loading fields:', error);
        fieldsList.innerHTML = getErrorHTML(error);
    }
}

function getEmptyFieldsHTML() {
    return `
        <div class="text-center py-5">
            <i class="fas fa-info-circle fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No fields yet</h5>
            <p class="text-muted">Click "Add Field" to create your first field.</p>
            <button class="btn btn-primary mt-3" onclick="showAddFieldModal()">
                <i class="fas fa-plus me-2"></i>Add Field
            </button>
        </div>
    `;
}

function getErrorHTML(error) {
    return `
        <div class="text-center py-5">
            <i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i>
            <h5 class="text-danger">Error loading fields</h5>
            <p class="text-muted">${error.response?.data?.detail || error.message}</p>
            <button class="btn btn-primary mt-3" onclick="loadFields()">
                <i class="fas fa-sync-alt me-2"></i>Try Again
            </button>
        </div>
    `;
}

// ============================================
// Drag & Drop
// ============================================
function initDragAndDrop() {
    const fieldList = document.querySelector('.field-sortable');
    if (!fieldList) return;
    
    if (sortable) {
        sortable.destroy();
    }
    
    try {
        sortable = new Sortable(fieldList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async () => {
                const items = document.querySelectorAll('.field-item');
                const updates = Array.from(items).map((item, index) => 
                    axios.patch(`/fields/${item.dataset.fieldId}/`, 
                        { order: index }, 
                        { headers: getAuthHeaders() }
                    )
                );
                
                try {
                    await Promise.all(updates);
                    showToast('Field order updated', 'success');
                } catch (error) {
                    console.error('Error updating order:', error);
                    showToast('Error updating field order', 'error');
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Sortable:', error);
    }
}

// ============================================
// Modal Functions
// ============================================
function showAddFieldModal() {
    document.getElementById('fieldId').value = '';
    document.getElementById('fieldLabel').value = '';
    document.getElementById('fieldType').value = '';
    document.getElementById('fieldModalLabel').textContent = 'Add Field';
    new bootstrap.Modal(document.getElementById('fieldModal')).show();
}

function editField(fieldId, label, type) {
    document.getElementById('fieldId').value = fieldId;
    document.getElementById('fieldLabel').value = label;
    document.getElementById('fieldType').value = type;
    document.getElementById('fieldModalLabel').textContent = 'Edit Field';
    new bootstrap.Modal(document.getElementById('fieldModal')).show();
}

async function saveField() {
    const fieldId = document.getElementById('fieldId').value;
    const label = document.getElementById('fieldLabel').value.trim();
    const type = document.getElementById('fieldType').value;
    
    if (!label || !type) {
        showToast('Label and type are required', 'error');
        return;
    }
    
    if (!currentFormId) {
        showToast('Form ID is missing', 'error');
        return;
    }
    
    const saveBtn = document.querySelector('#fieldModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    saveBtn.disabled = true;
    
    try {
        const data = {
            form: parseInt(currentFormId),
            label,
            field_type: type
        };
        
        if (fieldId) {
            await axios.put(`/fields/${fieldId}/`, data, { headers: getAuthHeaders() });
        } else {
            await axios.post('/fields/', data, { headers: getAuthHeaders() });
        }
        
        bootstrap.Modal.getInstance(document.getElementById('fieldModal'))?.hide();
        await loadFields();
        showToast('Field saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving field:', error);
        const errorMsg = error.response?.data?.detail || 'Error saving field';
        showToast(errorMsg, 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteField(fieldId) {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    try {
        await axios.delete(`/fields/${fieldId}/`, { headers: getAuthHeaders() });
        showToast('Field deleted successfully', 'success');
        await loadFields();
    } catch (error) {
        console.error('Error deleting field:', error);
        showToast('Error deleting field', 'error');
    }
}

// ============================================
// Toast Helper
// ============================================
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`${type}: ${message}`);
        type === 'error' ? alert(`Error: ${message}`) : alert(message);
    }
}

// ============================================
// Global Exports
// ============================================
window.showAddFieldModal = showAddFieldModal;
window.saveField = saveField;
window.editField = editField;
window.deleteField = deleteField;