import base64
import datetime
from multiprocessing import context
from urllib import request
from django.urls import reverse
from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import FormView, View,TemplateView,ListView,DetailView
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from werkzeug.utils import redirect
from .genai_email import get_response
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription,SearchHistory,GlobalSearchLog,UserSearchLimit
from users.models import ProductService, ActivityLog,Signature,UserWallet
import json
import datetime
from django.http import HttpResponse
from django.db.models import Q
from .utils import sendGeneratedEmail, create_subscription, refresh_microsoft_token, MicrosoftEmailSendError
from django.shortcuts import get_object_or_404
from email.utils import make_msgid
from datetime import timedelta, date,datetime
from django.utils import timezone
from django.db.models import OuterRef, Subquery, DateField
from django.db.models.functions import Cast
from django.utils.timezone import now
import calendar
from allauth.socialaccount.models import SocialAccount, SocialToken
from .utils import send_email  # your updated email sending function
from saleswithai import settings
import time
from urllib.parse import quote, unquote
import numpy as np
import csv
import requests
from users.models import EmailAttachment
from django.contrib import messages 
import requests
from django.utils.text import slugify
from .utils import (redrob_search_people,
redrob_start_bulk_enrichment,
redrob_get_enrichment,
redrob_search_by_linkedin_url,
redrob_search_by_company,
)

from .models import SavedPeopleList, SavedPeopleEntry,SavedCompanyEntry,EnrichmentRequest
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
import os
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


def _webhook_url():
    return os.environ.get("REDROB_WEBHOOK_URL", "").strip() or None
 
 
def _deduct_credits(user, count):
    """Deduct `count` credits from the user's limit. Returns the updated object."""
    sl, _ = UserSearchLimit.objects.get_or_create(user=user)
    if count > 0:
        sl.deduct(count)
    return sl


@method_decorator(csrf_exempt, name='dispatch')
class RedrobWebhookView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            print("🔥 WEBHOOK HIT:", data)

        except Exception as e:
            print("❌ Invalid JSON:", e)
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        datas = data.get("datas") or data.get("data", {}).get("datas", [])

        if not datas:
            print("⚠️ No datas found")
            return JsonResponse({"error": "No data"}, status=400)

        updated_count = 0

        for item in datas:
            try:
                # 🔑 Get request_id from customFields
                request_id = item.get("customFields", {}).get("request_id")

                if not request_id:
                    print("⚠️ Missing request_id, skipping...")
                    continue

                enrichment = EnrichmentRequest.objects.filter(
                    request_id=request_id
                ).first()

                if not enrichment:
                    print(f"⚠️ No DB record for request_id: {request_id}")
                    continue

                # ✅ Extract emails
                emails = item.get("emails", [])
                phones = item.get("phones", [])

                first_email = ""
                if emails:
                    first_email = emails[0].get("email", "")

                first_phone = ""
                if phones:
                    first_phone = phones[0].get("number", "")

                

                # ✅ Update DB
                enrichment.status = data.get("status", "")
                enrichment.emails = emails
                enrichment.phones = phones
                enrichment.save()

                print(f"✅ Updated: {request_id} | Email: {first_email}")

                updated_count += 1

            except Exception as e:
                print("❌ Error processing item:", e)
                continue

        return JsonResponse({
            "success": True,
            "updated": updated_count
        })
# ─── Azure OpenAI: parse natural language query → search filters ───────────────
class AiParseSearchView(View):
    """
    POST { "query": "dubai ceo fintech" }
    Returns JSON { "location": "Dubai", "job_title": "CEO", "industry": "Fintech", ... }
    """

    def post(self, request, *args, **kwargs):
        try:
            body = json.loads(request.body)
            query = body.get("query", "").strip()
        except Exception:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        if not query:
            return JsonResponse({"error": "Query is empty"}, status=400)

        # Check if user has search credits before AI parsing
        try:
            limit = UserSearchLimit.objects.get(user=request.user)
            if not limit.has_search_credits():
                return JsonResponse({"error": "No search credits remaining. Please buy search credits."}, status=402)
            # Deduct 1 search credit for AI parsing
            limit.deduct_search(1)
        except UserSearchLimit.DoesNotExist:
            limit = UserSearchLimit.objects.create(user=request.user)
            if limit.has_search_credits():
                limit.deduct_search(1)

        api_key  = os.environ.get("OPENAI_API_KEY", "").strip().strip("'\"")
        endpoint = os.environ.get("ENDPOINT_URL", "").strip().strip("'\"")

        if not api_key or not endpoint:
            return JsonResponse({"error": "Azure OpenAI not configured"}, status=500)

        # Build the Azure OpenAI Chat Completions URL
        # Uses model: gpt-35-turbo (deployment name may differ)
        deployment  = "gpt-4o-mini"
        api_version = "2024-02-01"
        url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"

        system_prompt = (
            "You are a search filter extractor for a B2B people search tool. "
            "Given a free-text query from the user, extract structured search filters. "
            "Return ONLY a valid JSON object with these keys (all optional, omit if not mentioned): "
            "location, job_title, company, industry, skills, name, seniority, degree, institution. "
            "Values should be plain strings. If multiple values exist for a field, join with comma. "
            "Examples: "
            "Query: 'dubai ceo' → {\"location\": \"Dubai\", \"job_title\": \"CEO\"} "
            "Query: 'software engineer london fintech 5 years' → {\"location\": \"London\", \"job_title\": \"Software Engineer\", \"industry\": \"Fintech\"} "
            "Return ONLY the JSON, no explanation."
        )

        headers = {
            "Content-Type": "application/json",
            "api-key": api_key,
        }
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": query},
            ],
            "temperature": 0,
            "max_tokens": 200,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=15)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"].strip()
            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            filters = json.loads(content)
            return JsonResponse({"success": True, "filters": filters})
        except requests.HTTPError as e:
            return JsonResponse({"error": f"Azure API error {e.response.status_code}: {e.response.text}"}, status=500)
        except json.JSONDecodeError:
            return JsonResponse({"error": "AI returned non-JSON response", "raw": content}, status=500)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)



class BlockDirectAccessMixin:
    def dispatch(self, request, *args, **kwargs):
        if request.method == "GET" and not request.META.get("HTTP_REFERER"):
            return redirect('/')
        return super().dispatch(request, *args, **kwargs)

def normalize_linkedin_url(url: str) -> str:
    return (url or "").strip().lower().rstrip("/")

def get_search_limit(user):
    """Get or create UserSearchLimit for user. Always returns the object."""
    limit, _ = UserSearchLimit.objects.get_or_create(
        user=user,
        defaults={"credits": 25}
    )
    return limit



#     return latest.token
# def get_latest_microsoft_token(user):
#     try:
#         token = SocialToken.objects.filter(
#             account__user=user,
#             account__provider="microsoft"
#         ).first()

#         if not token:
#             return None

#         if token.expires_at and token.expires_at <= timezone.now():
#             new_token = refresh_microsoft_token(user)
#             if not new_token:
#                 logger.warning(
#                     "Microsoft token refresh failed for user_id=%s",
#                     user.id
#                 )
#                 return None
#             return new_token

#         return token.token

#     except Exception:
#         logger.exception("Microsoft token lookup failed")
#         return None
    

# class SearchPeopleByLinkdinView(View):
#     # permisson_class=[Allowany]
#     template_name = "generate_email/searchby_linkdin.html"

#     def get(self, request):
#         return render(request, self.template_name)

#     def post(self, request):
#         linkedin_url = request.POST.get("linkedin_url", "").strip()

#         context = {
#             "linkedin_url": linkedin_url,
#             "person": None,
#             "error": None
#         }

#         if not linkedin_url:
#             context["error"] = "Please enter a LinkedIn URL."
#             return render(request, self.template_name, context)

#         try:
#             # Start enrichment
#             start_resp = redrob_start_bulk_enrichment(
#                 data=[{
#                     "linkedinUrl": linkedin_url,
#                     "enrichEmail": True,
#                     "enrichPhone": True,
#                 }],
#                 name="Single Person Enrichment"
#             )

#             enrichment_id = start_resp.get("data", {}).get("id")

#             if not enrichment_id:
#                 context["error"] = "Failed to start enrichment."
#                 return render(request, self.template_name, context)

#             # Poll for result
#             result = None
#             for _ in range(25):
#                 res = redrob_get_enrichment(enrichment_id)
#                 status = res.get("data", {}).get("status")

#                 if status == "FINISHED":
#                     result = res
#                     break

#                 time.sleep(2)

#             if not result:
#                 context["error"] = "Enrichment still processing. Please try again."
#                 return render(request, self.template_name, context)

#             datas = result.get("data", {}).get("datas", [])

#             if not datas:
#                 context["error"] = "No person data found."
#                 return render(request, self.template_name, context)

#             p = datas[0]
#             profile = p.get("profile", {})

#             person = {
#                 "first": p.get("firstname") or profile.get("firstname", ""),
#                 "last": p.get("lastname") or profile.get("lastname", ""),
#                 "linkedin": profile.get("linkedin_url", linkedin_url),
#                 "emails": p.get("emails", []),
#                 "phones": p.get("phones", [])
#             }

#             context["person"] = person

#         except requests.RequestException as e:
#             context["error"] = f"API request failed: {str(e)}"
#         except Exception as e:
#             context["error"] = f"Unexpected error: {str(e)}"

#         return render(request, self.template_name, context)

class SearchPeopleByLinkdinView(View):
    template_name = "generate_email/searchby_linkdin.html"

    def get(self, request, *args, **kwargs):
        people = request.session.pop("people", [])
        error = request.session.pop("error", None)
        limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)

        form = request.session.pop("form", {
            "linkedin_url": "",
        })
        

        return render(request, self.template_name, {
            "people": people,
            "error": error,
            "form": form,
            "search_limit": limit,
        })

    def post(self, request, *args, **kwargs):
        people = []
        error = None
        linkedin_url = request.POST.get("linkedin_url", "").strip()

        form = {
            "linkedin_url": linkedin_url,
        }

        payload = {
            "title": f"Search {linkedin_url}" if linkedin_url else "Search by LinkedIn URL",
            "linkedinUrl": linkedin_url,
        }

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"

        try:
            limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)
            if not limit.has_search_credits():
                if is_ajax:
                    return JsonResponse({"limit_reached": True, "error": "No search credits remaining.", "credits": limit.credits, "people": []})
                request.session["error"] = "No search credits remaining. Please buy search credits."
                request.session["form"] = form
                return redirect("search_by_linkdin")
            
            search_resp = redrob_search_by_linkedin_url(payload)
            raw_people = search_resp.get("data", [])

            if raw_people:
                limit.deduct_search(1)

            for p in raw_people:
                company_obj = p.get("company") or {}
                education_list = p.get("education") or []
                education_obj = education_list[0] if education_list else {}

                headquarter = company_obj.get("headquarter") or {}
                headquarter_address = headquarter.get("address") or {}

                company_headquarter = ", ".join(
                    filter(None, [
                        headquarter_address.get("city", ""),
                        headquarter_address.get("geographicArea", ""),
                        headquarter_address.get("country", ""),
                    ])
                )

                                # ── Experience ──
                def months_to_str(years_float):
                    if not years_float:
                        return ""
                    total_months = round(float(years_float) * 12)
                    y, m = divmod(total_months, 12)
                    parts = []
                    if y: parts.append(f"{y} year{'s' if y != 1 else ''}")
                    if m: parts.append(f"{m} month{'s' if m != 1 else ''}")
                    return " ".join(parts) if parts else "< 1 month"

                # ── Experience ── (sorted by orderInProfile: 1 = current/most recent)
                current_company_id = p.get("companyId")
                exp_raw = sorted(
                    (p.get("experience") or []),
                    key=lambda e: e.get("orderInProfile") or 999
                )

                def fmt_exp_date(raw):
                    """Turn '2024-05-01' → 'May 2024', pass plain years through."""
                    if not raw:
                        return ""
                    raw = str(raw).strip()
                    parts = raw.split("-")
                    if len(parts) == 3:
                        try:
                            
                            month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                            m = int(parts[1])
                            y = int(parts[0])
                            return f"{month_names[m]} {y}"
                        except Exception:
                            pass
                    return raw

                # Build company insights from the company object (current employer)
                def fmt_followers(n):
                    try:
                        n = int(n)
                        if n >= 1000:
                            return f"{n/1000:.1f}K"
                        return str(n)
                    except Exception:
                        return str(n) if n else "--"

                company_insights = {}
                if company_obj:
                    funding = company_obj.get("funding") or {}
                    company_insights = {
                        "logo":        company_obj.get("logoUrl", ""),
                        "size":        company_obj.get("size", "") or "--",
                        "industry":    company_obj.get("industry", "") or "--",
                        "revenue":     company_obj.get("revenue", "") or "--",
                        "specialties": company_obj.get("specialties") or [],
                        "founded":     company_obj.get("foundedAt", "") or "--",
                        "followers":   fmt_followers(company_obj.get("followers")),
                        "last_round":  funding.get("lastRoundDate") or "--",
                    }

                experiences = []
                for exp in exp_raw:
                    exp_company_id = exp.get("companyId")
                    experiences.append({
                        "title":            exp.get("title", ""),
                        "company":          exp.get("companyName", ""),
                        "company_url":      exp.get("companyUrl", ""),
                        "duration":         exp.get("duration", ""),
                        "location":         exp.get("location", ""),
                        "date_from":        fmt_exp_date(exp.get("dateFrom", "")),
                        "date_to":          fmt_exp_date(exp.get("dateTo", "")),
                        "description":      exp.get("description", ""),
                        # Attach full company insights only to the matching company
                        "company_insights": company_insights if exp_company_id == current_company_id else {},
                    })

                # ── Education ──
                all_education = []
                for edu in education_list:
                    all_education.append({
                        "title":     edu.get("title", ""),
                        "major":     edu.get("major", ""),
                        "date_from": edu.get("dateFrom", ""),
                        "date_to":   edu.get("dateTo", ""),
                    })

                # ── Skills ──
                skills_list = p.get("skillsArray") or p.get("skills") or []

                # ── Tenure ──
                total_exp  = p.get("totalExperienceDuration", "")
                avg_tenure = months_to_str(p.get("averageTenure", 0))
                cur_tenure = months_to_str(p.get("currentTenure", 0))

                # ── Rich JSON for drawer ──
                rich_json = json.dumps({
                    "experience":       experiences,
                    "education":        all_education,
                    "skills":           [str(s) for s in skills_list if s],
                    "total_experience": total_exp,
                    "avg_tenure":       avg_tenure,
                    "cur_tenure":       cur_tenure,
                    "headline":         p.get("headline", "") or p.get("generatedHeadline", ""),
                    "department":       p.get("department", ""),
                    "photo":            p.get("pictureUrl", "") or p.get("profilePic", ""),
                }, ensure_ascii=False)

                people.append({
                    "first": (p.get("nameFirst") or "").strip(),
                    "last": (p.get("nameLast") or "").strip(),
                    "linkedin": p.get("linkedinUrl", ""),
                    "company": company_obj.get("name", ""),
                    "job_title": (p.get("jobTitle") or "").strip(),
                    "institution": education_obj.get("title", ""),
                    "location": p.get("locationRawAddress", ""),
                    "company_headquarter": company_headquarter,
                    "photo":               p.get("pictureUrl", "") or p.get("profilePic", ""),
                    "rich_json":           rich_json,
                    # ── Rich fields for server-side HTML rendering ──
                    "experience":          experiences,
                    "all_education":       all_education,
                    "skills_list":         [str(s) for s in skills_list if s],
                    "total_experience":    total_exp,
                    "avg_tenure":          avg_tenure,
                    "cur_tenure":          cur_tenure,
                    "headline":            p.get("headline", "") or p.get("generatedHeadline", ""),
                    "department":          p.get("department", ""),

                    "emails": [],
                    "phones": [],
                })

            if not raw_people:
                error = "No person found for this LinkedIn URL."

        except requests.HTTPError as e:
            error = f"API error {e.response.status_code}: {e.response.text}"
        except Exception as e:
            error = f"Server error: {str(e)}"

        # ── Save search history ──
        try:
            filters_snapshot = {"linkedin_url": linkedin_url} if linkedin_url else {}

            people_snapshot = [{
                    "first":               p.get("first", ""),
                    "last":                p.get("last", ""),
                    "job_title":           p.get("job_title", ""),
                    "company":             p.get("company", ""),
                    "company_website":     p.get("company_website", ""),
                    "location":            p.get("location", ""),
                    "company_headquarter": p.get("company_headquarter", ""),
                    "linkedin":            p.get("linkedin", ""),
                    "photo":               p.get("photo", ""),
                    "email":               p.get("emails", [{}])[0].get("email", "") if p.get("emails") else "",
                    "phone":               p.get("phones", [{}])[0].get("number", "") if p.get("phones") else "",
                    "institution":         p.get("institution", ""),
                    "department":          p.get("department", ""),
                    "experience":          p.get("experience", []),
                    "all_education":       p.get("all_education", []),
                    "skills_list":         p.get("skills_list", []),
                    "total_experience":    p.get("total_experience", ""),
                    "avg_tenure":          p.get("avg_tenure", ""),
                    "cur_tenure":          p.get("cur_tenure", ""),
                } for p in people]

            SearchHistory.objects.create(
                user=request.user,
                search_type="linkedin",
                filters=filters_snapshot,
                results=people_snapshot,
                result_count=len(people),
            )

            GlobalSearchLog.objects.create(
                user=request.user,
                search_type="linkedin",
                filters=filters_snapshot,
                results=people_snapshot,
                result_count=len(people),
            )

        except Exception:
            pass

        # ── AJAX: return JSON instead of redirecting ──
        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        if is_ajax:
            limit.refresh_from_db()
            return JsonResponse({
                "people": people,
                "error": error or "",
                "credits": limit.credits,
                "search_credits": limit.search_credits,
            })

        request.session["people"] = people
        request.session["error"] = error
        request.session["form"] = form
        return redirect("search_by_linkdin")

