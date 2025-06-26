from django import forms
from .models import CustomUser
from django.core.validators import EmailValidator

class EmailForm(forms.Form):
    email = forms.EmailField()

class OTPForm(forms.Form):
    email = forms.EmailField(widget=forms.HiddenInput())
    otp = forms.CharField(max_length=6, required=False)

class SupportForm(forms.Form):   
    email = forms.EmailField(validators=[EmailValidator])    
    subject = forms.CharField(max_length=500)    
    message = forms.CharField(widget=forms.Textarea)