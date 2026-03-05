from django.db import models
from django.contrib.auth.models import User


class Employee(models.Model):
    """
    Employee model linked to Django User model.
    Contains static employee information.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="employee_profile"
    )
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.CharField(max_length=100)
    designation = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    date_of_joining = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Employee"
        verbose_name_plural = "Employees"

    def __str__(self):
        return f"{self.user.username} - {self.employee_id}"


class DynamicForm(models.Model):
    """
    Form template created by admin.
    Contains groups of dynamic fields.
    """
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_forms"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Dynamic Form"
        verbose_name_plural = "Dynamic Forms"

    def __str__(self):
        return self.name


class DynamicField(models.Model):
    """
    Individual fields within a dynamic form.
    Defines field type, label, and display order.
    """
    FIELD_TYPES = (
        ("text", "Text"),
        ("number", "Number"),
        ("date", "Date"),
        ("email", "Email"),
        ("tel", "Phone"),
        ("textarea", "Textarea"),
    )

    form = models.ForeignKey(
        DynamicForm,
        on_delete=models.CASCADE,
        related_name="fields"
    )
    label = models.CharField(max_length=100)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "Dynamic Field"
        verbose_name_plural = "Dynamic Fields"

    def __str__(self):
        return f"{self.form.name} - {self.label}"


class EmployeeDynamicData(models.Model):
    """
    Stores values entered by employees for dynamic fields.
    Each employee can have one value per field.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="dynamic_data"
    )
    field = models.ForeignKey(
        DynamicField,
        on_delete=models.CASCADE,
        related_name="employee_values"
    )
    value = models.TextField()  # Stores any input as text

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "field"],
                name="unique_employee_field"
            )
        ]
        ordering = ["-created_at"]
        verbose_name = "Employee Dynamic Data"
        verbose_name_plural = "Employee Dynamic Data"

    def __str__(self):
        return f"{self.employee.user.username} - {self.field.label}: {self.value}"