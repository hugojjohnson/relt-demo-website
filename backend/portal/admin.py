from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Person, StudentProfile, TutorProfile, Pairing, TutoringSession

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ("email", "role", "is_staff")
    ordering = ("email",)
    fieldsets = ((None, {"fields": ("email", "password")}), ("Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}), ("Important dates", {"fields": ("last_login",)}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2")} ),)
    search_fields = ("email",)

admin.site.register([Person, StudentProfile, TutorProfile, Pairing, TutoringSession])
