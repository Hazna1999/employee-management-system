from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    # ViewSets
    EmployeeViewSet,
    DynamicFormViewSet,
    DynamicFieldViewSet,
    EmployeeDynamicDataViewSet,
    
    # Frontend Pages
    index_page,
    employee_list_page,
    employee_create_page,
    form_builder_page,
    form_fields_page,
    employee_dashboard_page,
    employee_profile_page,
    
    # User Management APIs
    create_user,
    list_users,
)

# API Router Configuration
router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'forms', DynamicFormViewSet, basename='forms')
router.register(r'fields', DynamicFieldViewSet, basename='fields')
router.register(r'dynamic-data', EmployeeDynamicDataViewSet, basename='dynamic_data')

urlpatterns = [
    # ==============================
    # JWT Authentication Endpoints
    # ==============================
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ==============================
    # User Management APIs
    # ==============================
    path('users/', list_users, name='list_users'),
    path('users/create/', create_user, name='create_user'),

    # ==============================
    # Frontend Pages (Order Matters!)
    # These must come before API routes to avoid conflicts
    # ==============================
    path('', index_page, name='index_page'),                    # Landing page
    path('dashboard/', employee_dashboard_page, name='employee_dashboard_page'),
    path('profile/', employee_profile_page, name='employee_profile_page'),
    path('list/', employee_list_page, name='employee_list_page'),
    path('create/', employee_create_page, name='employee_create_page'),
    path('forms-builder/', form_builder_page, name='form_builder_page'),
    path('form-fields/', form_fields_page, name='form_fields_page'),

    # ==============================
    # API Endpoints (from router)
    # These are appended last to prevent route conflicts
    # ==============================
    path('', include(router.urls)),
]