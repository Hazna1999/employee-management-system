import time
from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.shortcuts import render
from django.contrib.auth.models import User
from .models import Employee, DynamicForm, DynamicField, EmployeeDynamicData
from .serializers import (
    EmployeeSerializer, DynamicFormSerializer, DynamicFieldSerializer,
    EmployeeDynamicDataSerializer, UserSerializer
)


# ==============================
# Custom Permissions
# ==============================

class IsAdminOrSelf(BasePermission):
    """Allow access if user is admin or the employee themselves."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        return user.is_superuser or obj.user == user


class IsAdminOrReadOnly(BasePermission):
    """Allow read-only for authenticated users, full access for admins."""
    
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_superuser


# ==============================
# Page Views (Frontend)
# ==============================

def index_page(request):
    """Landing page view."""
    return render(request, 'index.html')


def employee_list_page(request):
    """Employee list page."""
    return render(request, 'employee_list.html')


def employee_create_page(request):
    """Employee create/edit page."""
    return render(request, 'employee_create.html')


def form_builder_page(request):
    """Form builder page for admin."""
    return render(request, 'form_builder.html')


def form_fields_page(request):
    """Form fields management page."""
    return render(request, 'form_fields.html')


def employee_dashboard_page(request):
    """Dashboard page for regular employees."""
    return render(request, 'dashboard.html')


def employee_profile_page(request):
    """
    Profile page for employees.
    Uses the same template as create/edit with limited permissions.
    """
    return render(request, 'employee_create.html')


# ==============================
# User Management API Views
# ==============================

@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_user(request):
    """Create a new user (admin only)."""
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    is_superuser = request.data.get('is_superuser', False)
    
    if not username or not email or not password:
        return Response(
            {'detail': 'Please provide username, email and password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(username=username).exists():
        return Response(
            {'detail': 'Username already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(email=email).exists():
        return Response(
            {'detail': 'Email already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )
    
    if is_superuser:
        user.is_superuser = True
        user.is_staff = True
        user.save()
    
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_superuser': user.is_superuser
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_users(request):
    """List all users for dropdowns (admin only)."""
    try:
        users = User.objects.all().order_by('username')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ==============================
# Employee ViewSet
# ==============================

class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD operations for employees with role-based access."""
    
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSelf]

    def get_queryset(self):
        """Optimize queries with select_related."""
        user = self.request.user
        queryset = Employee.objects.all().select_related('user')
        
        if not user.is_superuser:
            queryset = queryset.filter(user=user)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Override list to add performance metrics."""
        start = time.time()
        response = super().list(request, *args, **kwargs)
        end = time.time()
        
        print(f"✅ Employee query took: {(end-start)*1000:.2f}ms")
        print(f"📊 Number of employees: {self.get_queryset().count()}")
        
        return response


# ==============================
# Dynamic Form ViewSet
# ==============================

class DynamicFormViewSet(viewsets.ModelViewSet):
    """CRUD operations for dynamic forms."""
    
    queryset = DynamicForm.objects.all()
    serializer_class = DynamicFormSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DynamicFieldViewSet(viewsets.ModelViewSet):
    """CRUD operations for dynamic fields."""
    
    queryset = DynamicField.objects.all()
    serializer_class = DynamicFieldSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        """Filter fields by form if form_id provided."""
        queryset = super().get_queryset()
        form_id = self.request.query_params.get('form')
        
        if form_id:
            queryset = queryset.filter(form_id=form_id)
        
        return queryset

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError as e:
            raise serializers.ValidationError({'detail': str(e)})


class EmployeeDynamicDataViewSet(viewsets.ModelViewSet):
    """CRUD operations for employee dynamic field values."""
    
    serializer_class = EmployeeDynamicDataSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter data by employee and user role."""
        user = self.request.user
        queryset = EmployeeDynamicData.objects.all()
        
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        
        if not user.is_superuser:
            queryset = queryset.filter(employee__user=user)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create or update dynamic field value."""
        employee_id = request.data.get('employee')
        field_id = request.data.get('field')
        
        if not employee_id or not field_id:
            return Response(
                {'detail': 'employee and field are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            existing = EmployeeDynamicData.objects.filter(
                employee_id=employee_id,
                field_id=field_id
            ).first()
            
            if existing:
                serializer = self.get_serializer(existing, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data)
            
            return super().create(request, *args, **kwargs)
            
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def perform_create(self, serializer):
        """Save with proper employee and field validation."""
        user = self.request.user
        data = self.request.data
        
        employee_id = data.get('employee')
        field_id = data.get('field')
        
        try:
            if user.is_superuser:
                employee = Employee.objects.get(id=employee_id)
            else:
                employee = Employee.objects.get(user=user)
            
            field = DynamicField.objects.get(id=field_id)
            serializer.save(employee=employee, field=field)
            
        except Employee.DoesNotExist:
            raise serializers.ValidationError({'detail': 'Employee not found'})
        except DynamicField.DoesNotExist:
            raise serializers.ValidationError({'detail': 'Field not found'})