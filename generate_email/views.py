from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic import FormView, View,TemplateView


# Create your views here.
class GenerateEmailView(LoginRequiredMixin, TemplateView):
    template_name = 'generate_email/email_generator.html'
    title = "Home"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title

        return context