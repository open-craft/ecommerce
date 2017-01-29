import datetime
import json

import httpretty
from django.conf import settings
from django.core.cache import cache
from django.test import RequestFactory
from oscar.test import factories

from ecommerce.core.models import BusinessClient
from ecommerce.extensions.catalogue.utils import create_coupon_product
from ecommerce.extensions.api.v2.views.coupons import CouponViewSet
from ecommerce.extensions.basket.utils import prepare_basket
from ecommerce.tests.factories import PartnerFactory
from ecommerce.tests.mixins import ProductClass, Catalog, Benefit, Voucher, Applicator


class CourseCatalogMockMixin(object):
    """ Mocks for the Course Catalog responses. """

    def setUp(self):
        super(CourseCatalogMockMixin, self).setUp()
        cache.clear()

    def mock_dynamic_catalog_single_course_runs_api(self, course_run, course_run_info=None):
        """ Helper function to register a dynamic course catalog API endpoint for the course run information. """
        if not course_run_info:
            course_run_info = {
                "course": "edX+DemoX",
                "key": course_run.id,
                "title": course_run.name,
                "short_description": 'Foo',
                "start": "2013-02-05T05:00:00Z",
                "image": {
                    "src": "/path/to/image.jpg",
                },
                'enrollment_end': None
            }

        course_run_info_json = json.dumps(course_run_info)
        course_run_url = '{}course_runs/{}/?partner={}'.format(
            settings.COURSE_CATALOG_API_URL,
            course_run.id,
            self.site.siteconfiguration.partner.short_code
        )

        httpretty.register_uri(
            httpretty.GET, course_run_url,
            body=course_run_info_json,
            content_type='application/json'
        )

    def mock_dynamic_catalog_course_runs_api(self, course_run=None, query=None, course_run_info=None):
        """ Helper function to register a dynamic course catalog API endpoint for the course run information. """
        if not course_run_info:
            course_run_info = {
                'count': 1,
                'next': 'path/to/next/page',
                'results': [{
                    'key': course_run.id,
                    'title': course_run.name,
                    'start': '2016-05-01T00:00:00Z',
                    'image': {
                        'src': 'path/to/the/course/image'
                    },
                    'enrollment_end': None
                }] if course_run else [{
                    'key': 'test',
                    'title': 'Test course',
                    'enrollment_end': None
                }],
            }
        course_run_info_json = json.dumps(course_run_info)
        course_run_url_with_query = '{}course_runs/?q={}'.format(
            settings.COURSE_CATALOG_API_URL,
            query if query else 'id:course*'
        )
        httpretty.register_uri(
            httpretty.GET,
            course_run_url_with_query,
            body=course_run_info_json,
            content_type='application/json'
        )

        course_run_url_with_key = '{}course_runs/{}/'.format(
            settings.COURSE_CATALOG_API_URL,
            course_run.id if course_run else 'course-v1:test+test+test'
        )
        httpretty.register_uri(
            httpretty.GET, course_run_url_with_key,
            body=json.dumps(course_run_info['results'][0]),
            content_type='application/json'
        )

    def mock_dynamic_catalog_contains_api(self, course_run_ids, query):
        """ Helper function to register a dynamic course catalog API endpoint for the contains information. """
        course_contains_info = {
            'course_runs': {}
        }
        for course_run_id in course_run_ids:
            course_contains_info['course_runs'][course_run_id] = True

        course_run_info_json = json.dumps(course_contains_info)
        course_run_url = '{}course_runs/contains/?course_run_ids={}&query={}'.format(
            settings.COURSE_CATALOG_API_URL,
            (course_run_id for course_run_id in course_run_ids),
            query if query else 'id:course*'
        )
        httpretty.register_uri(
            httpretty.GET, course_run_url,
            body=course_run_info_json,
            content_type='application/json'
        )


class CouponMixin(object):
    """ Mixin for preparing data for coupons and creating coupons. """

    REDEMPTION_URL = "/coupons/offer/?code={}"

    def setUp(self):
        super(CouponMixin, self).setUp()
        self.category = factories.CategoryFactory()

        # Force the creation of a coupon ProductClass
        self.coupon_product_class  # pylint: disable=pointless-statement

    @property
    def coupon_product_class(self):
        defaults = {'requires_shipping': False, 'track_stock': False, 'name': 'Coupon'}
        pc, created = ProductClass.objects.get_or_create(name='Coupon', slug='coupon', defaults=defaults)

        if created:
            factories.ProductAttributeFactory(
                code='coupon_vouchers',
                name='Coupon vouchers',
                product_class=pc,
                type='entity'
            )
            factories.ProductAttributeFactory(
                code='note',
                name='Note',
                product_class=pc,
                type='text'
            )

        return pc

    def create_coupon(self, benefit_type=Benefit.PERCENTAGE, benefit_value=100, catalog=None,
                      catalog_query=None, client=None, code='', course_seat_types=None, email_domains=None,
                      max_uses=None, note=None, partner=None, price=100, quantity=5, title='Test coupon',
                      voucher_type=Voucher.SINGLE_USE, course_catalog=None, enterprise_customer=None):
        """Helper method for creating a coupon.

        Arguments:
            benefit_type(str): The voucher benefit type
            benefit_value(int): The voucher benefit value
            catalog(Catalog): Catalog of courses for which the coupon applies
            catalog_query(str): Course query string
            client (BusinessClient):  Optional business client object
            code(str): Custom coupon code
            course_catalog (int): Course catalog id from Catalog Service
            course_seat_types(str): A string of comma-separated list of seat types
            email_domains(str): A comma seperated list of email domains
            max_uses (int): Number of Voucher max uses
            note (str): Coupon note.
            partner(Partner): Partner used for creating a catalog
            price(int): Price of the coupon
            quantity (int): Number of vouchers to be created and associated with the coupon
            title(str): Title of the coupon
            voucher_type (str): Voucher type

        Returns:
            coupon (Coupon)

        """
        if partner is None:
            partner = PartnerFactory(name='Tester')
        if client is None:
            client, __ = BusinessClient.objects.get_or_create(name='Test Client')
        if catalog is None and not (catalog_query and course_seat_types):
            catalog = Catalog.objects.create(partner=partner)
        if code is not '':
            quantity = 1

        coupon = create_coupon_product(
            benefit_type=benefit_type,
            benefit_value=benefit_value,
            catalog=catalog,
            catalog_query=catalog_query,
            category=self.category,
            code=code,
            course_catalog=course_catalog,
            course_seat_types=course_seat_types,
            email_domains=email_domains,
            end_datetime=datetime.datetime(2020, 1, 1),
            enterprise_customer=enterprise_customer,
            max_uses=max_uses,
            note=note,
            partner=partner,
            price=price,
            quantity=quantity,
            start_datetime=datetime.datetime(2015, 1, 1),
            title=title,
            voucher_type=voucher_type
        )

        request = RequestFactory()
        request.site = self.site
        request.user = factories.UserFactory()
        request.COOKIES = {}

        self.basket = prepare_basket(request, coupon)

        view = CouponViewSet()
        view.request = request

        self.response_data = view.create_order_for_invoice(self.basket, coupon_id=coupon.id, client=client)
        coupon.client = client

        return coupon

    def apply_voucher(self, user, site, voucher):
        """ Apply the voucher to a basket. """
        basket = factories.BasketFactory(owner=user, site=site)
        product = voucher.offers.first().benefit.range.all_products()[0]
        basket.add_product(product)
        basket.vouchers.add(voucher)
        Applicator().apply(basket, self.user)
        return basket
