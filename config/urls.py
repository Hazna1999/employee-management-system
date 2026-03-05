"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django Admin
    path('admin/', admin.site.urls),
    
    # Accounts app - Authentication and user management
    path('accounts/', include('accounts.urls')),
    
    # Employees app - Core application (includes both API and frontend routes)
    path('', include('employees.urls')),
]