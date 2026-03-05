from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, ChangePasswordSerializer
from employees.models import Employee
from employees.serializers import UserSerializer


# ============================================
# Authentication Views
# ============================================

class RegisterView(APIView):
    """
    Public endpoint for user registration
    Creates a new user account without employee record.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "User registered successfully",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    Login endpoint - Only allows users with employee records
    Returns JWT tokens upon successful authentication.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Verify user has an employee record
        try:
            employee = Employee.objects.get(user=user)
        except Employee.DoesNotExist:
            return Response(
                {"error": "Access denied. Only employees can access this system."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "username": user.username,
            "is_superuser": user.is_superuser,
            "user_id": user.id,
            "employee_id": employee.id
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    Change password for authenticated user
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {"old_password": "Wrong password."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Password updated successfully"})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================
# User Management Views (Admin only)
# ============================================

@api_view(['PUT'])
@permission_classes([IsAdminUser])
def update_user(request, user_id):
    """
    Update user information (admin only)
    """
    try:
        user = User.objects.get(id=user_id)
        
        # Get request data
        username = request.data.get('username')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        # Parse boolean values
        is_superuser = request.data.get('is_superuser', False)
        is_staff = request.data.get('is_staff', False)
        
        # Convert string booleans if needed
        if isinstance(is_superuser, str):
            is_superuser = is_superuser.lower() == 'true'
        if isinstance(is_staff, str):
            is_staff = is_staff.lower() == 'true'
        
        # Update username if changed
        if username and username != user.username:
            if User.objects.filter(username=username).exclude(id=user_id).exists():
                return Response(
                    {'detail': 'Username already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.username = username
        
        # Update email if changed
        if email and email != user.email:
            if User.objects.filter(email=email).exclude(id=user_id).exists():
                return Response(
                    {'detail': 'Email already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.email = email
        
        # Update user fields
        user.first_name = first_name
        user.last_name = last_name
        user.is_superuser = is_superuser
        user.is_staff = is_staff
        user.save()
        
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
            'message': 'User updated successfully'
        })
        
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_user_admin(request):
    """
    Admin only endpoint to create new users
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Set permissions from request
        is_superuser = request.data.get('is_superuser', False)
        is_staff = request.data.get('is_staff', False)
        
        # Convert string booleans if needed
        if isinstance(is_superuser, str):
            is_superuser = is_superuser.lower() == 'true'
        if isinstance(is_staff, str):
            is_staff = is_staff.lower() == 'true'
        
        # Apply permissions
        if is_superuser:
            user.is_superuser = True
        if is_staff:
            user.is_staff = True
        
        if is_superuser or is_staff:
            user.save()
        
        return Response({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_superuser': user.is_superuser,
                'is_staff': user.is_staff
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def delete_user(request, user_id):
    """
    Delete a user (admin only)
    """
    try:
        user = User.objects.get(id=user_id)
        
        # Prevent self-deletion
        if request.user.id == user_id:
            return Response(
                {'detail': 'You cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.delete()
        return Response(
            {'detail': 'User deleted successfully'},
            status=status.HTTP_200_OK
        )
        
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def get_user(request, user_id):
    """
    Get a single user by ID (admin only)
    """
    try:
        user = User.objects.get(id=user_id)
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff
        })
        
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )


def user_list_page(request):
    """
    Page for managing users (admin only)
    """
    return render(request, 'user_list.html')