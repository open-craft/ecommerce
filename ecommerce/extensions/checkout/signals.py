import logging

import waffle
from django.conf import settings
from django.dispatch import receiver
from oscar.core.loading import get_class
from threadlocals import threadlocals

from ecommerce.core.url_utils import get_lms_url
from ecommerce.courses.utils import mode_for_seat
from ecommerce.extensions.analytics.utils import silence_exceptions, track_segment_event
from ecommerce.extensions.checkout.utils import get_credit_provider_details, get_receipt_page_url
from ecommerce.notifications.notifications import send_notification

logger = logging.getLogger(__name__)
post_checkout = get_class('checkout.signals', 'post_checkout')

# Number of orders currently supported for the email notifications
ORDER_LINE_COUNT = 1


@receiver(post_checkout, dispatch_uid='tracking.post_checkout_callback')
@silence_exceptions('Failed to emit tracking event upon order completion.')
def track_completed_order(sender, order=None, **kwargs):  # pylint: disable=unused-argument
    """Emit a tracking event when an order is placed."""
    if order.total_excl_tax <= 0:
        return

    properties = {
        'orderId': order.number,
        'total': str(order.total_excl_tax),
        'currency': order.currency,
        'products': [
            {
                # For backwards-compatibility with older events the `sku` field is (ab)used to
                # store the product's `certificate_type`, while the `id` field holds the product's
                # SKU. Marketing is aware that this approach will not scale once we start selling
                # products other than courses, and will need to change in the future.
                'id': line.partner_sku,
                'sku': mode_for_seat(line.product),
                'name': line.product.course.id if line.product.course else line.product.title,
                'price': str(line.line_price_excl_tax),
                'quantity': line.quantity,
                'category': line.product.get_product_class().name,
            } for line in order.lines.all()
        ],
    }
    track_segment_event(order.site, order.user, 'Order Completed', properties)


@receiver(post_checkout, dispatch_uid='send_completed_order_email')
@silence_exceptions("Failed to send order completion email.")
def send_course_purchase_email(sender, order=None, **kwargs):  # pylint: disable=unused-argument
    """Send course purchase notification email when a course is purchased."""
    if waffle.switch_is_active('ENABLE_NOTIFICATIONS'):
        # We do not currently support email sending for orders with more than one item.
        if len(order.lines.all()) == ORDER_LINE_COUNT:
            product = order.lines.first().product
            credit_provider_id = getattr(product.attr, 'credit_provider', None)
            if not credit_provider_id:
                stripped_title = product.title.replace("Seat in ","",1)
                stripped_title = stripped_title.replace("with professional certificate", "")
                stripped_title = stripped_title.replace("with verified certificate", "")
                send_notification(
                    order.user,
                    'CREDIT_RECEIPT',
                    {
                        'course_title': stripped_title,
                        'receipt_page_url': get_lms_url(
                            '{}?orderNum={}'.format(settings.RECEIPT_PAGE_PATH, order.number)
                        ),
                        'credit_hours': str(order.total_excl_tax),
                        'credit_provider': 'Credit provider',
                    },
                    threadlocals.get_current_request().site
                )
                logger.error(
                    'Failed to send credit receipt notification. Credit seat product [%s] has no provider.', product.id
                )
                return
            elif product.is_seat_product:
                provider_data = get_credit_provider_details(
                    access_token=order.site.siteconfiguration.access_token,
                    credit_provider_id=credit_provider_id,
                    site_configuration=order.site.siteconfiguration
                )

                receipt_page_url = get_receipt_page_url(
                    order_number=order.number,
                    site_configuration=order.site.siteconfiguration
                )

                if provider_data:
                    send_notification(
                        order.user,
                        'CREDIT_RECEIPT',
                        {
                            'course_title': product.title,
                            'receipt_page_url': receipt_page_url,
                            'credit_hours': product.attr.credit_hours,
                            'credit_provider': provider_data['display_name'],
                        },
                        order.site
                    )

        else:
            logger.info('Currently support receipt emails for order with one item.')
