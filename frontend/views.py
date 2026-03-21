from django.views.generic import TemplateView
from django.shortcuts import redirect

class LandingPageView(TemplateView):
    template_name = "frontend/landingpage.html"

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('/users') 
        return super().dispatch(request, *args, **kwargs)
