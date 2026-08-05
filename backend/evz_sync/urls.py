from django.urls import path

from .views import SyncPreviewView, SyncPublishView, SyncStatusView

urlpatterns = [
    path('status/', SyncStatusView.as_view(), name='sync-status'),
    path('preview/', SyncPreviewView.as_view(), name='sync-preview'),
    path('publish/', SyncPublishView.as_view(), name='sync-publish'),
]
