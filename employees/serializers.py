from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from .models import Employee, DynamicForm, DynamicField, EmployeeDynamicData


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model with additional computed fields.
    """
    full_name = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'display_name', 'is_superuser', 'is_staff'
        ]
    
    def get_full_name(self, obj):
        """Return full name if available, otherwise username."""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username
    
    def get_display_name(self, obj):
        """Return username for display purposes."""
        return obj.username


class EmployeeSerializer(serializers.ModelSerializer):
    """
    Serializer for Employee model with role-based permissions.
    - Admin: Full CRUD access
    - Employee: Read-only except phone field
    """
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)
    employee_record_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Employee
        fields = [
            'employee_record_id', 'user', 'user_id', 'employee_id',
            'department', 'designation', 'phone', 'date_of_joining', 'created_at'
        ]
        read_only_fields = ['employee_record_id', 'created_at']
        extra_kwargs = {
            'employee_id': {'required': False},
            'department': {'required': False},
            'designation': {'required': False},
            'date_of_joining': {'required': False},
            'phone': {'required': True},  # Phone is always required
        }

    def create(self, validated_data):
        """Create a new employee (admin only)."""
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("Request context required")
        
        user = request.user

        if not user.is_superuser:
            raise PermissionDenied("Only admin can create employees.")

        user_id = validated_data.pop('user_id', None)
        if not user_id:
            raise serializers.ValidationError({'user_id': 'This field is required.'})

        assigned_user = get_object_or_404(User, id=user_id)

        if Employee.objects.filter(user=assigned_user).exists():
            raise serializers.ValidationError({
                'detail': 'Employee profile already exists for this user.'
            })

        return Employee.objects.create(user=assigned_user, **validated_data)

    def update(self, instance, validated_data):
        """
        Update employee with role-based restrictions.
        - Admin: Can update all fields
        - Employee: Can only update phone field
        """
        request = self.context.get('request')
        if not request:
            return super().update(instance, validated_data)
            
        request_user = request.user

        if request_user.is_superuser:
            # Admin can update all fields
            return super().update(instance, validated_data)

        # Employees can only update phone
        allowed_fields = ['phone']
        filtered_data = {
            field: validated_data[field] 
            for field in allowed_fields 
            if field in validated_data
        }
        
        for attr, value in filtered_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class DynamicFieldSerializer(serializers.ModelSerializer):
    """
    Serializer for DynamicField model.
    """
    form = serializers.PrimaryKeyRelatedField(queryset=DynamicForm.objects.all())

    class Meta:
        model = DynamicField
        fields = ['id', 'form', 'label', 'field_type', 'order']


class DynamicFormSerializer(serializers.ModelSerializer):
    """
    Serializer for DynamicForm model with nested fields.
    """
    fields = DynamicFieldSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = DynamicForm
        fields = ['id', 'name', 'created_by', 'created_by_username', 'created_at', 'fields']
        read_only_fields = ['created_by', 'created_at']


class EmployeeDynamicDataSerializer(serializers.ModelSerializer):
    """
    Serializer for employee responses to dynamic fields.
    """
    field_label = serializers.CharField(source='field.label', read_only=True)
    field_type = serializers.CharField(source='field.field_type', read_only=True)
    employee_name = serializers.CharField(source='employee.user.username', read_only=True)
    
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    field = serializers.PrimaryKeyRelatedField(queryset=DynamicField.objects.all())

    class Meta:
        model = EmployeeDynamicData
        fields = [
            'id', 'employee', 'employee_name', 'field', 'field_label',
            'field_type', 'value', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'field_label', 'field_type', 'employee_name']

    def create(self, validated_data):
        """Create or update dynamic field value for an employee."""
        employee = validated_data.get('employee')
        field = validated_data.get('field')
        value = validated_data.get('value')
        
        obj, created = EmployeeDynamicData.objects.update_or_create(
            employee=employee,
            field=field,
            defaults={'value': value}
        )
        return obj

    def update(self, instance, validated_data):
        """Update dynamic field value."""
        instance.value = validated_data.get('value', instance.value)
        instance.save()
        return instance