class SearchPeopleView(View):
    template_name = "generate_email/search_people.html"

    def get(self, request, *args, **kwargs):
        people = request.session.pop("people", [])
        error = request.session.pop("error", None)
        pagination = request.session.pop("pagination", {})
        limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)

        form = request.session.pop("form", {
            "name": "",
            "company": "",
            "job_title": "",
            "seniority": "",
            "skills": "",
            "degree": "",
            "institution": "",
            "location": "",
            "industry": "",
            "min_experience": "",
            "max_experience": "",
            "is_decision_maker": "",
            "specialites": "",
        })
        return render(request, self.template_name, {
            "people": people,
            "error": error,
            "form": form,
            "pagination": pagination,
            "search_limit": limit,
        })

    def post(self, request, *args, **kwargs):
        people = []
        error = None
        pagination = {}

        def to_list(value):
            return [v.strip() for v in value.split(",") if v.strip()]

        name = request.POST.get("name", "").strip()
        company = request.POST.get("company", "").strip()
        job_title = request.POST.get("job_title", "").strip()
        seniority = request.POST.get("seniority", "").strip()
        skills = request.POST.get("skills", "").strip()
        degree = request.POST.get("degree", "").strip()
        institution = request.POST.get("institution", "").strip()
        location = request.POST.get("location", "").strip()
        industry = request.POST.get("industry", "").strip()
        min_experience = request.POST.get("min_experience", "").strip()
        max_experience = request.POST.get("max_experience", "").strip()
        specialites = request.POST.get("specialites", "").strip()
        is_decision_maker = "1" if request.POST.get("is_decision_maker") else ""

        page = request.POST.get("page", "1")

        form = {
            "name": name,
            "company": company,
            "job_title": job_title,
            "seniority": seniority,
            "skills": skills,
            "degree": degree,
            "institution": institution,
            "location": location,
            "industry": industry,
            "min_experience": min_experience,
            "max_experience": max_experience,
            "is_decision_maker": is_decision_maker,
            "specialites": specialites,
        }

        # print(name)
        # print(company)
        # print(location)


        # payload = {
        #     "title": "Search for people by filters",
        #     "name": [name] if name else [],
        #     "company": [company] if company else [],
        #     "job_title": [job_title] if job_title else [],
        #     "seniority": [seniority] if seniority else [],
        #     "skills": [skills] if skills else [],
        #     "degree": [degree] if degree else [],
        #     "institution": [institution] if institution else [],
        #     "location": [location] if location else [],
        #     "industry": [industry] if industry else [],
        #     "specialties": [specialites] if specialites else [],
        #     "is_decision_maker": int(is_decision_maker) if is_decision_maker else None,
        #     "min_years_of_experience": int(min_experience) if min_experience.isdigit() else None,
        #     "max_years_of_experience": int(max_experience) if max_experience.isdigit() else None,
        #     "page": 1,
        # }


        payload = {
                "title": "Search for people by filters",
                "name": to_list(name),
                "company": to_list(company),
                "job_title": to_list(job_title),
                "seniority": to_list(seniority),
                "skills": to_list(skills),
                "degree": to_list(degree),
                "institution": to_list(institution),
                "location": to_list(location),
                "industry": to_list(industry),
                "specialties": to_list(specialites),
                # "is_decision_maker": int(is_decision_maker) if is_decision_maker else None,
                "is_decision_maker": True if is_decision_maker else None,
                "min_years_of_experience": int(min_experience) if min_experience.isdigit() else None,
                "max_years_of_experience": int(max_experience) if max_experience.isdigit() else None,
                "page": int(page),
            }
        

        # payload = {k: v for k, v in payload.items() if v not in ([], "", None)}

        payload = {k: v for k, v in payload.items() if v not in ([], "", None) or isinstance(v, bool)}


        print(f"🔍 Search payload: {payload}")

        try:
            # Check if user has search credits
            limit = UserSearchLimit.objects.get(user=request.user)
            if not limit.has_search_credits():
                error = "No search credits remaining. Please buy search credits."
                is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
                if is_ajax:
                    return JsonResponse({
                        "success": False,
                        "error": error,
                        "limit_reached": True,
                        "search_credits": 0,
                        "credits": limit.credits,
                    })
                request.session["error"] = error
                return redirect("search_people")
            
            search_resp = redrob_search_people(payload)
            print(f"🔍 API Response received: {type(search_resp)}")
            print(f"Response keys: {search_resp.keys() if isinstance(search_resp, dict) else 'Not a dict'}")

            data = search_resp.get("data", {})
            raw_people = search_resp.get("data", {}).get("people", [])

            print(f"🔍 People returned: {len(raw_people)}, Seniority sent: {payload.get('seniority')}")

            
            # Deduct 1 search credit on successful search
            # limit.deduct_search(1)
            if request.POST.get("ai_search") != "1":
                limit.deduct_search(1)
            metadata = data.get("metadata", {})

            pagination = {
                "current": metadata.get("currentPage", 1),
                "next": metadata.get("nextPage"),
                "has_next": metadata.get("hasNext", False),
                "prev": metadata.get("prevPage"),
            }

            for p in raw_people:
                company_obj = p.get("company") or {}
                education_list = p.get("education") or []
                education_obj = education_list[0] if education_list else {}

                headquarter = company_obj.get("headquarter") or {}
                headquarter_address = headquarter.get("address") or {}

                company_headquarter = ", ".join(
                    filter(None, [
                        headquarter_address.get("city", ""),
                        headquarter_address.get("geographicArea", ""),
                        headquarter_address.get("country", ""),
                    ])
                )

                # ── Experience ──
                def months_to_str(years_float):
                    if not years_float:
                        return ""
                    total_months = round(float(years_float) * 12)
                    y, m = divmod(total_months, 12)
                    parts = []
                    if y: parts.append(f"{y} year{'s' if y != 1 else ''}")
                    if m: parts.append(f"{m} month{'s' if m != 1 else ''}")
                    return " ".join(parts) if parts else "< 1 month"

                # ── Experience ── (sorted by orderInProfile: 1 = current/most recent)
                current_company_id = p.get("companyId")
                exp_raw = sorted(
                    (p.get("experience") or []),
                    key=lambda e: e.get("orderInProfile") or 999
                )

                def fmt_exp_date(raw):
                    """Turn '2024-05-01' → 'May 2024', pass plain years through."""
                    if not raw:
                        return ""
                    raw = str(raw).strip()
                    parts = raw.split("-")
                    if len(parts) == 3:
                        try:
                            
                            month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                            m = int(parts[1])
                            y = int(parts[0])
                            return f"{month_names[m]} {y}"
                        except Exception:
                            pass
                    return raw

                # Build company insights from the company object (current employer)
                def fmt_followers(n):
                    try:
                        n = int(n)
                        if n >= 1000:
                            return f"{n/1000:.1f}K"
                        return str(n)
                    except Exception:
                        return str(n) if n else "--"

                company_insights = {}
                if company_obj:
                    funding = company_obj.get("funding") or {}
                    company_insights = {
                        "logo":        company_obj.get("logoUrl", ""),
                        "size":        company_obj.get("size", "") or "--",
                        "industry":    company_obj.get("industry", "") or "--",
                        "revenue":     company_obj.get("revenue", "") or "--",
                        "specialties": company_obj.get("specialties") or [],
                        "founded":     company_obj.get("foundedAt", "") or "--",
                        "followers":   fmt_followers(company_obj.get("followers")),
                        "last_round":  funding.get("lastRoundDate") or "--",
                    }

                experiences = []
                for exp in exp_raw:
                    exp_company_id = exp.get("companyId")
                    experiences.append({
                        "title":            exp.get("title", ""),
                        "company":          exp.get("companyName", ""),
                        "company_url":      exp.get("companyUrl", ""),
                        "duration":         exp.get("duration", ""),
                        "location":         exp.get("location", ""),
                        "date_from":        fmt_exp_date(exp.get("dateFrom", "")),
                        "date_to":          fmt_exp_date(exp.get("dateTo", "")),
                        "description":      exp.get("description", ""),
                        # Attach full company insights only to the matching company
                        "company_insights": company_insights if exp_company_id == current_company_id else {},
                    })

                # ── Education ──
                all_education = []
                for edu in education_list:
                    all_education.append({
                        "title":     edu.get("title", ""),
                        "major":     edu.get("major", ""),
                        "date_from": edu.get("dateFrom", ""),
                        "date_to":   edu.get("dateTo", ""),
                    })

                # ── Skills ──
                skills_list = p.get("skillsArray") or p.get("skills") or []

                # ── Tenure ──
                total_exp  = p.get("totalExperienceDuration", "")
                avg_tenure = months_to_str(p.get("averageTenure", 0))
                cur_tenure = months_to_str(p.get("currentTenure", 0))

                # ── Rich JSON for drawer ──
                rich_json = json.dumps({
                    "experience":       experiences,
                    "education":        all_education,
                    "skills":           [str(s) for s in skills_list if s],
                    "total_experience": total_exp,
                    "avg_tenure":       avg_tenure,
                    "cur_tenure":       cur_tenure,
                    "headline":         p.get("headline", "") or p.get("generatedHeadline", ""),
                    "department":       p.get("department", ""),
                    "photo":            p.get("pictureUrl", "") or p.get("profilePic", ""),
                }, ensure_ascii=False)

                people.append({
                    "first":               (p.get("nameFirst") or "").strip(),
                    "last":                (p.get("nameLast") or "").strip(),
                    "linkedin":            p.get("linkedinUrl", ""),
                    "company":             company_obj.get("name", ""),
                    "job_title":           (p.get("jobTitle") or "").strip(),
                    "company_website":     company_obj.get("website", ""),
                    "institution":         education_obj.get("title", ""),
                    "location":            p.get("locationRawAddress", ""),
                    "company_headquarter": company_headquarter,
                    "photo":               p.get("pictureUrl", "") or p.get("profilePic", ""),
                    "rich_json":           rich_json,
                    # ── Rich fields for server-side HTML rendering ──
                    "experience":          experiences,
                    "all_education":       all_education,
                    "skills_list":         [str(s) for s in skills_list if s],
                    "total_experience":    total_exp,
                    "avg_tenure":          avg_tenure,
                    "cur_tenure":          cur_tenure,
                    "headline":            p.get("headline", "") or p.get("generatedHeadline", ""),
                    "department":          p.get("department", ""),
                    "emails": [],
                    "phones": [],
                })

        except requests.HTTPError as e:
            print(f"❌ API HTTPError {e.response.status_code}:")
            print(f"Response: {e.response.text}")
            error = f"API error {e.response.status_code}: {e.response.text}"
        except requests.RequestException as e:
            print(f"❌ API RequestException: {str(e)}")
            error = f"API request error: {str(e)}"
        except Exception as e:
            print(f"❌ Unexpected error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            error = f"Server error: {str(e)}"

        # ── Save search history ──
        try:
            filters_snapshot = {k: v for k, v in {
                "name": name, "company": company, "job_title": job_title,
                "seniority": seniority, "skills": skills, "degree": degree,
                "institution": institution, "location": location,
                "industry": industry, "specialites": specialites,
                "min_experience": min_experience, "max_experience": max_experience,
                "is_decision_maker": is_decision_maker,
            }.items() if v}

            people_snapshot = [{
                    "first":               p.get("first", ""),
                    "last":                p.get("last", ""),
                    "job_title":           p.get("job_title", ""),
                    "company":             p.get("company", ""),
                    "company_website":     p.get("company_website", ""),
                    "location":            p.get("location", ""),
                    "company_headquarter": p.get("company_headquarter", ""),
                    "linkedin":            p.get("linkedin", ""),
                    "photo":               p.get("photo", ""),
                    "email":               p.get("emails", [{}])[0].get("email", "") if p.get("emails") else "",
                    "phone":               p.get("phones", [{}])[0].get("number", "") if p.get("phones") else "",
                    "institution":         p.get("institution", ""),
                    "department":          p.get("department", ""),
                    "experience":          p.get("experience", []),
                    "all_education":       p.get("all_education", []),
                    "skills_list":         p.get("skills_list", []),
                    "total_experience":    p.get("total_experience", ""),
                    "avg_tenure":          p.get("avg_tenure", ""),
                    "cur_tenure":          p.get("cur_tenure", ""),
                } for p in people]

            SearchHistory.objects.create(
                user=request.user,
                search_type="people",
                filters=filters_snapshot,
                results=people_snapshot,
                result_count=len(people),
            )

            GlobalSearchLog.objects.create(
                user=request.user,
                search_type="people",
                filters=filters_snapshot,
                results=people_snapshot,
                result_count=len(people),
            )

        except Exception:
            pass

        # ── AJAX request → return JSON (no page reload) ──
        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        if is_ajax:
            limit_obj, _ = UserSearchLimit.objects.get_or_create(user=request.user)
            return JsonResponse({
                "success":        error is None,
                "error":          error,
                "people":         people,
                "pagination":     pagination,
                "search_credits": limit_obj.search_credits,
                "credits":        limit_obj.credits,
            })

        # ── Fallback: traditional POST-redirect-GET ──
        request.session["people"] = people
        request.session["error"] = error
        request.session["form"] = form
        request.session["pagination"] = pagination
        return redirect("search_people")

# -----------working -----------------
# class EnrichPersonView(View):
#     def post(self, request, *args, **kwargs):
#         linkedin_url = request.POST.get("linkedin_url", "").strip()
#         first = request.POST.get("first", "").strip()
#         last = request.POST.get("last", "").strip()
#         company = request.POST.get("company", "").strip()
#         company_website = request.POST.get("company_website", "").strip()
#         job_title = request.POST.get("job_title", "").strip()
#         institution = request.POST.get("institution", "").strip()
#         location = request.POST.get("location", "").strip()
#         company_headquarter = request.POST.get("company_headquarter", "").strip()
#         enrich_type = request.POST.get("enrich_type", "email").strip()

#         if not linkedin_url:
#             return JsonResponse({
#                 "success": False,
#                 "error": "LinkedIn URL is required."
#             }, status=400)
        
#         credit_cost = 1 if enrich_type == "email" else 3
#         limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)

#         if not limit.has_credits():
#             return JsonResponse({
#                 "success":        False,
#                 "limit_reached":  True,
#                 "credits":        0,
#                 "error":          "Your search credits are exhausted. Please contact admin to renew."
#             }, status=403)

#         if limit.credits < credit_cost:
#             return JsonResponse({
#                 "success":        False,
#                 "limit_reached":  True,
#                 "credits":        limit.credits,
#                 "error":          f"You need {credit_cost} credits for this action but only have {limit.credits}."
#             }, status=403)

#         enrich_email = enrich_type == "email"
#         enrich_phone = enrich_type == "phone"

#         try:
#             start_resp = redrob_start_bulk_enrichment(
#                 data=[{
#                     "linkedinUrl": linkedin_url,
#                     "enrichEmail": enrich_email,
#                     "enrichPhone": enrich_phone,
#                 }],
#                 name="Single Person Enrichment"
#             )

#             enrichment_id = start_resp.get("data", {}).get("id")

#             if not enrichment_id:
#                 return JsonResponse({
#                     "success": True,
#                     "person": {
#                         "first": first,
#                         "last": last,
#                         "linkedin": linkedin_url,
#                         "company": company,
#                         "company_website": company_website,
#                         "job_title": job_title,
#                         "institution": institution,
#                         "location": location,
#                         "company_headquarter": company_headquarter,
#                         "emails": [],
#                         "phones": [],
#                         "pending_enrichment": True
#                     }
#                 })

#             enrichment_result = None
#             item = {}

#             for _ in range(25):
#                 enrichment_resp = redrob_get_enrichment(enrichment_id)
#                 data = enrichment_resp.get("data", {}) or {}
#                 status = data.get("status", "")
#                 datas = data.get("datas", []) or []

#                 if status == "FINISHED":
#                     if datas:
#                         item = datas[0] or {}
#                         enrichment_result = enrichment_resp
#                         break
#                 elif status in {"FAILED", "ERROR", "CANCELLED"}:
#                     return JsonResponse({
#                         "success": False,
#                         "error": f"Enrichment failed with status: {status}"
#                     }, status=500)

#                 time.sleep(2)

#             if not enrichment_result:
#                 return JsonResponse({
#                     "success": True,
#                     "person": {
#                         "first": first,
#                         "last": last,
#                         "linkedin": linkedin_url,
#                         "company": company,
#                         "company_website": company_website,
#                         "job_title": job_title,
#                         "institution": institution,
#                         "location": location,
#                         "company_headquarter": company_headquarter,
#                         "emails": [],
#                         "phones": [],
#                         "pending_enrichment": True
#                     }
#                 })
            
#             # ── Update SearchHistory if this person exists in the last search ──
#             try:
#                 from .models import SearchHistory
#                 last_history = SearchHistory.objects.filter(
#                     user=request.user,
#                     search_type__in=["people", "linkedin"]
#                 ).order_by("-created_at").first()

#                 if last_history and last_history.results:
#                     updated = False
#                     for r in last_history.results:
#                         if r.get("linkedin", "").strip().lower() == linkedin_url.strip().lower():
#                             if enrich_email and item.get("emails"):
#                                 emails = item.get("emails", [])
#                                 first_email = emails[0].get("email", "") if isinstance(emails[0], dict) else str(emails[0])
#                                 if first_email:
#                                     r["email"] = first_email
#                                     updated = True
#                             if enrich_phone and item.get("phones"):
#                                 phones = item.get("phones", [])
#                                 first_phone = phones[0].get("number", "") if isinstance(phones[0], dict) else str(phones[0])
#                                 if first_phone:
#                                     r["phone"] = first_phone
#                                     updated = True
#                             break

#                     if updated:
#                         last_history.results = last_history.results  # trigger save
#                         SearchHistory.objects.filter(id=last_history.id).update(
#                             results=last_history.results
#                         )
#             except Exception:
#                 pass

#             try:
#                 from .models import GlobalSearchLog
#                 last_log = GlobalSearchLog.objects.filter(
#                     user=request.user,
#                     search_type__in=["people", "linkedin"]
#                 ).order_by("-created_at").first()

#                 if last_log and last_log.results:
#                     for r in last_log.results:
#                         if r.get("linkedin", "").strip().lower() == linkedin_url.strip().lower():
#                             if enrich_email and item.get("emails"):
#                                 emails = item.get("emails", [])
#                                 fe = emails[0].get("email", "") if isinstance(emails[0], dict) else str(emails[0])
#                                 if fe: r["email"] = fe
#                             if enrich_phone and item.get("phones"):
#                                 phones = item.get("phones", [])
#                                 fp = phones[0].get("number", "") if isinstance(phones[0], dict) else str(phones[0])
#                                 if fp: r["phone"] = fp
#                             break
#                     GlobalSearchLog.objects.filter(id=last_log.id).update(results=last_log.results)
#             except Exception:
#                 pass

#             limit.deduct(credit_cost)

#             return JsonResponse({
#                 "success": True,
#                 "credits": limit.credits,
#                 "person": {
#                     "first": first,
#                     "last": last,
#                     "linkedin": linkedin_url,
#                     "company": company,
#                     "company_website": company_website,
#                     "job_title": job_title,
#                     "institution": institution,
#                     "location": location,
#                     "company_headquarter": company_headquarter,
#                     "emails": item.get("emails", []) or [],
#                     "phones": item.get("phones", []) or [],
#                     "pending_enrichment": False
#                 }
#             })

#         except Exception as e:
#             return JsonResponse({
#                 "success": False,
#                 "error": f"Server error: {str(e)}"
#             }, status=500)

import uuid
class EnrichPersonView(View):

    def post(self, request):
        

        linkedin_url = request.POST.get("linkedin_url", "").strip()
        if not linkedin_url:
            return JsonResponse({"success": False, "error": "LinkedIn URL is required"}, status=400)

        # Person context fields
        first = request.POST.get("first", "")
        last = request.POST.get("last", "")
        company = request.POST.get("company", "")
        job_title = request.POST.get("job_title", "")
        institution = request.POST.get("institution", "")
        location = request.POST.get("location", "")
        company_headquarter = request.POST.get("company_headquarter", "")
        company_website = request.POST.get("company_website", "")
        enrich_type = request.POST.get("enrich_type", "email").strip()

        print("[EnrichPersonView] LinkedIn URL:", linkedin_url)

        # STEP 1: Create DB record
        request_id = uuid.uuid4()
        EnrichmentRequest.objects.create(
            user=request.user,
            request_id=request_id,
            linkedin=linkedin_url,
            status="PENDING",
            enrich_type=enrich_type,
        )

        webhook_url = os.environ.get("REDROB_WEBHOOK_URL", "").strip() or None
        print("[EnrichPersonView] Webhook URL:", webhook_url)

        enrich_type = request.POST.get("enrich_type", "email").strip()
        enrich_email = enrich_type == "email"
        enrich_phone = enrich_type == "phone"

        # STEP 3: Start enrichment on Redrob
        try:

            start_resp = redrob_start_bulk_enrichment(
                name="Single Person Enrichment",
                webhookUrl=webhook_url,
                data=[{
                    "linkedinUrl": linkedin_url,
                    "enrichEmail": enrich_email,
                    "enrichPhone": enrich_phone,
                    "customFields": {
                        "request_id": str(request_id),
                        "enrich_type": enrich_type,
                    }
                }]
            )
        except Exception as e:
            print("[EnrichPersonView] Enrichment start failed:", e)
            return JsonResponse({"success": False, "error": f"Failed to start enrichment: {e}"}, status=500)

        enrichment_id = (
            start_resp.get("data", {}).get("id")
            or start_resp.get("id")
        )

        if not enrichment_id:
            print("[EnrichPersonView] No enrichment_id from Redrob:", start_resp)
            return JsonResponse({"success": False, "error": "Could not start enrichment (no ID returned)."}, status=500)

        print(f"[EnrichPersonView] Enrichment started. ID={enrichment_id}, request_id={request_id}")

        # STEP 4: Return immediately — frontend will poll CheckEnrichmentView
        return JsonResponse({
            "success": True,
            "pending": True,
            "request_id": str(request_id),
            "person": {
                "first": first,
                "last": last,
                "linkedin": linkedin_url,
                "company": company,
                "company_website": company_website,
                "job_title": job_title,
                "institution": institution,
                "location": location,
                "company_headquarter": company_headquarter,
                "emails": [],
                "phones": [],
            },
        })


class CheckEnrichmentView(View):
    def get(self, request, request_id):
        # Use .first() instead of .get() to avoid DoesNotExist exception
        enrichment = EnrichmentRequest.objects.filter(
            request_id=request_id,
            user=request.user,
        ).first()

        if not enrichment:
            return JsonResponse({"success": False, "error": "Enrichment not found."}, status=404)

        if enrichment.status not in ("FINISHED", "FAILED", "ERROR"):
            return JsonResponse({"success": True, "pending": True, "status": enrichment.status})

        emails = enrichment.emails or []
        phones = enrichment.phones or []
        first_email = emails[0].get("email", "") if emails and isinstance(emails[0], dict) else (emails[0] if emails else "")
        first_phone = phones[0].get("number", "") if phones and isinstance(phones[0], dict) else (phones[0] if phones else "")

        # Deduct credits only once
        current_credits = None
        if not enrichment.credits_deducted and (first_email or first_phone):
            try:
                limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)
                # Email enrichment: 1 credit, Phone/Contact enrichment: 3 credits
                credit_cost = 1 if enrichment.enrich_type == "email" else 3
                if limit.has_credits():
                    limit.deduct(credit_cost)
                EnrichmentRequest.objects.filter(
                    request_id=request_id
                ).update(credits_deducted=True)
                current_credits = limit.credits
            except Exception:
                pass

        # Fetch credits if not already set (e.g. already deducted previously)
        if current_credits is None:
            try:
                limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)
                current_credits = limit.credits
            except Exception:
                pass

        # ── Update SearchHistory & GlobalSearchLog with the enriched email/phone ──
        if first_email or first_phone:
            try:
                norm_url = enrichment.linkedin.strip().lower().rstrip("/")

                def _patch_model(model_cls):
                    """Patch all recent records (up to 20) that contain this person."""
                    records = list(model_cls.objects.filter(
                        user=request.user,
                        search_type__in=["people", "linkedin"],
                    ).order_by("-created_at")[:20])
                    for record in records:
                        if not record.results:
                            continue
                        changed = False
                        for r in record.results:
                            r_url = r.get("linkedin", "").strip().lower().rstrip("/")
                            if r_url == norm_url:
                                if first_email:
                                    r["email"] = first_email
                                if first_phone:
                                    r["phone"] = first_phone
                                changed = True
                        if changed:
                            model_cls.objects.filter(id=record.id).update(
                                results=record.results
                            )

                _patch_model(SearchHistory)
                _patch_model(GlobalSearchLog)

            except Exception as _e:
                import traceback
                print("[CheckEnrichmentView] patch error:", _e)
                traceback.print_exc()

        return JsonResponse({
            "success": True,
            "pending": False,
            "status":  enrichment.status,
            "email":   first_email,
            "phone":   first_phone,
            "emails":  emails,
            "phones":  phones,
            "enrich_type": enrichment.enrich_type,
            "credits": current_credits,
        })

