from django.urls import path
from .views import (CheckBulkEnrichmentView, GenerateEmailView, SendEmailView, EmailListView,EmailMessageView,
                    LeadListView, LeadEmailListView, campaign_view, email_open_pixel, export_target_audience_csv, import_leads, msgraph_webhook, CheckEmailHistoryView)

from .views import (SearchPeopleView,EnrichPersonView,CheckEnrichmentView,SelectPersonForEmailView,SearchPeopleByLinkdinView,SearchCompanyView,DataEnrichmentView,PeopleListView,
                    GetSavedListsView,EnrichSavedListView,ExportSavedListCsvView,SavePeopleToListView,DownloadListCSVView,DeleteSavedListView,RemovePersonFromListView,
                    SaveCompaniesToListView,RemoveCompanyFromListView,UseSavedListInCampaignView,SaveEnrichAndGoToCampaignView,SearchHistoryView,
                    AiParseSearchView)


urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email"),
    path("send_email/", SendEmailView.as_view(), name="send_email"),
    path('emails/', EmailListView.as_view(), name='view-emails'),
    path('leads/', LeadListView.as_view(), name='view-leads'),
    path('leads_email/<int:pk>', LeadEmailListView.as_view(), name='view-leads-email'),
    path('export-leads/', export_target_audience_csv, name='export-leads'),
    path('webhook/msgraph/', msgraph_webhook, name='msggraph_webhook'),
    path('emailmessage/<uuid:uid>/', EmailMessageView.as_view(), name='view-email-message'),
    path('check-email-history/',CheckEmailHistoryView.as_view(),name="check_email_history"),
    path("email/open/<uuid:uid>/", email_open_pixel, name="email_open_pixel"),

    path("import-leads/", import_leads, name="import_leads"),
    path("campaign/", campaign_view, name="campaign_view"),


    path("search-people/", SearchPeopleView.as_view(), name="search_people"),
    path("ai-parse-search/", AiParseSearchView.as_view(), name="ai_parse_search"),
    path("enrich-person/", EnrichPersonView.as_view(), name="enrich_person"),
    path("check-enrichment/<uuid:request_id>/", CheckEnrichmentView.as_view(), name="check_enrichment"),
    path("enrich/bulk-status/", CheckBulkEnrichmentView.as_view(), name="check_bulk_enrichment"),
    # path("get-email/", get_email, name="get_email"),
    path("select-person-for-email/", SelectPersonForEmailView.as_view(), name="select_person_for_email"),
    path('search-by-linkdin/',SearchPeopleByLinkdinView.as_view(),name="search_by_linkdin"),
    path('search-company/',SearchCompanyView.as_view(),name="search_company"),
    path('data-enrichment/',DataEnrichmentView.as_view(),name="data_enrich"),
    path("list/",PeopleListView.as_view(),name='list_view'),
    path("saved-lists/", GetSavedListsView.as_view(), name="get_saved_lists"),

    path("saved-lists/enrich/", EnrichSavedListView.as_view(), name="enrich_saved_list"),
    path("saved-lists/<int:list_id>/export-csv/", ExportSavedListCsvView.as_view(), name="export_saved_list_csv"),
    path("saved-lists/use-in-campaign/",UseSavedListInCampaignView.as_view(),name="use_saved_list_in_campaign"),

    path("save-enrich-campaign/", SaveEnrichAndGoToCampaignView.as_view(), name="save_enrich_campaign"),
    # path("data-enrichment/", DataEnrichmentView.as_view(), name="data_enrichment"),

    path("save-people-to-list/", SavePeopleToListView.as_view(), name="save_people_to_list"),
    path("list/<int:list_id>/download-csv/", DownloadListCSVView.as_view(), name="download_list_csv"),
    path("list/<int:list_id>/delete/", DeleteSavedListView.as_view(), name="delete_saved_list"),
    path("list/<int:list_id>/entries/<int:entry_id>/remove/", RemovePersonFromListView.as_view(), name="remove_person_from_list"),
    path("save-companies-to-list/", SaveCompaniesToListView.as_view(), name="save_companies_to_list"),
    path("lists/<int:list_id>/remove-company/<int:company_id>/",RemoveCompanyFromListView.as_view(),name="remove_company_from_list"),

    path("search-history/", SearchHistoryView.as_view(), name="search_history"),

    # path("webhook/redrob/", RedrobWebhookView.as_view())

]


