from django.conf.urls import url

from ecommerce.extensions.checkout import views

urlpatterns = [
    url(r'^free_checkout/', views.FreeCheckoutView.as_view(), name='free_checkout'),
]