class SearchCompanyView(View):
    template_name = "generate_email/search_company.html"

    def get(self, request, *args, **kwargs):
        companies = request.session.pop("companies", [])
        error = request.session.pop("error", None)
        limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)

        form = request.session.pop("form", {
            "name": "",
            "company": "",
            "industry": "",
            "company_market": "",
            "company_location": "",
            "year_founded_min": "",
            "year_founded_max": "",
            "company_specialites": "",
            "employee_count": "",
            "min_revenue": "",
            "max_revenue": "",
            "company_technologies": "",
            "min_technology_count": "",
            "max_technology_count": "",
            "job_posts": "",
            "min_jobpost": "",
            "max_jobpost": "",
        })

        return render(request, self.template_name, {
            "companies": companies,
            "error": error,
            "form": form,
            "search_limit": limit,
        })

    def post(self, request, *args, **kwargs):
        companies = []
        error = None

        def to_list(value):
            return [v.strip() for v in value.split(",") if v.strip()]
    
        # Basic fields
        name = request.POST.get("name", "").strip()
        company = request.POST.get("company", "").strip()
        industry = request.POST.get("industry", "").strip()
        company_market = request.POST.get("company_market", "").strip()
        company_location = request.POST.get("company_location", "").strip()
        year_founded_min = request.POST.get("year_founded_min", "").strip()
        year_founded_max = request.POST.get("year_founded_max", "").strip()

        # Company lookalike section
        company_specialites = request.POST.get("company_specialites", "").strip()
        employee_count = request.POST.get("employee_count", "").strip()

        # Revenue
        min_revenue = request.POST.get("min_revenue", "").strip()
        max_revenue = request.POST.get("max_revenue", "").strip()

        # Hiring & tech signals
        company_technologies = request.POST.get("company_technologies", "").strip()
        min_technology_count = request.POST.get("min_technology_count", "").strip()
        max_technology_count = request.POST.get("max_technology_count", "").strip()
        job_posts = request.POST.get("job_posts", "").strip()
        min_jobpost = request.POST.get("min_jobpost", "").strip()
        max_jobpost = request.POST.get("max_jobpost", "").strip()

        form = {
            "name": name,
            "company": company,
            "industry": industry,
            "company_market": company_market,
            "company_location": company_location,
            "year_founded_min": year_founded_min,
            "year_founded_max": year_founded_max,
            "company_specialites": company_specialites,
            "employee_count": employee_count,
            "min_revenue": min_revenue,
            "max_revenue": max_revenue,
            "company_technologies": company_technologies,
            "min_technology_count": min_technology_count,
            "max_technology_count": max_technology_count,
            "job_posts": job_posts,
            "min_jobpost": min_jobpost,
            "max_jobpost": max_jobpost,
        }

        payload = {
            "title": "Search for companies by filters",
            "page": 1,
        }

        # keyword search
        # if name:
        #     payload["name"] = [name]

        # company name filter
        if company:
            payload["name"] = to_list(company)

        # industry
        if industry:
            payload["industries"] = to_list(industry)

        # market
        if company_market:
            payload["companyMarket"] = company_market

        # location
        if company_location:
            payload["location"] = to_list(company_location)

        # year founded
        if year_founded_min.isdigit():
            payload["yearFoundedMin"] = int(year_founded_min)

        if year_founded_max.isdigit():
            payload["yearFoundedMax"] = int(year_founded_max)

        # specialties
        if company_specialites:
            payload["specialties"] = to_list(company_specialites)


        # employee count
        if employee_count:
            payload["employeeCount"] = to_list(employee_count)

        # revenue
        if min_revenue.isdigit():
            payload["min_revenue"] = int(min_revenue)

        if max_revenue.isdigit():
            payload["max_revenue"] = int(max_revenue)

        # Hiring & Tech Signals
        hiring_and_tech_signals = {}

        if company_technologies:
            hiring_and_tech_signals["technologiesUsed"] = to_list(company_technologies)

        if min_technology_count.isdigit():
            hiring_and_tech_signals["technologyTotalCountMin"] = int(min_technology_count)

        if max_technology_count.isdigit():
            hiring_and_tech_signals["technologyTotalCountMax"] = int(max_technology_count)

        if job_posts:
            hiring_and_tech_signals["jobPosts"] = to_list(job_posts)

        if min_jobpost.isdigit():
            hiring_and_tech_signals["jobPostingCountMin"] = int(min_jobpost)

        if max_jobpost.isdigit():
            hiring_and_tech_signals["jobPostingCountMax"] = int(max_jobpost)

        if hiring_and_tech_signals:
            payload["hiringAndTechSignals"] = hiring_and_tech_signals

        payload = {k: v for k, v in payload.items() if v not in ([], "", None)}

        print(payload)
        # print(payload["name"])

        try:

            limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)
            is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
            if not limit.has_search_credits():
                if is_ajax:
                    return JsonResponse({"limit_reached": True, "error": "No search credits remaining.", "credits": limit.credits, "companies": []})
                request.session["error"] = "No search credits remaining. Please buy search credits."
                request.session["form"] = form
                return redirect("search_company")
            
            search_resp = redrob_search_by_company(payload)
            # print(search_resp)
            raw_companies = search_resp.get("data", {}).get("companies", [])

            if raw_companies:
                limit.deduct_search(1)
            # print(raw_companies)

            # print(raw_companies)

            for c in raw_companies:
                headquarter = c.get("headquarter") or {}
                headquarter_address = headquarter.get("address") or {}

                company_headquarter = ", ".join(
                    filter(None, [
                        headquarter_address.get("city", ""),
                        headquarter_address.get("geographic_area", ""),
                        headquarter_address.get("country", ""),
                    ])
                )

                funding = c.get("funding") or {}
                

                executives = c.get("keyExecutiveArrivals", [])
                decision_makers = [
                    {
                        "name": e.get("member_full_name"),
                        "title": e.get("member_position_title"),
                    }
                    for e in executives[:5]   # limit to 5
                ]

                # 🔥 NEW: Employee seniority breakdown
                seniority_data = c.get("employeesBySeniority", [])

                companies.append({
                    "name": c.get("name", ""),
                    "linkedin_url": c.get("linkedinUrl", ""),
                    "website": c.get("website", ""),
                    "industry": c.get("industry", ""),
                    "description": c.get("overview", ""),
                    "company_size": c.get("size", ""),
                    "revenue": c.get("revenue", ""),
                    "specialties": c.get("specialties", []),
                    "headquarter": company_headquarter,
                    "location_country": c.get("locationCountry", ""),
                    "company_market": "B2B" if c.get("isB2b") else "B2C" if c.get("isB2c") else "",
                    "found_at":c.get("foundedAt",""),
                    # "active_job_postings_count": c.get("activeJobPostingsCount", ""),
                    # "num_technologies_used": c.get("numTechnologiesUsed", ""),
                    # "funding_rounds": funding.get("roundsCount", ""),
                    # "last_funding_amount": funding.get("lastRoundMoneyRaisedAmount", ""),
                    # "last_funding_date": funding.get("lastRoundAnnouncedOnDate", ""),
                    # "phone": ", ".join(c.get("phone", [])) if c.get("phone") else "",
                    "logo_url": c.get("logoUrl", ""),
                    "tagline": c.get("tagline", ""),
                    "linkedin_followers": c.get("followers", ""),
                    "decision_makers": decision_makers,
                    "employee_seniority": seniority_data,
                })

        except requests.HTTPError as e:
            error = f"API error {e.response.status_code}: {e.response.text}"
        except Exception as e:
            error = f"Server error: {str(e)}"

        # ── Save search history ──
        try:
            filters_snapshot = {k: v for k, v in {
                "company": company, "industry": industry,
                "company_market": company_market,
                "company_location": company_location,
                "year_founded_min": year_founded_min,
                "year_founded_max": year_founded_max,
                "company_specialites": company_specialites,
                "employee_count": employee_count,
                "min_revenue": min_revenue, "max_revenue": max_revenue,
                "company_technologies": company_technologies,
            }.items() if v}

            company_snapshot = [{
                "name":             c.get("name", ""),
                "linkedin_url":     c.get("linkedin_url", ""),
                "website":          c.get("website", ""),
                "industry":         c.get("industry", ""),
                "description":      c.get("description", ""),
                "company_size":     c.get("company_size", ""),
                "headquarter":      c.get("headquarter", ""),
                "logo_url":         c.get("logo_url", ""),
                "tagline":          c.get("tagline", ""),
                "revenue":          c.get("revenue", ""),
                "linkedin_followers": c.get("linkedin_followers", ""),
                "found_at":         c.get("found_at", ""),
                "specialties":      c.get("specialties", []),
                "location_country": c.get("location_country", ""),
                "decision_makers":  c.get("decision_makers", []),
            } for c in companies]

            SearchHistory.objects.create(
                user=request.user,
                search_type="company",
                filters=filters_snapshot,
                results=company_snapshot,
                result_count=len(companies),
            )

            GlobalSearchLog.objects.create(
                user=request.user,
                search_type="company",
                filters=filters_snapshot,
                results=company_snapshot,
                result_count=len(companies),
            )

        except Exception:
            pass

        # ── AJAX: return JSON instead of redirecting ──
        if is_ajax:
            limit.refresh_from_db()
            return JsonResponse({
                "companies": companies,
                "error": error or "",
                "credits": limit.credits,
                "search_credits": limit.search_credits,
            })

        request.session["companies"] = companies
        request.session["error"] = error
        request.session["form"] = form
        return redirect("search_company")
        
# class GetSavedListsView(LoginRequiredMixin, View):
#     def get(self, request, *args, **kwargs):
#         lists = SavedPeopleList.objects.filter(user=request.user).values("id", "name")
#         return JsonResponse({
#             "success": True,
#             "lists": list(lists)
#         })

from django.db.models import Count

class GetSavedListsView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        lists = (
            SavedPeopleList.objects
            .filter(user=request.user)
            .annotate(count=Count("entries"))
            .values("id", "name", "count")
        )
        return JsonResponse({
            "success": True,
            "lists": list(lists)
        })


class SavePeopleToListView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body.decode("utf-8"))
            list_type = data.get("list_type")  # "new" or "existing"
            list_name = (data.get("list_name") or "").strip()
            list_id = data.get("list_id")
            people = data.get("people", [])

            if not people:
                return JsonResponse({
                    "success": False,
                    "error": "No people selected."
                }, status=400)

            if list_type == "new":
                if not list_name:
                    return JsonResponse({
                        "success": False,
                        "error": "List name is required."
                    }, status=400)

                saved_list, created = SavedPeopleList.objects.get_or_create(
                    user=request.user,
                    name=list_name
                )

            elif list_type == "existing":
                if not list_id:
                    return JsonResponse({
                        "success": False,
                        "error": "Please select an existing list."
                    }, status=400)

                try:
                    saved_list = SavedPeopleList.objects.get(id=list_id, user=request.user)
                except SavedPeopleList.DoesNotExist:
                    return JsonResponse({
                        "success": False,
                        "error": "List not found."
                    }, status=404)
            else:
                return JsonResponse({
                    "success": False,
                    "error": "Invalid list type."
                }, status=400)

            created_count = 0

            for person in people:
                obj, created = SavedPeopleEntry.objects.update_or_create(
                    saved_list=saved_list,
                    linkedin=person.get("linkedin", ""),
                    defaults={
                        "first": person.get("first", ""),
                        "last": person.get("last", ""),
                        "company": person.get("company", ""),
                        "company_website": person.get("company_website", ""),
                        "job_title": person.get("job_title", ""),
                        "institution": person.get("institution", ""),
                        "location": person.get("location", ""),
                        "company_headquarter": person.get("company_headquarter", ""),
                        "email": person.get("email", ""),
                        "phone":person.get("phone",""),
                    }
                )
                if created:
                    created_count += 1

            return JsonResponse({
                "success": True,
                "message": f"{created_count} people saved to '{saved_list.name}'.",
                "list_id": saved_list.id,
                "list_name": saved_list.name
            })

        except Exception as e:
            return JsonResponse({
                "success": False,
                "error": str(e)
            }, status=500)
        
# class EnrichSavedListView(LoginRequiredMixin, View):
#     MAX_POLLS = 30
#     POLL_INTERVAL_SECONDS = 3

#     def post(self, request, *args, **kwargs):
#         try:
#             body = json.loads(request.body.decode("utf-8"))
#             list_id = body.get("list_id")

#             if not list_id:
#                 return self.error_response("List ID is required.", 400)

#             try:
#                 saved_list = SavedPeopleList.objects.prefetch_related("entries").get(
#                     id=list_id,
#                     user=request.user
#                 )
#             except SavedPeopleList.DoesNotExist:
#                 return self.error_response("List not found.", 404)

#             entries = list(saved_list.entries.all())

#             if not entries:
#                 return self.error_response("This list is empty.", 400)

#             linkedin_to_entry, bulk_data = self.build_bulk_data(entries)

#             if not bulk_data:
#                 return JsonResponse({
#                     "success": True,
#                     "message": "All contacts in this list already have email or valid LinkedIn URL is missing.",
#                     "list_id": saved_list.id,
#                     "list_name": saved_list.name,
#                     "total_people": len(entries),
#                     "updated_count": 0,
#                 })
            
#             sl, _ = UserSearchLimit.objects.get_or_create(user=request.user)
#             people_to_enrich = len(bulk_data)
#             credit_cost      = people_to_enrich * 1

#             if sl.credits < credit_cost:
#                 return self.error_response(
#                     f"Need {credit_cost} credits to enrich {people_to_enrich} "
#                     f"people but you only have {sl.credits}. Contact admin to renew.",
#                     403
#                 )
#             # ══════════════════════════════════════════════


#             start_resp = redrob_start_bulk_enrichment(
#                 data=bulk_data,
#                 name=f"Bulk Email Enrichment - {saved_list.name}"
#             )

#             enrichment_id = (start_resp.get("data") or {}).get("id")
#             if not enrichment_id:
#                 return self.error_response("No enrichment ID returned from API.", 500)

#             enrichment_items = self.poll_enrichment_result(enrichment_id)
#             if isinstance(enrichment_items, JsonResponse):
#                 return enrichment_items

#             updated_count = self.update_entries_from_results(
#                 linkedin_to_entry=linkedin_to_entry,
#                 enrichment_items=enrichment_items
#             )


#             # ══════════════════════════════════════════════
#             # DEDUCT CREDITS — only for actually enriched
#             # ══════════════════════════════════════════════
#             if updated_count > 0:
#                 sl.deduct(updated_count)
#             # ══════════════════════════════════════════════

#             return JsonResponse({
#                 "success": True,
#                 "message": f"Enrichment completed. {updated_count} contacts updated.",
#                 "list_id": saved_list.id,
#                 "list_name": saved_list.name,
#                 "total_people": len(entries),
#                 "updated_count": updated_count,
#                 "credits":       sl.credits,
#             })

#         except requests.HTTPError as e:
#             status_code = e.response.status_code if e.response is not None else 500
#             response_text = e.response.text if e.response is not None else str(e)
#             return self.error_response(
#                 f"API error {status_code}: {response_text}",
#                 500
#             )
#         except Exception as e:
#             return self.error_response(f"Server error: {str(e)}", 500)

#     def build_bulk_data(self, entries):
#         linkedin_to_entry = {}
#         bulk_data = []

#         for entry in entries:
#             # skip already enriched people
#             if entry.email:
#                 continue

#             linkedin_raw = (entry.linkedin or "").strip()
#             linkedin_normalized = normalize_linkedin_url(linkedin_raw)

#             if not linkedin_raw:
#                 continue

#             linkedin_to_entry[linkedin_normalized] = entry
#             bulk_data.append({
#                 "linkedinUrl": linkedin_raw,
#                 "enrichEmail": True,
#                 "enrichPhone": False,
#             })

