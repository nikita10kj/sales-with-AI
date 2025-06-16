from django import forms
from .models import CustomUser

class EmailForm(forms.Form):
    email = forms.EmailField()

class OTPForm(forms.Form):
    email = forms.EmailField(widget=forms.HiddenInput())
    otp = forms.CharField(max_length=6, required=False)
