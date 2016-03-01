from django.conf.urls import url, include

from ecommerce.extensions.app import application
from ecommerce.extensions.payment.app import application as payment

urlpatterns = [
    url(r'^api/', include('ecommerce.extensions.api.urls', namespace='api')),
    url(r'^checkout/', include('ecommerce.extensions.checkout.urls', namespace='checkout_app')),
    url(r'^payment/', include(payment.urls)),
    url(r'', include(application.urls)),
]