#         return linkedin_to_entry, bulk_data

#     def poll_enrichment_result(self, enrichment_id):
#         for _ in range(self.MAX_POLLS):
#             enrichment_resp = redrob_get_enrichment(enrichment_id)
#             data = enrichment_resp.get("data", {}) or {}
#             status = data.get("status", "")
#             items = data.get("datas", []) or []

#             if status == "FINISHED":
#                 return items

#             if status in {"FAILED", "ERROR", "CANCELLED"}:
#                 return self.error_response(
#                     f"Enrichment failed with status: {status}",
#                     500
#                 )

#             time.sleep(self.POLL_INTERVAL_SECONDS)

#         return self.error_response(
#             "Enrichment is still processing. Please try again later.",
#             500
#         )

#     def update_entries_from_results(self, linkedin_to_entry, enrichment_items):
#         updated_count = 0

#         for item in enrichment_items:
#             profile = item.get("profile", {}) or {}
#             linkedin_raw = (
#                 profile.get("linkedin_url")
#                 or item.get("linkedinUrl")
#                 or ""
#             )
#             linkedin_normalized = normalize_linkedin_url(linkedin_raw)

#             if not linkedin_normalized:
#                 continue

#             entry = linkedin_to_entry.get(linkedin_normalized)
#             if not entry:
#                 continue

#             first_email = self.extract_first_email(item.get("emails", []) or [])
#             first_phone = self.extract_first_phone(item.get("phones", []) or [])

#             changed_fields = []

#             if first_email and entry.email != first_email:
#                 entry.email = first_email
#                 changed_fields.append("email")

#             if first_phone and entry.phone != first_phone:
#                 entry.phone = first_phone
#                 changed_fields.append("phone")

#             if changed_fields:
#                 entry.save(update_fields=changed_fields)
#                 updated_count += 1

#         return updated_count

#     def extract_first_email(self, emails):
#         if not emails:
#             return ""

#         first_item = emails[0]
#         if isinstance(first_item, dict):
#             return first_item.get("email", "") or ""

#         return str(first_item)

#     def extract_first_phone(self, phones):
#         if not phones:
#             return ""

#         first_item = phones[0]
#         if isinstance(first_item, dict):
#             return first_item.get("number", "") or ""

#         return str(first_item)

#     def error_response(self, message, status_code=400):
#         return JsonResponse({
#             "success": False,
#             "error": message
#         }, status=status_code)


# class SaveEnrichAndGoToCampaignView(LoginRequiredMixin, View):
#     MAX_POLLS      = 40
#     POLL_INTERVAL  = 3

#     def post(self, request, *args, **kwargs):
#         try:
#             body      = json.loads(request.body.decode("utf-8"))
#             list_type = body.get("list_type")
#             list_name = (body.get("list_name") or "").strip()
#             list_id   = body.get("list_id")
#             people    = body.get("people", [])

#             if not people:
#                 return JsonResponse({"success": False, "error": "No people selected."}, status=400)

#             # ── 1. Save or get list ──────────────────────────────────────
#             if list_type == "new":
#                 if not list_name:
#                     return JsonResponse({"success": False, "error": "List name is required."}, status=400)
#                 saved_list, _ = SavedPeopleList.objects.get_or_create(
#                     user=request.user, name=list_name
#                 )
#             elif list_type == "existing":
#                 if not list_id:
#                     return JsonResponse({"success": False, "error": "Please select a list."}, status=400)
#                 try:
#                     saved_list = SavedPeopleList.objects.get(id=list_id, user=request.user)
#                 except SavedPeopleList.DoesNotExist:
#                     return JsonResponse({"success": False, "error": "List not found."}, status=404)
#             else:
#                 return JsonResponse({"success": False, "error": "Invalid list type."}, status=400)

#             # ── 2. Save entries ──────────────────────────────────────────
#             for person in people:
#                 SavedPeopleEntry.objects.update_or_create(
#                     saved_list=saved_list,
#                     linkedin=person.get("linkedin", ""),
#                     defaults={
#                         "first":               person.get("first", ""),
#                         "last":                person.get("last", ""),
#                         "company":             person.get("company", ""),
#                         "company_website":     person.get("company_website", ""),
#                         "job_title":           person.get("job_title", ""),
#                         "institution":         person.get("institution", ""),
#                         "location":            person.get("location", ""),
#                         "company_headquarter": person.get("company_headquarter", ""),
#                         "email":               person.get("email", ""),
#                         "phone":               person.get("phone", ""),
#                     }
#                 )

#             # ── 3. Bulk enrich (only entries missing email) ──────────────
#             entries           = list(saved_list.entries.all())
#             bulk_data         = []
#             linkedin_to_entry = {}

#             for entry in entries:
#                 if entry.email:
#                     continue
#                 linkedin_raw = (entry.linkedin or "").strip()
#                 if not linkedin_raw:
#                     continue
#                 norm = normalize_linkedin_url(linkedin_raw)
#                 linkedin_to_entry[norm] = entry
#                 bulk_data.append({
#                     "linkedinUrl": linkedin_raw,
#                     "enrichEmail": True,
#                     "enrichPhone": False,
#                 })

#             enriched_count = 0

#             if bulk_data:
#                 # ══════════════════════════════════════════════
#                 # CREDIT CHECK — each email costs 1 credit
#                 # ══════════════════════════════════════════════
#                 sl, _ = UserSearchLimit.objects.get_or_create(user=request.user)
#                 people_to_enrich = len(bulk_data)
#                 credit_cost      = people_to_enrich * 1

#                 if sl.credits < credit_cost:
#                     return JsonResponse({
#                         "success":       False,
#                         "limit_reached": True,
#                         "credits":       sl.credits,
#                         "needed":        credit_cost,
#                         "error":         f"Need {credit_cost} credits to enrich {people_to_enrich} people but you only have {sl.credits}. Contact admin to renew."
#                     }, status=403)
                
#                 start_resp = redrob_start_bulk_enrichment(
#                     data=bulk_data,
#                     name=f"Bulk Enrichment - {saved_list.name}"
#                 )
#                 enrichment_id = (start_resp.get("data") or {}).get("id")

#                 if enrichment_id:
#                     for _ in range(self.MAX_POLLS):
#                         resp = redrob_get_enrichment(enrichment_id)
#                         data = resp.get("data", {}) or {}
#                         status = data.get("status", "")
#                         items = data.get("datas", []) or []

#                         if status == "FINISHED":
#                             for item in items:
#                                 profile      = item.get("profile", {}) or {}
#                                 linkedin_raw = (
#                                     profile.get("linkedin_url")
#                                     or item.get("linkedinUrl", "")
#                                 )
#                                 norm  = normalize_linkedin_url(linkedin_raw)
#                                 entry = linkedin_to_entry.get(norm)
#                                 if not entry:
#                                     continue
#                                 emails = item.get("emails", []) or []
#                                 if emails:
#                                     first_item = emails[0]
#                                     email_val  = (
#                                         first_item.get("email", "")
#                                         if isinstance(first_item, dict)
#                                         else str(first_item)
#                                     )
#                                     if email_val and entry.email != email_val:
#                                         entry.email = email_val
#                                         entry.save(update_fields=["email"])
#                                         enriched_count += 1
#                             break

#                         if status in {"FAILED", "ERROR", "CANCELLED"}:
#                             break

#                         time.sleep(self.POLL_INTERVAL)

#                 # ══════════════════════════════════════════════
#                 # DEDUCT CREDITS — only for actually enriched
#                 # ══════════════════════════════════════════════
#                 if enriched_count > 0:
#                     sl.deduct(enriched_count)  # deduct only what was actually enriched
#                 # ══════════════════════════════════════════════
#             sl.refresh_from_db()
#             campaign_url = reverse("campaign_view") + f"?list_id={saved_list.id}"
#             return JsonResponse({
#                 "success":       True,
#                 "message":       f"'{saved_list.name}' saved. {enriched_count} emails enriched.",
#                 "redirect_url":  campaign_url,
#                 "list_id":       saved_list.id,
#                 "enriched_count": enriched_count,
#                 "credits":        sl.credits,
#             })

#         except Exception as e:
#             return JsonResponse({"success": False, "error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# EnrichSavedListView  — webhook-based
# ─────────────────────────────────────────────────────────────────────────────
 
class EnrichSavedListView(LoginRequiredMixin, View):
 
    def post(self, request, *args, **kwargs):
        try:
            body    = json.loads(request.body.decode("utf-8"))
            list_id = body.get("list_id")
        except Exception:
            return self._err("Invalid JSON.", 400)
 
        if not list_id:
            return self._err("List ID is required.", 400)
 
        try:
            saved_list = SavedPeopleList.objects.prefetch_related("entries").get(
                id=list_id, user=request.user
            )
        except SavedPeopleList.DoesNotExist:
            return self._err("List not found.", 404)
 
        entries = list(saved_list.entries.all())
        if not entries:
            return self._err("This list is empty.", 400)
 
        # ── Collect entries that still need enrichment ──────────────────────
        to_enrich = [e for e in entries if not e.email and (e.linkedin or "").strip()]
 
        if not to_enrich:
            return JsonResponse({
                "success":      True,
                "message":      "All contacts already have emails.",
                "list_id":      saved_list.id,
                "list_name":    saved_list.name,
                "total_people": len(entries),
                "pending":      False,
                "request_ids":  [],
            })
 
        # ── Credit check ────────────────────────────────────────────────────
        sl, _ = UserSearchLimit.objects.get_or_create(user=request.user)
        credit_cost = len(to_enrich)
 
        if sl.credits < credit_cost:
            return self._err(
                f"Need {credit_cost} credits for {len(to_enrich)} people "
                f"but you only have {sl.credits}. Contact admin to renew.",
                403,
            )
 
        webhook_url = _webhook_url()
        request_ids = []
        errors      = []
        bulk_data   = []
 
        for entry in to_enrich:
            req_id = uuid.uuid4()
 
            # Save DB record so the webhook can look it up
            EnrichmentRequest.objects.create(
                user        = request.user,
                request_id  = req_id,
                linkedin    = entry.linkedin.strip(),
                status      = "PENDING",
                enrich_type = "email",
            )

            bulk_data.append({
                "linkedinUrl": entry.linkedin.strip(),
                "enrichEmail": True,
                "enrichPhone": False,
                "customFields": {
                    "request_id":  str(req_id),
                    "enrich_type": "email",
                    "entry_id":    entry.pk,
                },
            })

            request_ids.append(str(req_id))

        try:
            redrob_start_bulk_enrichment(
                name       = f"List Enrichment – {saved_list.name}",
                webhookUrl = webhook_url,
                data       = bulk_data,   # ✅ ALL PEOPLE HERE
            )

        except Exception as exc:
            # Mark ALL as failed
            EnrichmentRequest.objects.filter(
                request_id__in=request_ids
            ).update(status="FAILED")

            return self._err(
                f"Failed to start enrichment: {str(exc)}",
                500
            )
            
 
        return JsonResponse({
            "success":      True,
            "pending":      True,
            "message":      (
                f"Enrichment started for {len(request_ids)} contacts."
                + (f" {len(errors)} failed to start." if errors else "")
            ),
            "list_id":      saved_list.id,
            "list_name":    saved_list.name,
            "total_people": len(entries),
            "request_ids":  request_ids,
            # total credits that WILL be deducted (deduction happens in webhook)
            "credit_cost":  len(request_ids),
        })
 
    @staticmethod
    def _err(msg, status=400):
        return JsonResponse({"success": False, "error": msg}, status=status)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# CheckBulkEnrichmentView  — frontend polls this to track list-level progress
# Accepts:
#   ?request_ids=uuid1,uuid2,...          (returned by EnrichSavedListView /
#                                          SaveEnrichAndGoToCampaignView)
#   ?linkedin_urls=url1,url2,...          (matches the linkedinUrl field in the
#                                          multi-URL bulk payload)
#   Both params may be combined; request_ids take priority when present.
# ─────────────────────────────────────────────────────────────────────────────

class CheckBulkEnrichmentView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):

        # ── 1. Parse inputs — mirrors the multi-LinkedIn-URL bulk payload ────
        raw_ids      = request.GET.get("request_ids", "")
        raw_linkedin = request.GET.get("linkedin_urls", "")

        request_ids   = [r.strip() for r in raw_ids.split(",")     if r.strip()]
        linkedin_urls = [u.strip() for u in raw_linkedin.split(",") if u.strip()]

        if not request_ids and not linkedin_urls:
            return JsonResponse(
                {"success": False, "error": "Provide request_ids or linkedin_urls."},
                status=400,
            )

        # ── 2. Build queryset — matching the linkedinUrl / request_id fields
        #       used in the bulk enrichment payload ──────────────────────────
        if request_ids:
            qs    = EnrichmentRequest.objects.filter(
                        request_id__in=request_ids,
                        user=request.user,
                    )
            total = len(request_ids)
        else:
            # linkedin_urls path — matches the `linkedinUrl` key of each
            # entry in the bulk_data payload from the enrich views
            qs    = EnrichmentRequest.objects.filter(
                        linkedin__in=linkedin_urls,
                        user=request.user,
                    )
            total = len(linkedin_urls)

        items      = []
        done_count = 0

        for er in qs:
            is_done = er.status in ("FINISHED", "FAILED", "ERROR")
            emails  = er.emails or []
            phones  = er.phones or []

            first_email = (
                emails[0].get("email", "") if emails and isinstance(emails[0], dict)
                else (emails[0] if emails else "")
            )
            first_phone = (
                phones[0].get("number", "") if phones and isinstance(phones[0], dict)
                else (phones[0] if phones else "")
            )

            # ── Write back to SavedPeopleEntry if not yet done ──────────────
            # (webhook logic)
            if is_done and not er.credits_deducted:
                if first_email or first_phone:
                    (SavedPeopleEntry.objects
                     .filter(
                         saved_list__user=request.user,
                         linkedin__iexact=er.linkedin,
                     )
                     .update(
                         **{k: v for k, v in {
                             "email": first_email or None,
                             "phone": first_phone or None,
                         }.items() if v}
                     ))

                    # Deduct 1 credit per successfully enriched person
                    try:
                        sl, _ = UserSearchLimit.objects.get_or_create(user=request.user)
                        sl.deduct(1)
                    except Exception:
                        pass

                EnrichmentRequest.objects.filter(request_id=er.request_id).update(
                    credits_deducted=True
                )
                
            if is_done:
                done_count += 1

            items.append({
                "request_id": str(er.request_id),
                "status":     er.status,
                "linkedin":   er.linkedin,     # echoes the linkedinUrl field
                "email":      first_email,
                "phone":      first_phone,
                "done":       is_done,
            })

        return JsonResponse({
            "success":  True,
            "total":    total,
            "done":     done_count,
            "all_done": done_count >= total,
            "items":    items,
        })
 
 
# ─────────────────────────────────────────────────────────────────────────────
# SaveEnrichAndGoToCampaignView  — webhook-based
# ─────────────────────────────────────────────────────────────────────────────
 
class SaveEnrichAndGoToCampaignView(LoginRequiredMixin, View):
 
    def post(self, request, *args, **kwargs):
        try:
            body      = json.loads(request.body.decode("utf-8"))
            list_type = body.get("list_type")
            list_name = (body.get("list_name") or "").strip()
            list_id   = body.get("list_id")
            people    = body.get("people", [])
        except Exception:
            return JsonResponse({"success": False, "error": "Invalid JSON."}, status=400)
 
        if not people:
            return JsonResponse({"success": False, "error": "No people selected."}, status=400)
 
        # ── 1. Resolve / create list ────────────────────────────────────────
        if list_type == "new":
            if not list_name:
                return JsonResponse({"success": False, "error": "List name is required."}, status=400)
            saved_list, _ = SavedPeopleList.objects.get_or_create(
                user=request.user, name=list_name
            )
        elif list_type == "existing":
            if not list_id:
                return JsonResponse({"success": False, "error": "Please select a list."}, status=400)
            try:
                saved_list = SavedPeopleList.objects.get(id=list_id, user=request.user)
            except SavedPeopleList.DoesNotExist:
                return JsonResponse({"success": False, "error": "List not found."}, status=404)
        else:
            return JsonResponse({"success": False, "error": "Invalid list type."}, status=400)
 
        # ── 2. Upsert people into the list ──────────────────────────────────
        for person in people:
            SavedPeopleEntry.objects.update_or_create(
                saved_list = saved_list,
                linkedin   = person.get("linkedin", ""),
                defaults   = {
                    "first":               person.get("first", ""),
                    "last":                person.get("last", ""),
                    "company":             person.get("company", ""),
                    "company_website":     person.get("company_website", ""),
                    "job_title":           person.get("job_title", ""),
                    "institution":         person.get("institution", ""),
                    "location":            person.get("location", ""),
                    "company_headquarter": person.get("company_headquarter", ""),
                    "email":               person.get("email", ""),
                    "phone":               person.get("phone", ""),
                },
            )
 
        # ── 3. Determine who still needs enrichment ─────────────────────────
        entries   = list(saved_list.entries.all())
        to_enrich = [e for e in entries if not e.email and (e.linkedin or "").strip()]
 
        campaign_url = reverse("campaign_view") + f"?list_id={saved_list.id}"
 
        # Nobody left to enrich → redirect straight away
        if not to_enrich:
            return JsonResponse({
                "success":       True,
                "pending":       False,
                "message":       f"'{saved_list.name}' saved. All contacts already have emails.",
                "redirect_url":  campaign_url,
                "list_id":       saved_list.id,
                "request_ids":   [],
            })
 
        # ── 4. Credit check ─────────────────────────────────────────────────
        sl, _ = UserSearchLimit.objects.get_or_create(user=request.user)
        credit_cost = len(to_enrich)
 
        if sl.credits < credit_cost:
            return JsonResponse({
                "success":       False,
                "limit_reached": True,
                "credits":       sl.credits,
                "needed":        credit_cost,
                "error":         (
                    f"Need {credit_cost} credits to enrich {len(to_enrich)} people "
                    f"but you only have {sl.credits}. Contact admin to renew."
                ),
            }, status=403)
 
        # ── 5. Fire enrichment jobs (one per person, webhook-based) ─────────
        webhook_url = _webhook_url()
        bulk_data = []
        request_ids = []
        errors      = []
 
        for entry in to_enrich:
            req_id = uuid.uuid4()
 
            EnrichmentRequest.objects.create(
                user        = request.user,
                request_id  = req_id,
                linkedin    = entry.linkedin.strip(),
                status      = "PENDING",
                enrich_type = "email",
            )

            bulk_data.append({
                "linkedinUrl": entry.linkedin.strip(),
                "enrichEmail": True,
                "enrichPhone": False,
                "customFields": {
                    "request_id": str(req_id),
                    "entry_id": entry.pk,
                },
            })

            request_ids.append(str(req_id))
 
        try:
            redrob_start_bulk_enrichment(
                name=f"Campaign Enrichment – {saved_list.name}",
                webhookUrl=webhook_url,
                data=bulk_data,
            )

        except Exception as exc:
            # mark ALL as failed
            EnrichmentRequest.objects.filter(
                request_id__in=request_ids
            ).update(status="FAILED")

            return JsonResponse({
                "success": False,
                "error": f"Failed to start enrichment: {str(exc)}"
            }, status=500)
    
        return JsonResponse({
            "success":      True,
            "pending":      True,
            "message":      (
                f"'{saved_list.name}' saved. Enriching {len(request_ids)} contacts…"
                + (f" {len(errors)} failed to start." if errors else "")
            ),
            "redirect_url": campaign_url,
            "list_id":      saved_list.id,
            "request_ids":  request_ids,
            "credit_cost":  len(request_ids),
        })
 
        
