from django.contrib import admin
from django.urls import path
from graphene_django.views import GraphQLView
from portal.views import csrf

urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", GraphQLView.as_view(graphiql=True)),
    path("csrf/", csrf),
]
