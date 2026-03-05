// static/js/employee_list.js

let deleteEmployeeId = null;
let allEmployees = [];
let searchTimeout = null;

// ============================================
// Load employees via API
// ============================================
async function loadEmployees() {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) {
        console.error('Employee table body not found');
        return;
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading employees...</span>
                </div>
            </td>
        </tr>
    `;
    
    try {
        const response = await axios.get('/employees/', {
            headers: getAuthHeaders()
        });
        
        allEmployees = response.data;
        console.log(`Employees loaded: ${allEmployees.length}`);
        
        populateDepartmentFilter();
        applyFilters(); // Apply filters after loading
        
    } catch (error) {
        console.error('Error loading employees:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-circle"></i> 
                        Error loading employees: ${error.response?.data?.detail || error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// ============================================
// Populate department filter dropdown
// ============================================
function populateDepartmentFilter() {
    const filterSelect = document.getElementById('departmentFilter');
    if (!filterSelect) return;
    
    const departments = [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))];
    
    filterSelect.innerHTML = '<option value="">All Departments</option>';
    
    departments.sort().forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        filterSelect.appendChild(option);
    });
    
    console.log(`Department filter loaded: ${departments.length} departments`);
}

// ============================================
// Apply filters - Called automatically
// ============================================
function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const departmentFilter = document.getElementById('departmentFilter');
    
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    const departmentValue = departmentFilter?.value || '';
    
    console.log('Auto-applying filters - Search:', searchTerm, 'Department:', departmentValue);
    
    let filteredEmployees = [...allEmployees];
    
    // Apply department filter
    if (departmentValue) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.department?.toLowerCase() === departmentValue.toLowerCase()
        );
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp => 
            (emp.employee_id?.toLowerCase().includes(searchTerm)) ||
            (emp.user?.username?.toLowerCase().includes(searchTerm)) ||
            (emp.department?.toLowerCase().includes(searchTerm)) ||
            (emp.designation?.toLowerCase().includes(searchTerm)) ||
            (emp.phone?.includes(searchTerm))
        );
    }
    
    displayEmployees(filteredEmployees);
}

// ============================================
// Handle search input with debounce
// ============================================
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applyFilters();
    }, 300); // Wait 300ms after user stops typing
}

// ============================================
// Display employees in table
// ============================================
function displayEmployees(employees) {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;
    
    if (!employees?.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-info-circle"></i> No employees found
                </td>
            </tr>
        `;
        return;
    }
    
    const html = employees.map(emp => {
        const empId = emp.employee_record_id || emp.id;
        return `
            <tr>
                <td><strong>${emp.employee_id || 'N/A'}</strong></td>
                <td><i class="fas fa-user-circle text-primary me-2"></i>${emp.user?.username || 'N/A'}</td>
                <td>${emp.department || 'N/A'}</td>
                <td>${emp.designation || 'N/A'}</td>
                <td>${emp.user?.email || 'N/A'}</td>
                <td>${emp.phone || 'N/A'}</td>
                <td>${emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div class="btn-group" role="group">
                        <a href="/create/?id=${empId}" class="btn btn-warning btn-sm" title="Edit">
                            <i class="fas fa-edit"></i>
                        </a>
                        <button class="btn btn-danger btn-sm" onclick="confirmDelete(${empId})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
    console.log(`Displayed ${employees.length} employees`);
}

// ============================================
// Clear filters
// ============================================
function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const departmentFilter = document.getElementById('departmentFilter');
    
    if (searchInput) searchInput.value = '';
    if (departmentFilter) departmentFilter.value = '';
    
    applyFilters();
    showToast('Filters cleared', 'info');
}

// ============================================
// Delete confirmation
// ============================================
function confirmDelete(employeeId) {
    deleteEmployeeId = employeeId;
    
    const modalElement = document.getElementById('deleteConfirmModal');
    if (!modalElement) {
        showToast('Delete modal not found', 'error');
        return;
    }
    
    new bootstrap.Modal(modalElement).show();
}

// ============================================
// Delete employee
// ============================================
async function deleteEmployee() {
    if (!deleteEmployeeId) return;
    
    const modalElement = document.getElementById('deleteConfirmModal');
    const deleteBtn = document.querySelector('#deleteConfirmModal .btn-danger');
    const originalText = deleteBtn.innerHTML;
    
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
    deleteBtn.disabled = true;
    
    try {
        await axios.delete(`/employees/${deleteEmployeeId}/`, {
            headers: getAuthHeaders()
        });
        
        showToast('Employee deleted successfully', 'success');
        
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
        
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        await loadEmployees();
        
    } catch (error) {
        console.error('Error deleting employee:', error);
        
        if (error.response?.status === 401) {
            showToast('Your session has expired. Please login again.', 'error');
            setTimeout(() => window.location.href = '/', 2000);
        } else {
            showToast('Error deleting employee', 'error');
        }
        
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
        
    } finally {
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled = false;
        deleteEmployeeId = null;
    }
}

// ============================================
// Load dynamic fields
// ============================================
async function loadDynamicFields() {
    try {
        const response = await axios.get('/fields/', {
            headers: getAuthHeaders()
        });
        console.log(`Dynamic fields loaded: ${response.data.length}`);
    } catch (error) {
        console.error('Error loading fields:', error);
    }
}

// ============================================
// Auth headers helper
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
    };
}

// ============================================
// Toast notification
// ============================================
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        alert(message);
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
    if (toastElement) {
        new bootstrap.Toast(toastElement, { delay: 3000 }).show();
        setTimeout(() => toastElement.remove(), 3000);
    }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('access_token')) {
        window.location.href = '/';
        return;
    }
    
    // Set up event listeners for automatic filtering
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    const departmentFilter = document.getElementById('departmentFilter');
    if (departmentFilter) {
        departmentFilter.addEventListener('change', applyFilters);
    }
    
    loadEmployees();
    loadDynamicFields();
});

// ============================================
// Global exports
// ============================================
window.confirmDelete = confirmDelete;
window.deleteEmployee = deleteEmployee;
window.clearFilters = clearFilters;
window.getAuthHeaders = getAuthHeaders;