"""HTTP endpoint for verifying the health of the ecommerce front-end."""
import logging
import uuid

import requests
from requests.exceptions import RequestException
from rest_framework import status
from django.db import transaction, connection, DatabaseError
from django.http import JsonResponse
from django.conf import settings
from django.contrib.auth import get_user_model, login, authenticate
from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import redirect
from django.views.generic import View
from django.utils.decorators import method_decorator

from ecommerce.core.constants import Status, UnavailabilityMessage
from ecommerce.core.url_utils import get_lms_heartbeat_url


logger = logging.getLogger(__name__)
User = get_user_model()


@transaction.non_atomic_requests
def health(_):
    """Allows a load balancer to verify that the ecommerce front-end service is up.

    Checks the status of the database connection and the LMS, the two services
    on which the ecommerce front-end currently depends.

    Returns:
        HttpResponse: 200 if the ecommerce front-end is available, with JSON data
            indicating the health of each required service
        HttpResponse: 503 if the ecommerce front-end is unavailable, with JSON data
            indicating the health of each required service

    Example:
        >>> response = requests.get('https://ecommerce.edx.org/health')
        >>> response.status_code
        200
        >>> response.content
        '{"overall_status": "OK", "detailed_status": {"database_status": "OK", "lms_status": "OK"}}'
    """
    overall_status = database_status = lms_status = Status.UNAVAILABLE

    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        database_status = Status.OK
    except DatabaseError:
        database_status = Status.UNAVAILABLE

    try:
        response = requests.get(get_lms_heartbeat_url(), timeout=1)

        if response.status_code == status.HTTP_200_OK:
            lms_status = Status.OK
        else:
            logger.critical(UnavailabilityMessage.LMS)
            lms_status = Status.UNAVAILABLE
    except RequestException:
        logger.critical(UnavailabilityMessage.LMS)
        lms_status = Status.UNAVAILABLE

    overall_status = Status.OK if (database_status == Status.OK) else Status.UNAVAILABLE

    data = {
        'overall_status': overall_status,
        'detailed_status': {
            'database_status': database_status,
            'lms_status': lms_status,
        },
    }

    if overall_status == Status.OK:
        return JsonResponse(data)
    else:
        return JsonResponse(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class AutoAuth(View):
    """Creates and authenticates a new User with superuser permissions.

    If the ENABLE_AUTO_AUTH setting is not True, returns a 404.
    """

    def get(self, request):
        if not getattr(settings, 'ENABLE_AUTO_AUTH', None):
            raise Http404

        username_prefix = getattr(settings, 'AUTO_AUTH_USERNAME_PREFIX', 'auto_auth_')

        # Create a new user with staff permissions
        username = password = username_prefix + uuid.uuid4().hex[0:20]
        User.objects.create_superuser(username, email=None, password=password)

        # Log in the new user
        user = authenticate(username=username, password=password)
        login(request, user)

        return redirect('/')


class StaffOnlyMixin(object):
    """ Makes sure only staff users can access the view. """
    @method_decorator(login_required)
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            raise Http404

        return super(StaffOnlyMixin, self).dispatch(request, *args, **kwargs)