class ExportSavedListCsvView(LoginRequiredMixin, View):
    def get(self, request, list_id, *args, **kwargs):
        try:
            saved_list = SavedPeopleList.objects.get(id=list_id, user=request.user)
        except SavedPeopleList.DoesNotExist:
            return HttpResponse("List not found.", status=404)

        entries = saved_list.entries.all().order_by("id")

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{saved_list.name}_enriched.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "first",
            "last",
            "linkedin",
            "company",
            "company_website",
            "job_title",
            "institution",
            "location",
            "company_headquarter",
            "email",
            "phone",
        ])

        for entry in entries:
            writer.writerow([
                entry.first,
                entry.last,
                entry.linkedin,
                entry.company,
                entry.company_website,
                entry.job_title,
                entry.institution,
                entry.location,
                entry.company_headquarter,
                entry.email,
                entry.phone,
            ])

        return response


    
class DataEnrichmentView(LoginRequiredMixin, View):
    template_name = "generate_email/data_enrich.html"

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name)
    


class UseSavedListInCampaignView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        list_id = request.POST.get("list_id")

        if not list_id:
            messages.error(request, "Saved list is required.")
            return redirect("data_enrich")

        try:
            saved_list = SavedPeopleList.objects.prefetch_related("entries").get(
                id=list_id,
                user=request.user
            )
        except SavedPeopleList.DoesNotExist:
            messages.error(request, "Saved list not found.")
            return redirect("data_enrich")

        # Create or reuse tag with same name as saved list
        tag, _ = AudienceTag.objects.get_or_create(
            user=request.user,
            name=saved_list.name
        )

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for entry in saved_list.entries.all():
            email = (entry.email or "").strip()

            if not email:
                skipped_count += 1
                continue

            try:
                validate_email(email)
            except ValidationError:
                skipped_count += 1
                continue

            obj, created = TargetAudience.objects.get_or_create(
                user=request.user,
                email=email,
                tag=tag,
                defaults={
                    "receiver_first_name": entry.first or "",
                    "receiver_last_name": entry.last or "",
                    "receiver_linkedin_url": entry.linkedin or "",
                    "company_url": entry.company_website or "",
                }
            )

            if created:
                created_count += 1
            else:
                changed = False
                update_fields = []

                if entry.first and obj.receiver_first_name != entry.first:
                    obj.receiver_first_name = entry.first
                    update_fields.append("receiver_first_name")
                    changed = True

                if entry.last and obj.receiver_last_name != entry.last:
                    obj.receiver_last_name = entry.last
                    update_fields.append("receiver_last_name")
                    changed = True

                if entry.linkedin and obj.receiver_linkedin_url != entry.linkedin:
                    obj.receiver_linkedin_url = entry.linkedin
                    update_fields.append("receiver_linkedin_url")
                    changed = True

                if entry.company_website and obj.company_url != entry.company_website:
                    obj.company_url = entry.company_website
                    update_fields.append("company_url")
                    changed = True

                if changed:
                    obj.save(update_fields=update_fields)
                    updated_count += 1

        if created_count == 0 and updated_count == 0:
            messages.warning(
                request,
                f"No campaign-ready contacts found in '{saved_list.name}'. Please enrich emails first."
            )
            return redirect("data_enrich")

        messages.success(
            request,
            f"Saved list '{saved_list.name}' synced to campaign tag '{tag.name}'. "
            f"Added: {created_count}, Updated: {updated_count}, Skipped: {skipped_count}."
        )

        return redirect(f"{reverse('campaign_view')}?tag_id={tag.id}")

# class PeopleListView(LoginRequiredMixin, View):
#     template_name = "generate_email/list.html"

#     def get(self, request, *args, **kwargs):
#         lists = SavedPeopleList.objects.filter(user=request.user).prefetch_related("entries")
#         selected_list_id = request.GET.get("list_id")
#         search_query = request.GET.get("q", "").strip()

#         selected_list = None
#         selected_entries = []

#         if selected_list_id:
#             selected_list = get_object_or_404(
#                 SavedPeopleList.objects.prefetch_related("entries"),
#                 id=selected_list_id,
#                 user=request.user
#             )

#             entries_qs = selected_list.entries.all()

#             if search_query:
#                 entries_qs = entries_qs.filter(
#                     Q(first__icontains=search_query) |
#                     Q(last__icontains=search_query) |
#                     Q(company__icontains=search_query) |
#                     Q(job_title__icontains=search_query) |
#                     Q(email__icontains=search_query) |
#                     Q(phone__icontains=search_query) |
#                     Q(location__icontains=search_query) |
#                     Q(institution__icontains=search_query)
#                 )

#             selected_entries = entries_qs

#         context = {
#             "lists": lists,
#             "selected_list": selected_list,
#             "selected_entries": selected_entries,
#             "search_query": search_query,
#         }
#         return render(request, self.template_name, context)

class PeopleListView(LoginRequiredMixin, View):
    template_name = "generate_email/list.html"

    def get(self, request, *args, **kwargs):
        lists = SavedPeopleList.objects.filter(user=request.user).prefetch_related("entries", "company_entries")
        selected_list_id = request.GET.get("list_id")
        search_query = request.GET.get("q", "").strip()

        selected_list = None
        selected_entries = []
        selected_company_entries = []

        if selected_list_id:
            selected_list = get_object_or_404(
                SavedPeopleList.objects.prefetch_related("entries", "company_entries"),
                id=selected_list_id,
                user=request.user
            )

            people_qs = selected_list.entries.all()
            company_qs = selected_list.company_entries.all()

            if search_query:
                people_qs = people_qs.filter(
                    Q(first__icontains=search_query) |
                    Q(last__icontains=search_query) |
                    Q(company__icontains=search_query) |
                    Q(job_title__icontains=search_query) |
                    Q(email__icontains=search_query) |
                    Q(phone__icontains=search_query) |
                    Q(location__icontains=search_query) |
                    Q(institution__icontains=search_query)
                )

                company_qs = company_qs.filter(
                    Q(name__icontains=search_query) |
                    Q(industry__icontains=search_query) |
                    Q(domain__icontains=search_query) |
                    Q(revenue__icontains=search_query) |
                    Q(specialties__icontains=search_query) |
                    Q(headquarter__icontains=search_query) |
                    Q(location__icontains=search_query) |
                    Q(company_market__icontains=search_query)
                )

            selected_entries = people_qs
            selected_company_entries = company_qs

        context = {
            "lists": lists,
            "selected_list": selected_list,
            "selected_entries": selected_entries,
            "selected_company_entries": selected_company_entries,
            "search_query": search_query,
        }
        return render(request, self.template_name, context)
    
class SaveCompaniesToListView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body.decode("utf-8"))
            list_type = data.get("list_type")
            list_name = (data.get("list_name") or "").strip()
            list_id = data.get("list_id")
            companies = data.get("companies", [])

            if not companies:
                return JsonResponse({
                    "success": False,
                    "error": "No companies selected."
                }, status=400)

            if list_type == "new":
                if not list_name:
                    return JsonResponse({
                        "success": False,
                        "error": "List name is required."
                    }, status=400)

                saved_list, created = SavedPeopleList.objects.get_or_create(
                    user=request.user,
                    name=list_name
                )

            elif list_type == "existing":
                if not list_id:
                    return JsonResponse({
                        "success": False,
                        "error": "Please select an existing list."
                    }, status=400)

                try:
                    saved_list = SavedPeopleList.objects.get(id=list_id, user=request.user)
                except SavedPeopleList.DoesNotExist:
                    return JsonResponse({
                        "success": False,
                        "error": "List not found."
                    }, status=404)
            else:
                return JsonResponse({
                    "success": False,
                    "error": "Invalid list type."
                }, status=400)

            created_count = 0

            for company in companies:
                linkedin_url = (company.get("linkedin_url") or "").strip()
                website = (company.get("website") or "").strip()
                name = (company.get("name") or "").strip()

                lookup = {"saved_list": saved_list}
                if linkedin_url:
                    lookup["linkedin_url"] = linkedin_url
                elif website:
                    lookup["website"] = website
                else:
                    lookup["name"] = name

                obj, created = SavedCompanyEntry.objects.update_or_create(
                    **lookup,
                    defaults={
                        "name": name,
                        "linkedin_url": linkedin_url,
                        "website": website,
                        "industry": company.get("industry", ""),
                        "domain": company.get("domain", ""),
                        "revenue": company.get("revenue", ""),
                        "specialties": company.get("specialties", ""),
                        "headquarter": company.get("headquarter", ""),
                        "location": company.get("location", ""),
                        "company_market": company.get("company_market", ""),
                    }
                )

                if created:
                    created_count += 1

            return JsonResponse({
                "success": True,
                "message": f"{created_count} companies saved to '{saved_list.name}'.",
                "list_id": saved_list.id,
                "list_name": saved_list.name
            })

        except Exception as e:
            return JsonResponse({
                "success": False,
                "error": str(e)
            }, status=500)
        
class RemoveCompanyFromListView(LoginRequiredMixin, View):
    def post(self, request, list_id, company_id, *args, **kwargs):
        saved_list = get_object_or_404(SavedPeopleList, id=list_id, user=request.user)
        company = get_object_or_404(SavedCompanyEntry, id=company_id, saved_list=saved_list)
        company.delete()
        messages.success(request, "Company removed from list successfully.")
        return redirect(f"{reverse('list_view')}?list_id={saved_list.id}")

class DeleteSavedListView(LoginRequiredMixin, View):
    def post(self, request, list_id, *args, **kwargs):
        saved_list = get_object_or_404(SavedPeopleList, id=list_id, user=request.user)
        saved_list.delete()
        messages.success(request, "List deleted successfully.")
        return redirect("list_view")
    
class RemovePersonFromListView(LoginRequiredMixin, View):
    def post(self, request, list_id, entry_id, *args, **kwargs):
        saved_list = get_object_or_404(SavedPeopleList, id=list_id, user=request.user)
        entry = get_object_or_404(SavedPeopleEntry, id=entry_id, saved_list=saved_list)
        entry.delete()

        messages.success(request, "Person removed from list.")

        remaining_exists = saved_list.entries.exists()
        if remaining_exists:
            return redirect(f"{reverse('list_view')}?list_id={saved_list.id}")
        return redirect("list_view")

class DownloadListCSVView(LoginRequiredMixin, View):
    def get(self, request, list_id, *args, **kwargs):
        saved_list = get_object_or_404(SavedPeopleList, id=list_id, user=request.user)
        entries = saved_list.entries.all()

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{saved_list.name}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "First Name",
            "Last Name",
            "LinkedIn",
            "Company",
            "Company Website",
            "Job Title",
            "Institution",
            "Location",
            "Company Headquarter",
            "Email",
            "Phone",
        ])

        for item in entries:
            writer.writerow([
                item.first,
                item.last,
                item.linkedin,
                item.company,
                item.company_website,
                item.job_title,
                item.institution,
                item.location,
                item.company_headquarter,
                item.email,
                item.phone,
            ])

        return response


# class SelectPersonForEmailView(View):
#     def post(self, request, *args, **kwargs):
#         request.session["prefill_email_data"] = {
#             "receiver_first_name": request.POST.get("first", "").strip(),
#             "receiver_last_name": request.POST.get("last", "").strip(),
#             "email": request.POST.get("email", "").strip(),
#             "receiver_linkedin_url": request.POST.get("linkedin", "").strip(),
#             "company_url": request.POST.get("company_website", "").strip(),
#             "company_name": request.POST.get("company", "").strip(),
#         }
#         return redirect("generate_email")

class SelectPersonForEmailView(View):
    def post(self, request, *args, **kwargs):
        print("=== SelectPersonForEmailView POST ===")
        print(request.POST.dict())

        first = (request.POST.get("first") or request.POST.get("receiver_first_name") or "").strip()
        last = (request.POST.get("last") or request.POST.get("receiver_last_name") or "").strip()
        email = (request.POST.get("email") or "").strip()
        linkedin = (
            request.POST.get("linkedin")
            or request.POST.get("receiver_linkedin_url")
            or request.POST.get("linkedin_url")
            or ""
        ).strip()
        company_url = (
            request.POST.get("company_website")
            or request.POST.get("company_url")
            or ""
        ).strip()
        company = (request.POST.get("company") or "").strip()

        request.session["prefill_email_data"] = {
            "receiver_first_name": first,
            "receiver_last_name": last,
            "email": email,
            "receiver_linkedin_url": linkedin,
            "company_url": company_url,
            "company_name": company,
        }
        request.session.modified = True

        print("=== Saved in session ===")
        print(request.session["prefill_email_data"])

        return redirect("generate_email")

class SearchHistoryView(LoginRequiredMixin, View):
    template_name = "generate_email/search_history.html"

    def get(self, request, *args, **kwargs):
        search_type = request.GET.get("type", "")
        histories   = SearchHistory.objects.filter(user=request.user)
        if search_type:
            histories = histories.filter(search_type=search_type)

        limit, _ = UserSearchLimit.objects.get_or_create(user=request.user)
        return render(request, self.template_name, {
            "histories":   histories[:100],
            "search_type": search_type,
            "search_limit": limit,
        })

    def delete(self, request, *args, **kwargs):
        try:
            body = json.loads(request.body)
            history_id = body.get("history_id")
        except Exception:
            history_id = None

        if history_id:
            # Delete single
            deleted = SearchHistory.objects.filter(
                id=history_id, user=request.user
            ).delete()
            return JsonResponse({"success": True, "deleted": deleted[0]})
        else:
            # Clear all
            SearchHistory.objects.filter(user=request.user).delete()
            return JsonResponse({"success": True})
        
# Create your views here.
ORG_DOMAIN = "jmsadvisory.in"
EMAIL_SEND_LIMIT = 50
class GenerateEmailView(BlockDirectAccessMixin,LoginRequiredMixin, View):
    def normalize_url(self, url):
        """Ensure the URL starts with http:// or https://"""
        if url and not url.startswith(('http://', 'https://')):
            return f'https://{url.strip()}'
        return url.strip() if url else ''
    
    def format_signature(self, signature_obj, user):
        if not signature_obj or not signature_obj.signature:
            return ""
        raw_text= signature_obj.signature.strip()
        lines = [
            line.strip()
            for line in raw_text.splitlines()
            if line.strip()
        ]
        closing_phrases = {
            "best",
            "best regards",
            "kind regards",
            "regards",
            "thanks",
            "thank you",
            "sincerely"
        }
        if len(lines) == 1 and lines[0].lower().rstrip(',') in closing_phrases:
            lines[0] = lines[0].rstrip(',') + ","
            lines.extend([
                user.full_name,
                user.contact or "",
                user.company_name or ""
            ])
        html = (
            '<div style="margin:0;padding:0;line-height:1.4;">'
            + "<br>".join(lines)
            + "</div>"
        )
 
        if signature_obj.photo:
           photo_url = signature_obj.photo.url   
 
           html += f"""
                    <p>
                        <img src="{photo_url}"
                            alt="Signature Photo"
                            style="max-width:420px;margin-top:8px;width:100%;height:auto;display:block;">
                    </p>
                """
        return html
 
    def get(self, request):
         # Fetch the user's services for the dropdown
        user_services = ProductService.objects.filter(user=request.user).values_list('service_name', flat=True).distinct()
        user_attachments = EmailAttachment.objects.filter(user=request.user)
 
        signatures = Signature.objects.filter(user=request.user)
        google_accounts = SocialAccount.objects.filter(
            user=request.user,
            provider__in=["google", "microsoft"]
        )
        user = request.user
 
        total_sent = SentEmail.objects.filter(user=user).count()
 
        read_emails = SentEmail.objects.filter(
            user=user,
            opened=True
        ).count()
 
        unread_emails = SentEmail.objects.filter(
            user=user,
            opened=False
        ).count()
 
        today = timezone.now().date()
 
        today_opened = SentEmail.objects.filter(
            user=user,
            opened=True,
            opened_at__date=today
        ).count()
 
        # Percentages
        open_rate = round((read_emails / total_sent) * 100, 2) if total_sent else 0
        read_percentage = open_rate
        unread_percentage = round(100 - open_rate, 2) if total_sent else 0

        prefill_data = request.session.pop("prefill_email_data", {})
 
 
        context = {
            "google_accounts": google_accounts,
            "user_services": user_services,
            "signatures": signatures,
            "title": "Home",
            "open_rate": open_rate,
            "today_opened": today_opened,
            "read_emails": read_emails,
            "unread_emails": unread_emails,
            "read_percentage": read_percentage,
            "unread_percentage": unread_percentage,
            "user_attachments": user_attachments,
            "prefill_data": prefill_data,
 
        }
 
        return render(request, 'generate_email/email_generator.html', context)
    
 
 
    def post(self, request, *args, **kwargs):
        user_domain = (request.user.email or "").split("@")[-1].lower()
        if user_domain != ORG_DOMAIN:
            # ── Hard 50-email send limit ──
            sent_count = SentEmail.objects.filter(user=request.user).count()
            if sent_count >= EMAIL_SEND_LIMIT:
                return JsonResponse({
                    'success': False,
                    'email_limit_reached': True,
                    'redirect_url': reverse('pricing'),
                    'errors': f"You have reached the limit of {EMAIL_SEND_LIMIT} emails. Please upgrade your plan."
                }, status=403)

            wallet, _ = UserWallet.objects.get_or_create(
                user=request.user,
                defaults={"credits": 50}
            )
            if wallet.credits <= 0:
                return JsonResponse({
                    'success': False,
                    'email_limit_reached': True,
                    'redirect_url': reverse('pricing'),
                    'errors': "Free limit finished. Please buy credits."
                }, status=403)
        data = json.loads(request.body)

        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        email = (data.get('email') or "").strip()

        # 🚨 REQUIRED VALIDATION
        if not email:
            return JsonResponse({
                'success': False,
                'errors': "Target email is required"
            }, status=400)

        # 🚨 FORMAT VALIDATION
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({
                'success': False,
                'errors': "Enter a valid email address"
            }, status=400)
 
        email = data.get('email')
        receiver_first_name = data.get('receiver_first_name')
        receiver_last_name = data.get('receiver_last_name')
        company_linkedin_url = self.normalize_url(data.get('company_linkedin_url', ''))
        receiver_linkedin_url = self.normalize_url(data.get('receiver_linkedin_url', ''))
        selected_service = (data.get('selected_service') or "")[:500]
        company_url = self.normalize_url(data.get('company_url', ''))
        framework = (data.get('framework') or "")[:500]
        campaign_goal = (data.get('campaign_goal') or "")[:500]
        signature_id = data.get('signature_id')
 
        # Selected Account Read
        selected_account_id = data.get("sent_from")  # <-- fetch from POST JSON
 
        if selected_account_id:
            google_account = SocialAccount.objects.get(
                id=selected_account_id,
                user=request.user,
            )
 
            
            google_token = SocialToken.objects.get(account=google_account)
            access_token = google_token.token
 
            if google_account.provider == "google":
                sender_email = google_account.extra_data.get("email")
 
            elif google_account.provider == "microsoft":
                sender_email = (
                    google_account.extra_data.get("mail")
                    or google_account.extra_data.get("userPrincipalName")
                )
 
            # Optional: log for debug
            logger.info(f"Selected Google Account: {sender_email} for user {request.user.id}")
        else:
            sender_email = None
            access_token = None
 
        if selected_service:
            service = ProductService.objects.get(user=request.user, service_name=selected_service)
        else:
            service = ProductService.objects.filter(user=request.user).first()
 
        # Only count SentEmails that do NOT have a corresponding ReminderEmail
        # if request.user.email.split('@')[-1] != "jmsadvisory.in":
        #     sent_emails = SentEmail.objects.filter(user=request.user).exclude(
        #         id__in=ReminderEmail.objects.filter(sent_email=OuterRef('pk')).values('sent_email')
        #     )
        #     if sent_emails.count() >= 50 :
        #         return JsonResponse({'success': False, 'errors': "You have Exceeded limit of 50 emails."})
            
        targets = TargetAudience.objects.filter(
            user=request.user,
            email=email
        )

        if targets.exists():
            target = targets.first()

            # ✅ Update latest selections
            target.receiver_first_name = receiver_first_name
            target.receiver_last_name = receiver_last_name
            target.receiver_linkedin_url = receiver_linkedin_url
            target.selected_service = selected_service
            target.company_url = company_url
            target.framework = framework
            target.campaign_goal = campaign_goal
            target.save()

        else:
            target = TargetAudience.objects.create(
                user=request.user,
                email=email,
                receiver_first_name=receiver_first_name,
                receiver_last_name=receiver_last_name,
                receiver_linkedin_url=receiver_linkedin_url,
                selected_service=selected_service,
                company_url=company_url,
                framework=framework,
                campaign_goal=campaign_goal,
            )
        emails = json.loads(get_response(request.user, target, service))
 
        signature_html = ""
        if signature_id:
            try:
                signature = Signature.objects.get(id=signature_id, user=request.user)
                signature_html = self.format_signature(
                    signature,
                    request.user
                )
            except Signature.DoesNotExist:
                signature_html = ""
 
        default_signature = (
                '<div style="margin:0;padding:0;line-height:1.4;">'
                f'Best,<br>{request.user.full_name}'
                '</div>'
            )
        final_signature = signature_html if signature_html else default_signature
 
        for email in emails['follow_ups']:
            email['body'] +=  final_signature or default_signature
    
        emails['main_email'][
            'body'] += final_signature or default_signature
 
        return JsonResponse({'success': True,'emails': emails, 'targetId':target.id, 'sent_from': selected_account_id,
            'normalized_urls': {
                'company_url': company_url,
                'company_linkedin_url': company_linkedin_url,
                'receiver_linkedin_url': receiver_linkedin_url
            }})
    

