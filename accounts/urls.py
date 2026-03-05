from django.urls import path
from . import views
from .views import (
    RegisterView,
    LoginView,
    ChangePasswordView,
    update_user,
    create_user_admin,
    delete_user,
    get_user,
    user_list_page
)

urlpatterns = [
    # Authentication endpoints (public)
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    # User management API endpoints (admin only)
    path('users/create/', create_user_admin, name='create_user_admin'),
    path('users/<int:user_id>/', update_user, name='update_user'),
    path('users/<int:user_id>/details/', get_user, name='get_user'),
    path('users/<int:user_id>/delete/', delete_user, name='delete_user'),
    
    # Frontend pages
    path('users/list/', user_list_page, name='user_list_page'),
]