# Employee Management System

A comprehensive Employee Management System built with Django REST Framework and vanilla JavaScript. Features dynamic form builder, role-based access control, and JWT authentication.

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication (access & refresh tokens)
- Role-based access control (Admin vs Employee)
- Only users with employee records can login
- Password change functionality
- Profile management

### Employee Management
- Full CRUD operations for employees
- Role-based permissions:
  - **Admins**: Full access to all employees
  - **Employees**: View-only except phone number
- Employee listing with search and filters
- Department-wise filtering
- Delete with confirmation modal

### Dynamic Form Builder
- Create custom forms (Admin only)
- Add multiple field types:
  - Text, Number, Date, Email, Phone, Textarea
- Drag-and-drop field reordering
- Field management per form
- Dynamic fields appear in employee forms

### User Management
- Admin-only user management
- Create, edit, delete users
- Set superuser and staff permissions
- Prevent self-deletion

### Modern UI/UX
- Responsive sidebar layout
- Toast notifications
- Confirmation modals
- Loading states
- Real-time search with debounce
- Automatic filtering

## 🛠️ Tech Stack

### Backend
- **Django 4.2** - Python web framework
- **Django REST Framework** - API building
- **SimpleJWT** - JWT authentication
- **SQLite** - Database (development)

### Frontend
- **Vanilla JavaScript** - No frameworks
- **Axios** - HTTP client
- **Bootstrap 5** - UI components
- **Font Awesome** - Icons
- **SortableJS** - Drag-and-drop

## 📋 Prerequisites

- Python 3.9+
- pip (Python package manager)
- Git

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/employee-management-system.git
cd employee-management-system