def add_business_days_np(start_date, n_days):
    # Convert to numpy datetime64
    start_np = np.datetime64(start_date)
    # Use numpy's busday_offset
    result = np.busday_offset(start_np, n_days, roll='forward')
    return result.astype('M8[D]').astype(object)

class SendEmailView(BlockDirectAccessMixin,LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'generate_email/email_generator.html', {'title': "Home"})

    def post(self, request, *args, **kwargs):
        saved_attachment_id = None   

        # SUPPORT BOTH JSON & multipart/form-data
        if request.content_type and request.content_type.startswith("multipart"):
            # FormData (with attachment)
            emails = json.loads(request.POST.get("emails"))
            targetId = request.POST.get("targetId")
            sent_from = request.POST.get("sent_from")

            saved_attachment_id = request.POST.get("saved_attachment_id")

            email = (request.POST.get("email") or "").strip()

            attachment = None

            if saved_attachment_id:
                try:
                    saved_obj = EmailAttachment.objects.get(
                        id=saved_attachment_id,
                        user=request.user
                    )
                    attachment = saved_obj.file   
                except EmailAttachment.DoesNotExist:
                    attachment = None

        else:
            # Raw JSON (no attachment)
            data = json.loads(request.body)
            emails = data.get("emails")
            targetId = data.get("targetId")
            sent_from = data.get("sent_from")

            email = (data.get("email") or "").strip()
            attachment = None
            selected_account = None

        if not sent_from:
            return JsonResponse(
                {"success": False, "error": "Sending account not selected"},
                status=400
            )

        try:
            sent_from = int(sent_from)
        except (TypeError, ValueError):
            return JsonResponse(
                {"success": False, "error": "Invalid sending account"},
                status=400
            )

        selected_account = SocialAccount.objects.filter(
            id=sent_from,
            user=request.user
        ).first()

        if not selected_account:
            return JsonResponse(
                {"success": False, "error": "Selected sending account not found"},
                status=404
            )

        target = TargetAudience.objects.get(id=targetId)

        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        # email = (data.get('email') or "").strip()

        # # 🚨 REQUIRED VALIDATION
        # if not email:
        #     return JsonResponse({
        #         'success': False,
        #         'errors': "Target email is required"
        #     }, status=400)

        # # 🚨 FORMAT VALIDATION
        # try:
        #     validate_email(email)
        # except ValidationError:
        #     return JsonResponse({
        #         'success': False,
        #         'errors': "Enter a valid email address"
        #     }, status=400)

        email = target.email

        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({
                'success': False,
                'errors': "Invalid target email"
            }, status=400)
        
        main_email = emails["main_email"]
        followup_emails = emails["follow_ups"]

        #for restriction more than 500 user    
        # user = request.user
        # user_email = user.email.lower() if user.email else ""
        # organization_domain = "jmsadvisory"

        # # ✅ Check if user is from your organization
        # if organization_domain not in user_email:
        #     # Count how many emails this user has already sent
        #     sent_count = SentEmail.objects.filter(user=user).count()

        #     if sent_count >= 500:
        #         return JsonResponse({
        #             'success': False,
        #             'error': 'Email limit reached. You can only send up to 500 emails.'
        #         }, status=403)

        # # ✅ Send main email
        # sent_email = send_email(request, user, target, main_email,selected_account=selected_account,attachment=attachment)

        user_domain = (request.user.email or "").split("@")[-1].lower()
        wallet = None

        if user_domain != ORG_DOMAIN:
            # ── Hard 50-email send limit ──
            sent_count = SentEmail.objects.filter(user=request.user).count()
            if sent_count >= EMAIL_SEND_LIMIT:
                return JsonResponse({
                    "success": False,
                    "email_limit_reached": True,
                    "redirect_url": reverse('pricing'),
                    "error": f"You have reached the limit of {EMAIL_SEND_LIMIT} emails. Please upgrade your plan."
                }, status=403)

            wallet, _ = UserWallet.objects.get_or_create(
                user=request.user,
                defaults={"credits": 500}
            )

            if wallet.credits <= 0:
                return JsonResponse({
                    "success": False,
                    "email_limit_reached": True,
                    "redirect_url": reverse('pricing'),
                    "error": "Free limit finished. Please buy credits to continue."
                }, status=403)
        
        try:
            sent_email = send_email(request, request.user, target, main_email,selected_account=selected_account,attachment=attachment)
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)

        if wallet is not None:
            wallet.credits -= 1
            wallet.save(update_fields=["credits", "updated_at"])

        ActivityLog.objects.get_or_create(
            user=request.user,
            action="EMAIL_SENT",
            description=f"{target.framework} Email sent to {target.email}"
        )
        message_id = make_msgid(domain='sellsharp.co')
        today = date.today()
        days = [3, 5, 7, 10]
        reminders = []
        index = 0

        for fe in followup_emails:
            day = int(fe.get("day", days[index] if index < len(days) else 3))

            send_date = add_business_days_np(today, day)
            subject = main_email["subject"]
            reminder, created = ReminderEmail.objects.get_or_create(
                user=request.user,
                email=target.email,
                sent_email=sent_email,
                target_audience=target,
                subject=subject,
                message=fe["body"],
                send_at=send_date,
                message_id=message_id
            )
            reminders.append({
                'subject': subject,
                'send_date': send_date.strftime("%B %d, %Y"),
                'days_after': day
            })
            index += 1

        return JsonResponse({
            'success': True,
            'reminders': reminders,
            'main_email_sent': True,
            'target_email': target.email
        })

import logging
from django.views.decorators.cache import never_cache
logger = logging.getLogger(__name__)

