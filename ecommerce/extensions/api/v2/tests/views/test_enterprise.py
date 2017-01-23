import mock

from django.core.urlresolvers import reverse

from ecommerce.tests.testcases import TestCase

class TestEnterpriseCustomerView(TestCase):

    @mock.patch('ecommerce.extensions.api.v2.enterprise.EdxRestApiClient')
    def test_get_customers(self, mock_client):
        instance = mock_client.return_value
        setattr(
            instance,
            'enterprise-customer',
            mock.MagicMock(
                get=mock.MagicMock(
                    return_value={
                        'results': [
                            {
                                'name': 'Starfleet Academy',
                                'uuid': '5113b17bf79f4b5081cf3be0009bc96f',
                                'hypothetical_private_info': 'seriously, very private',
                            },
                            {
                                'name': 'Millennium Falcon',
                                'uuid': 'd1fb990fa2784a52a44cca1118ed3993',
                            }
                        ]
                    }
                )  
            ),
        )
        url = reverse('enterprise_customers')
        result = self.client.get(url)
        self.assertEqual(
            result.json(),
            {
                results: [
                    {
                        'name': 'Starfleet Academy',
                        'id': '5113b17bf79f4b5081cf3be0009bc96f'
                    },  # Note that the private information from the API has been stripped
                    {
                        'name': 'Millennium Falcon',
                        'id': 'd1fb990fa2784a52a44cca1118ed3993'
                    }
                ]
            }
        )