class EmailListView(BlockDirectAccessMixin,LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/email_list.html'
    context_object_name = 'sent_emails'
   

    def parse_full_datetime(self, value):
        """
        13 Jan 2026, 05:58 pm
        """
        try:
            dt = datetime.strptime(value, "%d %b %Y, %I:%M %p")
            return timezone.make_aware(dt)
        except ValueError:
            return None
    def parse_natural_date(self, value):
        """
        13 jan
        13 jan 2026
        """
        parts = value.lower().split()

        if len(parts) not in (2, 3):
            return None
        month = day = year = None

        for part in parts:
            if part.isdigit():
                if len(part) == 4:
                    year = int(part)
                else:
                    day = int(part)
            else:
                try:
                    month = list(calendar.month_name).index(part.capitalize())
                except ValueError:
                    try:
                        month = list(calendar.month_abbr).index(part.capitalize())
                    except ValueError:
                        pass

        if not month or not day:
            return None

        if not year:
            year = timezone.now().year

        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None
        
    def parse_month(self, value):
        """
        jan, january
        """
        value = value.lower()
        for i in range(1, 13):
            if value in (
                calendar.month_name[i].lower(),
                calendar.month_abbr[i].lower()
            ):
                return i
        return None
    
    def get_queryset(self):
        search = self.request.GET.get('search', '').strip()

        today= timezone.now().date()
        next_reminder = ReminderEmail.objects.filter(
            sent_email=OuterRef('pk'),
            sent=False,
            # send_at__gte=now().date()
            send_at__gte=today
        ).order_by('send_at').values('send_at')[:1]

        qs = (
        SentEmail.objects
        .filter(user=self.request.user,is_scheduled=False)

        .select_related('target_audience')
        .annotate(next_reminder_date=Subquery(next_reminder))
        .order_by('-created')
        )

        full_dt=self.parse_full_datetime(search)
        if full_dt:
            start = full_dt.replace(second=0, microsecond=0)
            end = start + timedelta(minutes=1)
            qs= qs.filter(created__gte=start, created__lt=end)
            return qs
        
        natural_date=self.parse_natural_date(search)
        if natural_date:
            qs= qs.filter(
                Q(created__date=natural_date) |
                Q(next_reminder_date=natural_date)
            )
            return qs
        
        month=self.parse_month(search)
        if month:
            qs= qs.filter(
                Q(created__month=month) |
                Q(next_reminder_date__month=month)
            )
            return qs

        if search:
            qs = qs.filter(
                Q(target_audience__email__icontains=search) |
                Q(subject__icontains=search) |
                Q(target_audience__receiver_first_name__icontains=search) |
                Q(target_audience__receiver_last_name__icontains=search)
            )
        return qs
    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get('ajax') == '1':
            emails = context['sent_emails'].values(
                'subject',
                'target_audience__email',
                'target_audience__receiver_first_name',
                'target_audience__receiver_last_name',
                'created',
                'next_reminder_date',
                'stop_reminder'
            )
            data = [
                {
                    'subject': e['subject'],
                    'email': e['target_audience__email'],
                    'name': f"{e['target_audience__receiver_first_name']} {e['target_audience__receiver_last_name']}",
                    'created': e['created'].strftime("%d %b %Y, %I:%M %p"),
                    'next_reminder_date': e['next_reminder_date'].strftime("%d %b %Y") if e['next_reminder_date'] else None,
                    'stop_reminder': e['stop_reminder'] 
                }
                for e in emails
            ]
            return JsonResponse(data, safe=False)
        return super().render_to_response(context, **response_kwargs)

    def post(self, request):
        data = json.loads(request.body)

        email_id = data.get("email_id")
        email = SentEmail.objects.get(id=email_id)
        email.stop_reminder = True
        email.save()

        return JsonResponse({'success': True})

class CheckEmailHistoryView(BlockDirectAccessMixin,LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        email = request.GET.get("email")
        service=request.GET.get("service")

        if not email or not service:
            return JsonResponse(
                {"exists": False},
                status=400
            )

        last_email = (
            SentEmail.objects
            .filter(user=request.user, email=email,target_audience__selected_service=service)
            .select_related('target_audience')
            .order_by("-created")
            .first()
        )

        if last_email:
            return JsonResponse({
                "exists": True,
                "subject": last_email.subject,
                "service": last_email.target_audience.selected_service,
                "sent_at": last_email.created.strftime("%d %b %Y, %I:%M %p"),
            })

        return JsonResponse({"exists": False})
    
class LeadListView(BlockDirectAccessMixin,LoginRequiredMixin, ListView):
    # model = SentEmail
    model = TargetAudience
    template_name = 'generate_email/lead_list.html'
    context_object_name = 'target_audience'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        base_qs = TargetAudience.objects.filter(user=self.request.user)

        context["service_options"] = [x for x in base_qs.values_list("selected_service", flat=True).distinct().order_by("selected_service") if x]
        context["framework_options"] = [x for x in base_qs.values_list("framework", flat=True).distinct().order_by("framework") if x]
        context["goal_options"] = [x for x in base_qs.values_list("campaign_goal", flat=True).distinct().order_by("campaign_goal") if x]

        return context
    
    def parse_natural_date(self, value):
        """
        13 jan
        13 jan 2026
        """
        parts = value.lower().split()

        if len(parts) not in (2, 3):
            return None
        month = day = year = None

        for part in parts:
            if part.isdigit():
                if len(part) == 4:
                    year = int(part)
                else:
                    day = int(part)
            else:
                try:
                    month = list(calendar.month_name).index(part.capitalize())
                except ValueError:
                    try:
                        month = list(calendar.month_abbr).index(part.capitalize())
                    except ValueError:
                        pass

        if not month or not day:
            return None

        if not year:
            year = timezone.now().year

        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    def get_queryset(self):
        search = self.request.GET.get('search', '').strip()
        service = self.request.GET.get('service', '').strip()
        framework = self.request.GET.get('framework', '').strip()
        goal = self.request.GET.get('goal', '').strip()
        last_days = self.request.GET.get('last_days', '').strip()

        qs = TargetAudience.objects.filter(user=self.request.user).order_by('-created')

        if service:
            qs = qs.filter(selected_service=service)
        if framework:
            qs = qs.filter(framework=framework)
        if goal:
            qs = qs.filter(campaign_goal=goal)
        if last_days.isdigit():
            days = int(last_days)
            qs = qs.filter(created__gte=timezone.now() - timedelta(days=days))

        natural_date=self.parse_natural_date(search)
        if natural_date:
            qs= qs.filter(created__date=natural_date)
            return qs

        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(receiver_first_name__icontains=search) |
                Q(receiver_last_name__icontains=search)|
                Q(selected_service__icontains=search) |
                Q(framework__icontains=search)|
                Q(campaign_goal__icontains=search)|
                Q(company_url__icontains=search)
            )
        return qs

    def render_to_response(self, context, **response_kwargs):
        # Check for the ajax flag in the GET parameters
        if self.request.GET.get('ajax') == '1':
            leads = context['target_audience']
            data = [
                {
                    'id': lead.id,
                    'first_name': lead.receiver_first_name,
                    'last_name': lead.receiver_last_name,
                    'email': lead.email,
                    'linkedin_url': lead.receiver_linkedin_url,
                    'selected_service': lead.selected_service,
                    'company_url': lead.company_url,
                    'framework': lead.framework,
                    'campaign_goal': lead.campaign_goal,
                    'created': lead.created.strftime("%b %d, %Y"),
                    # Construct the URL for the clickable row
                    'view_url': reverse('view-leads-email', kwargs={'pk': lead.id})
                }
                for lead in leads
            ]
            return JsonResponse(data, safe=False)
        
        return super().render_to_response(context, **response_kwargs)  

def escape_csv(value):
    """
    Escapes potentially dangerous values for CSV injection.
    """
    if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
        return "'" + value  # Prepend with single quote to disable formula
    return value

def export_target_audience_csv(request):

    if request.method == "GET" and not request.META.get("HTTP_REFERER"):
        return redirect("/")
    
    response = HttpResponse(content_type='text/csv')
    today = timezone.now().date()
    filename = f"Lead-List-{today}.csv"
    response['Content-Disposition'] = f'attachment; filename={filename}'

    writer = csv.writer(response)
    headers = [
        'Name', 'Email', 'LinkedIn URL', 'For Service', 'Company Website',
        'Framework', 'Goal of Campaign', 'Last Connected'
    ]
    writer.writerow([escape_csv(header) for header in headers])

    target_audience = TargetAudience.objects.filter(user=request.user).order_by('-created')  # Add filters if needed

    for ta in target_audience:
        row = [
            f"{ta.receiver_first_name} {ta.receiver_last_name}",
            ta.email,
            ta.receiver_linkedin_url,
            ta.selected_service,
            ta.company_url,
            ta.framework,
            ta.campaign_goal,
            ta.created.strftime("%Y-%m-%d"),
        ]
        writer.writerow([escape_csv(cell) for cell in row])
    return response

class LeadEmailListView(LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/leads_email_list.html'
    context_object_name = 'target_audience_email'

    def get_queryset(self):


        pk = self.kwargs.get('pk')
        self.target_audience = TargetAudience.objects.get(pk=pk)
        next_reminder = ReminderEmail.objects.filter(
            sent_email=OuterRef('pk'),
            send_at__gte=now().date()
        ).order_by('send_at').values('send_at')[:1]
        # Show only emails sent by the logged-in user, newest first
        return (self.target_audience.sent_email.
                annotate(next_reminder_date=Subquery(next_reminder)).order_by('-created'))


    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['target_audience'] = self.target_audience
        return context

class EmailMessageView(BlockDirectAccessMixin,DetailView):
    model = SentEmail
    template_name = 'generate_email/email_message.html'
    context_object_name = 'email'

    def get_object(self):
        return get_object_or_404(SentEmail, uid=self.kwargs['uid'], user=self.request.user)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        sent_email = self.object  # already fetched by DetailView using get_object
        context['reminders'] = ReminderEmail.objects.filter(
            sent_email=sent_email,
            sent=True
        ).order_by('send_at')
        return context

# @csrf_exempt
# def msgraph_webhook(request):
#     start_time = time.time()
#     print("MS Graph request arrived at", timezone.now(), "method:", request.method)
#     # Step 1: Handle validation (GET or POST with validationToken)
#     validation_token = request.GET.get("validationToken")
#     if not validation_token and request.method == "POST":

#         # In POST validation, token is sent in the query string too
#         validation_token = request.GET.get("validationToken")
#     if validation_token:
#         return HttpResponse(validation_token, content_type="text/plain", status=200)

#     # Step 2: Handle actual notifications
#     if request.method == "POST":
#         try:
#             data = json.loads(request.body.decode('utf-8') or '{}')
#             for change in data.get('value', []):
#                 # validate clientState matches
#                 if change.get('clientState') != settings.MS_GRAPH_CLIENT_STATE:
#                     continue

#                 try:
#                     msg_id = change.get('resourceData', {}).get('id')
#                     sub_id = change.get("subscriptionId")
#                     sub = EmailSubscription.objects.get(subscription_id=sub_id)
#                     user = sub.user
#                     # message_data = get_message_details(user, msg_id)
#                     try:
#                         message_data = get_message_details(user, msg_id)
#                     except Exception:
#                         logger.exception("Webhook-safe Graph failure")
#                         continue


#                     if not message_data or not isinstance(message_data, dict):
#                         logger.warning("MS Graph webhook returned no message data for msg_id=%s", msg_id)
#                         continue

#                     # in_reply_to = message_data.get('value',[])[0]["conversationId"]
#                     value_list = message_data.get('value', [])

#                     if not value_list:
#                         # Handle gracefully, e.g., skip or log the event
#                         logger.warning("MS Graph webhook received empty 'value' list: %s", message_data)
#                         return JsonResponse({"status": "ignored"}, status=200)

#                     in_reply_to = value_list[0].get("conversationId")


#                     for email in SentEmail.objects.filter(user=user):
#                         reminder_qs = email.reminder_email.all()
#                         if reminder_qs.exists():

#                             sent_msg_id = email.message_id
#                             if sent_msg_id.startswith("AA"):
#                                 conversation_id = get_conversation_id(user, sent_msg_id)

#                                 if conversation_id == in_reply_to:

#                                     email.stop_reminder = True
#                                     email.save()
#                 except EmailSubscription.DoesNotExist:
#                     continue  # unknown subscription


#         except json.JSONDecodeError:
#             return HttpResponse(status=400)

#         # TODO: Check if message is a reply, update DB, etc.
#         return HttpResponse(status=202)
#     return HttpResponse(status=405)

import json
import time
import logging
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from .tasks import process_msgraph_change
import threading

logger = logging.getLogger(__name__)

# @csrf_exempt
# def msgraph_webhook(request):
#     print("MS Graph request arrived at", timezone.now(), "method:", request.method)

#     # Handle validation
#     validation_token = request.GET.get("validationToken")
#     if validation_token:
#         return HttpResponse(validation_token, content_type="text/plain", status=200)

#     if request.method != "POST":
#         return HttpResponse(status=405)

#     try:
#         data = json.loads(request.body.decode("utf-8") or "{}")
#     except json.JSONDecodeError:
#         return HttpResponse(status=400)

#     for change in data.get("value", []):

#         # Validate clientState
#         if change.get("clientState") != settings.MS_GRAPH_CLIENT_STATE:
#             continue

#         msg_id = change.get("resourceData", {}).get("id")
#         sub_id = change.get("subscriptionId")

#         if not msg_id or not sub_id:
#             continue

#         try:
#             sub = EmailSubscription.objects.get(subscription_id=sub_id)
#             user = sub.user
#         except EmailSubscription.DoesNotExist:
#             continue
#         # Fetch message details safely
#         try:
#             message_data = get_message_details(user, msg_id)
#         except Exception as e:
#             logger.error(f"Graph API error while getting message details: {e}")
#             continue

#         if not message_data or not isinstance(message_data, dict):
#             logger.warning("MS Graph webhook returned invalid message data")
#             continue

#         value_list = message_data.get("value", [])
#         if not value_list:
#             continue

#         in_reply_to = value_list[0].get("conversationId")

#         # ✅ SECOND FIX: Only fetch emails that have reminders
#         emails = SentEmail.objects.filter(
#             user=user,
#             reminder_email__isnull=False
#         ).distinct()

#         for email in emails:

#             sent_msg_id = email.message_id

#             if not sent_msg_id:
#                 continue

#             if not sent_msg_id.startswith("AA"):
#                 continue

#             try:
#                 conversation_id = get_conversation_id(user, sent_msg_id)
#             except Exception as e:
#                 logger.error(f"Graph API error: {e}")
#                 continue

#             if conversation_id == in_reply_to:
#                 email.stop_reminder = True
#                 email.save(update_fields=["stop_reminder"])

#             # small delay to avoid Graph rate limit
#             time.sleep(0.2)

#     return HttpResponse(status=202)


@csrf_exempt
def msgraph_webhook(request):
    print("MS Graph request arrived at", timezone.now(), "method:", request.method)

    validation_token = request.GET.get("validationToken")
    if validation_token:
        return HttpResponse(validation_token, content_type="text/plain", status=200)

    if request.method != "POST":
        return HttpResponse(status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    for change in data.get("value", []):
        t = threading.Thread(target=process_msgraph_change, args=(change,))
        t.daemon = True
        t.start()

    # Returns instantly — no more timeouts
    return HttpResponse(status=202)

# def get_message_details(user, msg_id):

#     access_token = get_latest_microsoft_token(user)

#     if not access_token:
#         logger.warning(
#             "MS Graph webhook: no access token for user_id=%s",
#             user.id
#         )
#         return None


#     url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}?$select=internetMessageHeaders"
#     headers = {"Authorization": f"Bearer {access_token}"}

#     try:
#         resp = requests.get(url, headers=headers)
#         resp.raise_for_status()

#         data = resp.json()

#         # Extract 'in-reply-to' message header
#         in_reply_to = ""
#         for header in data.get("internetMessageHeaders", []):
#             if header["name"].lower() in ["in-reply-to", "references"]:
#                 in_reply_to = header['value']

#         if not in_reply_to:
#             return None

#         # Query original conversation
#         base_url = f"https://graph.microsoft.com/v1.0/me/messages?$filter=internetMessageId eq '{in_reply_to}'"
#         resp1 = requests.get(base_url, headers=headers)
#         resp1.raise_for_status()
#         return resp1.json()

#     except requests.HTTPError as e:
#         if e.response.status_code == 404:
#             return None
#         raise

# def get_conversation_id(user, msg_id):
#     import requests

#     access_token = get_latest_microsoft_token(user)
#     if not access_token:
#         return None

#     url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}"
#     headers = {"Authorization": f"Bearer {access_token}"}

#     resp = requests.get(url, headers=headers)
#     if resp.status_code == 404:
#         print(f"Message {msg_id} not found, skipping.")
#         return None

#     resp.raise_for_status()
#     data = resp.json()

#     if "conversationId" in data:
#         return data["conversationId"]

#     if "value" in data and data["value"]:
#         return data["value"][0].get("conversationId")

#     return None
# import requests
# import time

# def get_conversation_id(user, msg_id):
#     access_token = get_latest_microsoft_token(user)
#     if not access_token:
#         return None
 
#     url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}"
#     headers = {"Authorization": f"Bearer {access_token}"}

#     retries = 3

#     for attempt in range(retries):
#         resp = requests.get(url, headers=headers)

#         if resp.status_code == 429:
#             retry_after = int(resp.headers.get("Retry-After", 2))
#             time.sleep(retry_after)
#             continue

#         if resp.status_code == 404:
#             return None

#         if resp.status_code != 200:
#             return None

#         data = resp.json()
#         return data.get("conversationId")

#     return None

@csrf_exempt
def email_open_pixel(request, uid):
    # if request.method == "GET" and not request.META.get("HTTP_REFERER"):
    #     return redirect("/")

    #  Ignore admin / logged-in users
    if request.user.is_authenticated:
        return transparent_pixel_response()

    #  Ignore Django admin preview
    referer = request.META.get("HTTP_REFERER", "")
    if "/admin/" in referer:
        return transparent_pixel_response()

    try:
        email = SentEmail.objects.get(uid=uid)

        if not email.opened:
            email.opened = True
            email.opened_at = timezone.now()
            email.opened_count = 1
        else:
            email.opened_count += 1

        email.save(update_fields=["opened", "opened_at", "opened_count"])

    except SentEmail.DoesNotExist:
        pass

    return transparent_pixel_response()


def transparent_pixel_response():
    pixel = (
        b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80'
        b'\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04'
        b'\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01'
        b'\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
    )
    return HttpResponse(pixel, content_type='image/gif')

import csv
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import TargetAudience, AudienceTag

# def import_leads(request):

#     if request.method == "POST":

#         csv_file = request.FILES.get("csv_file")
#         tag_name = request.POST.get("tag_name")

#         if not csv_file or not tag_name:
#             messages.error(request, "CSV file and Tag required")
#             return redirect("leads")

#         tag, created = AudienceTag.objects.get_or_create(
#             user=request.user,
#             name=tag_name
#         )

#         decoded = csv_file.read().decode("utf-8").splitlines()
#         reader = csv.DictReader(decoded)

#         for row in reader:
#             TargetAudience.objects.create(
#                 user=request.user,
#                 email=row.get("email"),
#                 receiver_first_name=row.get("receiver_first_name"),
#                 receiver_last_name=row.get("receiver_last_name"),
#                 tag=tag
#             )

#         messages.success(request, "Leads imported successfully")
#         return redirect("view-leads")

#     return render(request, "generate_email/import_leads.html")
def import_leads(request):

    if request.method == "GET" and not request.META.get("HTTP_REFERER"):
        return redirect("/")

    if request.method == "POST":

        csv_file = request.FILES.get("csv_file")
        tag_name = request.POST.get("tag_name")

        if not csv_file or not tag_name:
            messages.error(request, "CSV file and Tag required")
            return redirect("leads")

        tag, created = AudienceTag.objects.get_or_create(
            user=request.user,
            name=tag_name
        )

        decoded = csv_file.read().decode("utf-8").splitlines()
        reader = csv.DictReader(decoded)

        for row in reader:

            email = row.get("Target Person Email")

            if not email:
                continue  # skip empty rows

            TargetAudience.objects.create(
                user=request.user,
                email=email,
                receiver_linkedin_url=row.get("Target Person LinkedIn"),
                company_url=row.get("Target Company Website"),
                receiver_first_name=row.get("Target Person First Name"),
                receiver_last_name=row.get("Target Person Last Name"),
                tag=tag
            )

        messages.success(request, "Leads imported successfully")
        return redirect("view-leads")

    return render(request, "generate_email/import_leads.html")
from django.utils.dateparse import parse_datetime
from django.contrib import messages
from django.shortcuts import render, redirect
from allauth.socialaccount.models import SocialAccount
from users.models import ProductService, Signature, EmailAttachment
from .models import TargetAudience, SentEmail, AudienceTag
from .utils import sendCampaignEmail 

# def campaign_view(request):

#     tags = AudienceTag.objects.filter(user=request.user)

#     user_services = ProductService.objects.filter(
#         user=request.user
#     ).values_list("service_name", flat=True).distinct()

#     signatures = Signature.objects.filter(user=request.user)

#     google_accounts = SocialAccount.objects.filter(
#         user=request.user,
#         provider__in=["google", "microsoft"]
#     )

#     user_attachments = EmailAttachment.objects.filter(user=request.user)

#     if request.method == "POST":

#         tag_id = request.POST.get("tag_id")
#         selected_service = request.POST.get("selected_service")
#         framework = request.POST.get("framework")
#         campaign_goal = request.POST.get("campaign_goal")
#         signature_id = request.POST.get("signature_id")
#         sent_from = request.POST.get("sent_from")
#         saved_attachment_id = request.POST.get("saved_attachment")

#         subject = request.POST.get("subject") or ""
#         message = request.POST.get("message") or ""
#         schedule_time = request.POST.get("schedule_time")

#         if not tag_id or not sent_from:
#             messages.error(request, "Tag and Sending Account required")
#             return redirect("campaign_view")

#         selected_account = SocialAccount.objects.filter(
#             id=sent_from,
#             user=request.user
#         ).first()

#         if not selected_account:
#             messages.error(request, "Invalid sending account")
#             return redirect("campaign_view")

#         audiences = TargetAudience.objects.filter(
#             user=request.user,
#             tag_id=tag_id
#         )

#         if not audiences.exists():
#             messages.error(request, "No leads found under selected tag")
#             return redirect("campaign_view")

#         # ✅ SAFE SIGNATURE HANDLING
#         signature_html = ""
#         if signature_id:
#             sig = Signature.objects.filter(
#                 id=signature_id,
#                 user=request.user
#             ).first()

#             if sig and sig.signature:
#                 signature_html = sig.signature

#         # ✅ SAFE MESSAGE BUILD
#         final_message = message
#         if signature_html:
#             final_message += "<br><br>" + signature_html

#         # ==============================
#         # 🚀 IMMEDIATE SEND
#         # ==============================
#         if not schedule_time:

#             for audience in audiences:

#                 main_email = {
#                     "subject": subject,
#                     "body": final_message
#                 }

#                 sendCampaignEmail(
#                     request=request,
#                     user=request.user,
#                     target_audience=audience,
#                     main_email=main_email,
#                     selected_account=selected_account,
#                     attachment=None
#                 )

#             messages.success(request, "Campaign Sent Successfully")

#         # ==============================
#         # ⏰ SCHEDULE SEND
#         # ==============================
#         else:
#             schedule_dt = parse_datetime(schedule_time)

#             if schedule_dt:
#                 schedule_dt = timezone.make_aware(schedule_dt)

#             if not schedule_dt:
#                 messages.error(request, "Invalid schedule time")
#                 return redirect("campaign_view")

#             for audience in audiences:

#                 SentEmail.objects.create(
#                     user=request.user,
#                     target_audience=audience,
#                     email=audience.email,
#                     subject=subject,
#                     message=final_message,
#                     is_scheduled=True,
#                     scheduled_at=schedule_dt,
#                     sending_account=selected_account
#                 )

#             messages.success(request, "Campaign Scheduled Successfully")

#         return redirect("campaign_view")

#     return render(request, "generate_email/campaign.html", {
#         "tags": tags,
#         "user_services": user_services,
#         "signatures": signatures,
#         "google_accounts": google_accounts,
#         "user_attachments": user_attachments
#     })

from django.shortcuts import render, redirect
from django.contrib import messages
from django.utils.dateparse import parse_datetime
from django.utils import timezone
import json
#  -----------------campgain 2 --------------------#
# def campaign_view(request):

#     tags = AudienceTag.objects.filter(user=request.user)
#     user_services = ProductService.objects.filter(user=request.user)
#     signatures = Signature.objects.filter(user=request.user)

#     google_accounts = SocialAccount.objects.filter(
#         user=request.user,
#         provider__in=["google", "microsoft"]
#     )

#     user_attachments = EmailAttachment.objects.filter(user=request.user)

#     if request.method == "POST":

#         # =========================
#         # FORM DATA
#         # =========================
#         tag_id = request.POST.get("tag_id")
#         service_name = request.POST.get("selected_service")
#         framework = request.POST.get("framework")
#         campaign_goal = request.POST.get("campaign_goal")
#         signature_id = request.POST.get("signature_id")
#         sent_from = request.POST.get("sent_from")
#         schedule_time = request.POST.get("schedule_time")
#         # shuffle_accounts = request.POST.get("shuffle_accounts")
#         shuffle_accounts = request.POST.get("shuffle_accounts") == "on"
#         saved_attachment_id = request.POST.get("saved_attachment")

#         # =========================
#         # VALIDATIONS
#         # =========================
#         if not tag_id or not service_name or not sent_from:
#             messages.error(request, "Tag, Service and Sending Account are required")
#             return redirect("campaign_view")

#         selected_service = ProductService.objects.filter(
#             service_name=service_name,
#             user=request.user
#         ).first()

#         if not selected_service:
#             messages.error(request, "Invalid service selected")
#             return redirect("campaign_view")

#         selected_account = SocialAccount.objects.filter(
#             id=sent_from,
#             user=request.user
#         ).first()

#         if not selected_account:
#             messages.error(request, "Invalid sending account")
#             return redirect("campaign_view")

#         audiences = TargetAudience.objects.filter(
#             user=request.user,
#             tag_id=tag_id
#         )

#         if not audiences.exists():
#             messages.error(request, "No leads found under selected tag")
#             return redirect("campaign_view")

#         # =========================
#         # SIGNATURE
#         # =========================
#         signature_html = ""

#         if signature_id:
#             try:
#                 signature_obj = Signature.objects.get(
#                     id=signature_id,
#                     user=request.user
#                 )
#             except Signature.DoesNotExist:
#                 signature_obj = None
#         else:
#             # Default signature if none selected
#             signature_obj = Signature.objects.filter(
#                 user=request.user,
#             ).first()

#         if signature_obj:
#             signature_html = signature_obj.signature or ""

#             # ✅ If photo exists, append it
#             if signature_obj.photo:
#                 photo_url = request.build_absolute_uri(signature_obj.photo.url)

#                 signature_html += f"""
#                     <p>
#                         <img src="{photo_url}"
#                             alt="Signature Photo"
#                             style="max-width:420px;margin-top:8px;width:100%;height:auto;display:block;">
#                     </p>
#                 """

#         # If still empty → fallback default
#         if not signature_html:
#             signature_html = (
#                 '<div style="margin:0;padding:0;line-height:1.4;">'
#                 f'Best,<br>{request.user.full_name}'
#                 '</div>'
#             )

#         # =========================
#         # ATTACHMENT
#         # =========================
#         attachment_file = None

#         if saved_attachment_id:
#             try:
#                 saved_obj = EmailAttachment.objects.get(
#                     id=saved_attachment_id,
#                     user=request.user
#                 )

#                 # 🔥 VERY IMPORTANT
#                 attachment_file = saved_obj.file

#                 # Ensure file pointer is at start
#                 attachment_file.open()
#                 attachment_file.seek(0)

#             except EmailAttachment.DoesNotExist:
#                 attachment_file = None

#         # =========================
#         # SCHEDULED SEND
#         # =========================
#         if schedule_time:

#             schedule_dt = parse_datetime(schedule_time)

#             if schedule_dt:
#                 schedule_dt = timezone.make_aware(schedule_dt)

#             if not schedule_dt:
#                 messages.error(request, "Invalid schedule time")
#                 return redirect("campaign_view")

#             for audience in audiences:
#                 # ✅ Lead update
#                 audience.campaign_goal = campaign_goal
#                 audience.framework = framework
#                 audience.selected_service = service_name

#                 audience.save(update_fields=[
#                     "campaign_goal",
#                     "framework",
#                     "selected_service"
#                 ])

#                 ai_raw = get_response(request.user, audience, selected_service)
#                 ai_data = json.loads(ai_raw)

#                 subject = ai_data["main_email"]["subject"]
#                 message = ai_data["main_email"]["body"]

#                 final_message = message
#                 if signature_html:
#                     final_message += "<br><br>" + signature_html

#                 SentEmail.objects.create(
#                     user=request.user,
#                     target_audience=audience,
#                     email=audience.email,
#                     subject=subject,
#                     message=final_message,
#                     is_scheduled=True,
#                     scheduled_at=schedule_dt,
#                     sending_account = None if shuffle_accounts else selected_account,
#                     attachment=saved_obj if saved_attachment_id else None,
#                     shuffle_accounts=shuffle_accounts

#                 )
#                 # =========================
#                 # FOLLOW-UP GENERATION FOR SCHEDULED CAMPAIGN
#                 # =========================

#                 follow_ups = ai_data.get("follow_ups", [])
#                 follow_up_days = [2, 4, 6, 8]

#                 # Get latest sent email
#                 sent_email_obj = SentEmail.objects.filter(
#                     user=request.user,
#                     target_audience=audience
#                 ).order_by("-created").first()

#                 if sent_email_obj:
#                     for i, follow in enumerate(follow_ups):

#                         if i >= len(follow_up_days):
#                             break

#                         follow_body = follow.get("body", "")

#                         if signature_html:
#                             follow_body += "<br><br>" + signature_html

#                         ReminderEmail.objects.create(
#                             user=request.user,
#                             target_audience=audience,
#                             sent_email=sent_email_obj,
#                             message_id=make_msgid(domain='sellsharp.co'),
#                             email=audience.email,
#                             subject=f"Re: {subject}",
#                             message=follow_body,
#                             send_at=(schedule_dt + timezone.timedelta(days=follow_up_days[i])).date(),
#                             sent=False
#                         )
#             print("Saved Attachment ID:", saved_attachment_id)
#             print("Attachment File Path:", attachment_file)
#             messages.success(request, "Campaign Scheduled Successfully")
#             return redirect("campaign_view")

#         # =========================
#         # IMMEDIATE SEND
#         # =========================
#         else:

#             account_list = list(google_accounts)

#             for index, audience in enumerate(audiences):
#                 # ✅ Lead update
#                 audience.campaign_goal = campaign_goal
#                 audience.framework = framework
#                 audience.selected_service = service_name

#                 audience.save(update_fields=[
#                     "campaign_goal",
#                     "framework",
#                     "selected_service"
#                 ])

#                 # Shuffle logic
#                 if shuffle_accounts and account_list:
#                     selected_account = account_list[index % len(account_list)]

#                 ai_raw = get_response(request.user, audience, selected_service)
#                 ai_data = json.loads(ai_raw)

#                 subject = ai_data["main_email"]["subject"]
#                 message = ai_data["main_email"]["body"]

#                 final_message = message
#                 if signature_html:
#                     final_message += "<br><br>" + signature_html

#                 main_email = {
#                     "subject": subject,
#                     "body": final_message
#                 }

#                 sendCampaignEmail(
#                     request=request,
#                     user=request.user,
#                     target_audience=audience,
#                     main_email=main_email,
#                     selected_account=selected_account,
#                     attachment=attachment_file   
#                 )
            
#             messages.success(request, "Campaign Sent Successfully")
#             return redirect("campaign_view")

#     return render(request, "generate_email/campaign.html", {
#         "tags": tags,
#         "user_services": user_services,
#         "signatures": signatures,
#         "google_accounts": google_accounts,
#         "user_attachments": user_attachments
#     })


# ----------------campaign 3 -----------------------

# @login_required(login_url="login")
# def campaign_view(request):

#     if request.method == "GET" and not request.META.get("HTTP_REFERER"):
#         return redirect("/")

#     tags = AudienceTag.objects.filter(user=request.user)
#     user_services = ProductService.objects.filter(user=request.user)
#     signatures = Signature.objects.filter(user=request.user)

#     google_accounts = SocialAccount.objects.filter(
#         user=request.user,
#         provider__in=["google", "microsoft"]
#     )

#     user_attachments = EmailAttachment.objects.filter(user=request.user)

#     if request.method == "POST":

#         # =========================
#         # FORM DATA
#         # =========================
#         tag_id = request.POST.get("tag_id")
#         service_name = request.POST.get("selected_service")
#         framework = request.POST.get("framework")
#         campaign_goal = request.POST.get("campaign_goal")
#         signature_id = request.POST.get("signature_id")
#         sent_from = request.POST.get("sent_from")
#         schedule_time = request.POST.get("schedule_time")
#         shuffle_accounts = request.POST.get("shuffle_accounts") == "on"
#         saved_attachment_id = request.POST.get("saved_attachment")

#         # =========================
#         # VALIDATIONS
#         # =========================
#         if not tag_id or not service_name or not sent_from:
#             messages.error(request, "Tag, Service and Sending Account are required")
#             return redirect("campaign_view")

#         selected_service = ProductService.objects.filter(
#             service_name=service_name,
#             user=request.user
#         ).first()

#         if not selected_service:
#             messages.error(request, "Invalid service selected")
#             return redirect("campaign_view")

#         selected_account = SocialAccount.objects.filter(
#             id=sent_from,
#             user=request.user
#         ).first()

#         if not selected_account:
#             messages.error(request, "Invalid sending account")
#             return redirect("campaign_view")

#         audiences = TargetAudience.objects.filter(
#             user=request.user,
#             tag_id=tag_id
#         )

#         if not audiences.exists():
#             messages.error(request, "No leads found under selected tag")
#             return redirect("campaign_view")

#         # =========================
#         # SIGNATURE
#         # =========================
#         signature_html = ""

#         if signature_id:
#             try:
#                 signature_obj = Signature.objects.get(
#                     id=signature_id,
#                     user=request.user
#                 )
#             except Signature.DoesNotExist:
#                 signature_obj = None
#         else:
#             signature_obj = Signature.objects.filter(
#                 user=request.user,
#             ).first()

#         if signature_obj:
#             signature_html = signature_obj.signature or ""

#             if signature_obj.photo:
#                 photo_url = request.build_absolute_uri(signature_obj.photo.url)

#                 signature_html += f"""
#                     <p>
#                         <img src="{photo_url}"
#                             alt="Signature Photo"
#                             style="max-width:420px;margin-top:8px;width:100%;height:auto;display:block;">
#                     </p>
#                 """

#         if not signature_html:
#             signature_html = (
#                 '<div style="margin:0;padding:0;line-height:1.4;">'
#                 f'Best,<br>{request.user.full_name}'
#                 '</div>'
#             )

#         # =========================
#         # ATTACHMENT
#         # =========================
#         saved_obj = None
#         attachment_file = None

#         if saved_attachment_id:
#             try:
#                 saved_obj = EmailAttachment.objects.get(
#                     id=saved_attachment_id,
#                     user=request.user
#                 )

#                 attachment_file = saved_obj.file
#                 attachment_file.open()
#                 attachment_file.seek(0)

#             except EmailAttachment.DoesNotExist:
#                 saved_obj = None
#                 attachment_file = None

#         # =========================
#         # SCHEDULED SEND
#         # =========================
#         if schedule_time:

#             schedule_dt = parse_datetime(schedule_time)

#             if schedule_dt and timezone.is_naive(schedule_dt):
#                 schedule_dt = timezone.make_aware(schedule_dt)

#             if not schedule_dt:
#                 messages.error(request, "Invalid schedule time")
#                 return redirect("campaign_view")

#             for audience in audiences:
#                 audience.campaign_goal = campaign_goal
#                 audience.framework = framework
#                 audience.selected_service = service_name

#                 audience.save(update_fields=[
#                     "campaign_goal",
#                     "framework",
#                     "selected_service"
#                 ])

#                 ai_raw = get_response(request.user, audience, selected_service)
#                 ai_data = json.loads(ai_raw)

#                 subject = ai_data["main_email"]["subject"]
#                 message = ai_data["main_email"]["body"]

#                 final_message = message
#                 if signature_html:
#                     final_message += "<br><br>" + signature_html

#                 SentEmail.objects.create(
#                     user=request.user,
#                     target_audience=audience,
#                     email=audience.email,
#                     subject=subject,
#                     message=final_message,
#                     is_scheduled=True,
#                     scheduled_at=schedule_dt,
#                     sending_account=None if shuffle_accounts else selected_account,
#                     attachment=saved_obj,
#                     shuffle_accounts=shuffle_accounts
#                 )

#                 follow_ups = ai_data.get("follow_ups", [])
#                 follow_up_days = [2, 4, 6, 8]

#                 sent_email_obj = SentEmail.objects.filter(
#                     user=request.user,
#                     target_audience=audience
#                 ).order_by("-created").first()

#                 if sent_email_obj:
#                     for i, follow in enumerate(follow_ups):

#                         if i >= len(follow_up_days):
#                             break

#                         follow_body = follow.get("body", "")

#                         if signature_html:
#                             follow_body += "<br><br>" + signature_html

#                         ReminderEmail.objects.create(
#                             user=request.user,
#                             target_audience=audience,
#                             sent_email=sent_email_obj,
#                             message_id=make_msgid(domain='sellsharp.co'),
#                             email=audience.email,
#                             subject=f"Re: {subject}",
#                             message=follow_body,
#                             send_at=(schedule_dt + timezone.timedelta(days=follow_up_days[i])).date(),
#                             sent=False
#                         )

#             messages.success(request, "Campaign Scheduled Successfully")
#             return redirect("campaign_view")

#         # =========================
#         # IMMEDIATE SEND
#         # =========================
#         else:

#             account_list = list(google_accounts)

#             for index, audience in enumerate(audiences):
#                 audience.campaign_goal = campaign_goal
#                 audience.framework = framework
#                 audience.selected_service = service_name

#                 audience.save(update_fields=[
#                     "campaign_goal",
#                     "framework",
#                     "selected_service"
#                 ])

#                 if shuffle_accounts and account_list:
#                     selected_account = account_list[index % len(account_list)]

#                 ai_raw = get_response(request.user, audience, selected_service)
#                 ai_data = json.loads(ai_raw)

#                 subject = ai_data["main_email"]["subject"]
#                 message = ai_data["main_email"]["body"]

#                 final_message = message
#                 if signature_html:
#                     final_message += "<br><br>" + signature_html

#                 main_email = {
#                     "subject": subject,
#                     "body": final_message
#                 }

#                 sendCampaignEmail(
#                     request=request,
#                     user=request.user,
#                     target_audience=audience,
#                     main_email=main_email,
#                     selected_account=selected_account,
#                     attachment=attachment_file
#                 )

#             messages.success(request, "Campaign Sent Successfully")
#             return redirect("campaign_view")

#     selected_tag_id = request.GET.get("tag_id") or request.POST.get("tag_id")

#     return render(request, "generate_email/campaign.html", {
#         "tags": tags,
#         "user_services": user_services,
#         "signatures": signatures,
#         "google_accounts": google_accounts,
#         "user_attachments": user_attachments,
#         "selected_tag_id": str(selected_tag_id) if selected_tag_id else "",
#     })


@login_required(login_url="login")
def campaign_view(request):

    if request.method == "GET" and not request.META.get("HTTP_REFERER"):
        # allow redirect from save-enrich (has list_id param)
        if not request.GET.get("list_id"):
            return redirect("/")

    tags             = AudienceTag.objects.filter(user=request.user)
    user_services    = ProductService.objects.filter(user=request.user)
    signatures       = Signature.objects.filter(user=request.user)
    google_accounts  = SocialAccount.objects.filter(
        user=request.user,
        provider__in=["google", "microsoft"]
    )
    user_attachments = EmailAttachment.objects.filter(user=request.user)

    # Only saved lists that have at least 1 enriched email
    saved_lists = SavedPeopleList.objects.filter(
        user=request.user
    ).annotate(
        email_count=Count("entries", filter=Q(entries__email__gt=""))
    ).filter(email_count__gt=0)

    if request.method == "POST":

        # =========================
        # FORM DATA
        # =========================
        tag_id              = request.POST.get("tag_id", "").strip()
        selected_list_id    = request.POST.get("selected_list_id", "").strip()
        service_name        = request.POST.get("selected_service")
        framework           = request.POST.get("framework")
        campaign_goal       = request.POST.get("campaign_goal")
        signature_id        = request.POST.get("signature_id")
        sent_from           = request.POST.get("sent_from")
        schedule_time       = request.POST.get("schedule_time")
        shuffle_accounts    = request.POST.get("shuffle_accounts") == "on"
        saved_attachment_id = request.POST.get("saved_attachment")

        # =========================
        # RESOLVE AUDIENCE SOURCE
        # saved list takes priority over tag if both selected
        # =========================
        audiences = None

        if selected_list_id:
            # ── Saved People List path ───────────────────────────────────
            try:
                saved_list = SavedPeopleList.objects.get(
                    id=selected_list_id,
                    user=request.user
                )
            except SavedPeopleList.DoesNotExist:
                messages.error(request, "Selected list not found.")
                return redirect("campaign_view")

            entries_with_email = saved_list.entries.exclude(email="")

            if not entries_with_email.exists():
                messages.error(
                    request,
                    f"No enriched emails found in '{saved_list.name}'. "
                    "Please enrich the list first."
                )
                return redirect("campaign_view")

            # Create or reuse an AudienceTag for this saved list
            tag_obj, _ = AudienceTag.objects.get_or_create(
                user=request.user,
                name=f"[List] {saved_list.name}"
            )

            # Upsert TargetAudience for each enriched entry
            # Upsert TargetAudience for each enriched entry
            for entry in entries_with_email:
                obj, created = TargetAudience.objects.get_or_create(
                    user=request.user,
                    email=entry.email,
                    tag=tag_obj,
                    defaults={
                        "receiver_first_name":   entry.first,
                        "receiver_last_name":    entry.last,
                        "receiver_linkedin_url": entry.linkedin,
                        "company_url":           entry.company_website,
                    }
                )
                # Always update these fields whether created or existing
                obj.receiver_first_name   = entry.first or obj.receiver_first_name
                obj.receiver_last_name    = entry.last or obj.receiver_last_name
                obj.receiver_linkedin_url = entry.linkedin or obj.receiver_linkedin_url
                obj.company_url           = entry.company_website or obj.company_url
                obj.campaign_goal         = campaign_goal
                obj.framework             = framework
                obj.selected_service      = service_name
                obj.save(update_fields=[
                    "receiver_first_name",
                    "receiver_last_name",
                    "receiver_linkedin_url",
                    "company_url",
                    "campaign_goal",
                    "framework",
                    "selected_service",
                ])
            audiences = TargetAudience.objects.filter(
                user=request.user,
                tag=tag_obj
            )

        elif tag_id:
            # ── Existing AudienceTag path ────────────────────────────────
            audiences = TargetAudience.objects.filter(
                user=request.user,
                tag_id=tag_id
            )

        # =========================
        # VALIDATIONS
        # =========================
        if not service_name or not sent_from:
            messages.error(request, "Service and Sending Account are required.")
            return redirect("campaign_view")

        if not selected_list_id and not tag_id:
            messages.error(request, "Please select a Tag or a Saved List.")
            return redirect("campaign_view")

        if not audiences or not audiences.exists():
            messages.error(request, "No leads found. Please check your Tag or Saved List.")
            return redirect("campaign_view")

        selected_service = ProductService.objects.filter(
            service_name=service_name,
            user=request.user
        ).first()

        if not selected_service:
            messages.error(request, "Invalid service selected.")
            return redirect("campaign_view")

        selected_account = SocialAccount.objects.filter(
            id=sent_from,
            user=request.user
        ).first()

        if not selected_account:
            messages.error(request, "Invalid sending account.")
            return redirect("campaign_view")

        # =========================
        # SIGNATURE
        # =========================
        signature_html = ""

        if signature_id:
            try:
                signature_obj = Signature.objects.get(
                    id=signature_id,
                    user=request.user
                )
            except Signature.DoesNotExist:
                signature_obj = None
        else:
            signature_obj = Signature.objects.filter(
                user=request.user
            ).first()

        if signature_obj:
            signature_html = signature_obj.signature or ""

            if signature_obj.photo:
                photo_url = request.build_absolute_uri(signature_obj.photo.url)
                signature_html += f"""
                    <p>
                        <img src="{photo_url}"
                            alt="Signature Photo"
                            style="max-width:420px;margin-top:8px;width:100%;height:auto;display:block;">
                    </p>
                """

        if not signature_html:
            signature_html = (
                '<div style="margin:0;padding:0;line-height:1.4;">'
                f'Best,<br>{request.user.full_name}'
                '</div>'
            )

        # =========================
        # ATTACHMENT
        # =========================
        saved_obj       = None
        attachment_file = None

        if saved_attachment_id:
            try:
                saved_obj = EmailAttachment.objects.get(
                    id=saved_attachment_id,
                    user=request.user
                )
                attachment_file = saved_obj.file
                attachment_file.open()
                attachment_file.seek(0)

            except EmailAttachment.DoesNotExist:
                saved_obj       = None
                attachment_file = None

        # =========================
        # SCHEDULED SEND
        # =========================
        if schedule_time:

            schedule_dt = parse_datetime(schedule_time)

            if schedule_dt and timezone.is_naive(schedule_dt):
                schedule_dt = timezone.make_aware(schedule_dt)

            if not schedule_dt:
                messages.error(request, "Invalid schedule time.")
                return redirect("campaign_view")

            for audience in audiences:
                audience.campaign_goal    = campaign_goal
                audience.framework        = framework
                audience.selected_service = service_name
                audience.save(update_fields=[
                    "campaign_goal",
                    "framework",
                    "selected_service"
                ])

                ai_raw  = get_response(request.user, audience, selected_service)
                ai_data = json.loads(ai_raw)

                subject       = ai_data["main_email"]["subject"]
                message       = ai_data["main_email"]["body"]
                final_message = message
                if signature_html:
                    final_message += "<br><br>" + signature_html

                SentEmail.objects.create(
                    user=request.user,
                    target_audience=audience,
                    email=audience.email,
                    subject=subject,
                    message=final_message,
                    is_scheduled=True,
                    scheduled_at=schedule_dt,
                    sending_account=None if shuffle_accounts else selected_account,
                    attachment=saved_obj,
                    shuffle_accounts=shuffle_accounts
                )

                follow_ups     = ai_data.get("follow_ups", [])
                follow_up_days = [2, 4, 6, 8]

                sent_email_obj = SentEmail.objects.filter(
                    user=request.user,
                    target_audience=audience
                ).order_by("-created").first()

                if sent_email_obj:
                    for i, follow in enumerate(follow_ups):
                        if i >= len(follow_up_days):
                            break

                        follow_body = follow.get("body", "")
                        if signature_html:
                            follow_body += "<br><br>" + signature_html

                        ReminderEmail.objects.create(
                            user=request.user,
                            target_audience=audience,
                            sent_email=sent_email_obj,
                            message_id=make_msgid(domain='sellsharp.co'),
                            email=audience.email,
                            subject=f"Re: {subject}",
                            message=follow_body,
                            send_at=(
                                schedule_dt + timezone.timedelta(days=follow_up_days[i])
                            ).date(),
                            sent=False
                        )

            messages.success(request, "Campaign Scheduled Successfully.")
            return redirect("campaign_view")

        # =========================
        # IMMEDIATE SEND
        # =========================
        else:
            account_list = list(google_accounts)
            send_errors  = []

            for index, audience in enumerate(audiences):
                audience.campaign_goal    = campaign_goal
                audience.framework        = framework
                audience.selected_service = service_name
                audience.save(update_fields=[
                    "campaign_goal",
                    "framework",
                    "selected_service"
                ])

                if shuffle_accounts and account_list:
                    selected_account = account_list[index % len(account_list)]

                ai_raw  = get_response(request.user, audience, selected_service)
                ai_data = json.loads(ai_raw)

                subject       = ai_data["main_email"]["subject"]
                message       = ai_data["main_email"]["body"]
                final_message = message
                if signature_html:
                    final_message += "<br><br>" + signature_html

                main_email = {
                    "subject": subject,
                    "body": final_message
                }

                try:
                    sent_email_obj = sendCampaignEmail(
                        request=request,
                        user=request.user,
                        target_audience=audience,
                        main_email=main_email,
                        selected_account=selected_account,
                        attachment=attachment_file
                    )
                except Exception as e:
                    send_errors.append(f"{audience.email}: {e}")
                    continue   # skip follow-ups for this contact, try next

                # ── Follow-up reminders for immediate send ──
                follow_ups = ai_data.get("follow_ups", [])
                follow_up_days = [2, 4, 6, 8]
                today = timezone.now().date()

                for i, follow in enumerate(follow_ups):
                    if i >= len(follow_up_days):
                        break

                    follow_body = follow.get("body", "")
                    if signature_html:
                        follow_body += "<br><br>" + signature_html

                    send_at = today + timezone.timedelta(days=follow_up_days[i])

                    ReminderEmail.objects.create(
                        user=request.user,
                        target_audience=audience,
                        sent_email=sent_email_obj,
                        message_id=make_msgid(domain='sellsharp.co'),
                        email=audience.email,
                        subject=f"Re: {subject}",
                        message=follow_body,
                        send_at=send_at,
                        sent=False
                    )

            if send_errors:
                error_summary = "; ".join(send_errors)
                messages.error(
                    request,
                    f"Some emails failed to send — {error_summary}. "
                    "Check the server logs for details."
                )
            else:
                messages.success(request, "Campaign Sent Successfully")
            return redirect("campaign_view")


    # =========================
    # GET
    # =========================
    selected_tag_id  = request.GET.get("tag_id") or request.POST.get("tag_id")
    selected_list_id = request.GET.get("list_id", "")

    # All campaign emails (scheduled pending + recently sent)
    scheduled_emails = (
        SentEmail.objects
        .filter(user=request.user, is_scheduled=True)
        .select_related("target_audience", "sending_account")
        .order_by("scheduled_at")
    )
    return render(request, "generate_email/campaign.html", {
        "tags": tags,
        "saved_lists":      saved_lists,
        "user_services": user_services,
        "signatures": signatures,
        "google_accounts": google_accounts,
        "user_attachments": user_attachments,
        "selected_tag_id": str(selected_tag_id) if selected_tag_id else "",
        "scheduled_emails":scheduled_emails,
        "selected_list_id": selected_list_id,
    })