define([
        'jquery',
        'underscore',
        'pages/basket_page',
        'utils/utils',
        'utils/analytics_utils',
        'models/tracking_model',
        'models/user_model',
        'views/analytics_view',
        'js-cookie',
        'moment'
    ],
    function ($,
              _,
              BasketPage,
              Utils,
              AnalyticsUtils,
              TrackingModel,
              UserModel,
              AnalyticsView,
              Cookies,
              moment) {
        'use strict';

        describe('Basket Page', function () {
            var data,
                form;

            beforeEach(function () {
                jasmine.getFixtures().fixturesPath = '/base/ecommerce/static/js/test/fixtures';
            });

            beforeEach(function () {
                loadFixtures('basket.html');

                data = {
                    basket_id: 1,
                    payment_processor: 'paypal',
                    payment_page_url: 'http://www.dummy-url.com/',
                    payment_form_data: {
                        type: 'Dummy Type',
                        model: '500',
                        color: 'white'
                    }
                };

                form = $('<form>', {
                    action: data.payment_page_url,
                    method: 'POST',
                    'accept-method': 'UTF-8'
                });
            });

            afterEach(function () {
                $('body').empty();
            });

            describe('showVoucherForm', function () {
                it('should show voucher form', function () {
                    BasketPage.showVoucherForm();
                    expect($('#voucher_form_container').is(':visible')).toBeTruthy();
                    expect($('#voucher_form_link').is(':visible')).toBeFalsy();
                    expect($('#id_code').is(':focus')).toBeTruthy();
                });
            });

            describe('hideVoucherForm', function () {
                it('should hide voucher form', function () {
                    BasketPage.showVoucherForm();
                    BasketPage.hideVoucherForm();
                    expect($('#voucher_form_container').is(':visible')).toBeFalsy();
                    expect($('#voucher_form_link').is(':visible')).toBeTruthy();
                });
            });

            describe('onReady', function () {
                it('should toggle voucher form on click', function () {
                    BasketPage.onReady();

                    $('#voucher_form_link a').trigger('click');
                    expect($('#voucher_form_container').is(':visible')).toBeTruthy();
                    expect($('#voucher_form_link').is(':visible')).toBeFalsy();
                    expect($('#id_code').is(':focus')).toBeTruthy();

                    $('#voucher_form_cancel').trigger('click');
                    expect($('#voucher_form_container').is(':visible')).toBeFalsy();
                    expect($('#voucher_form_link').is(':visible')).toBeTruthy();
                });

                it('should make the states input field dropdown for US and CA', function () {
                    $(
                        '<fieldset>' +
                        '<div class="form-item"><div><select name="country">' +
                        '<option value=""><Choose country></option>' +
                        '<option value="US">United States</option>' +
                        '<option value="CA">Canada</option>' +
                        '<option value="HR">Croatia</option>' +
                        '</select></div><p class="help-block"></p></div>' +
                        '<div class="form-item"><div id="div_id_state"><label>State/Province</label>' +
                        '<div class="controls"><input name="state"></div></div></div>' +
                        '</fieldset>'
                    ).appendTo('body');
                    BasketPage.onReady();

                    $('select[name=country]').val('US').trigger('change');
                    expect($('#id_state').prop('tagName')).toEqual('SELECT');

                    $('select[name=country]').val('HR').trigger('change');
                    expect($('#id_state').prop('tagName')).toEqual('INPUT');

                    $('select[name=country]').val('CA').trigger('change');
                    expect($('#id_state').prop('tagName')).toEqual('SELECT');
                    expect($('#div_id_state').find('label').text()).toEqual('State/Province (required)');
                });

                it('should disable payment button before making ajax call', function () {
                    spyOn(Utils, 'disableElementWhileRunning').and.callThrough();
                    BasketPage.onReady();
                    $('button.payment-button').trigger('click');
                    expect(Utils.disableElementWhileRunning).toHaveBeenCalled();
                    expect($('button#cybersource').hasClass('is-disabled')).toBeTruthy();
                });

                it('should increment basket quantity on clicking up arrow', function () {
                    BasketPage.onReady();

                    $('input.quantity').first().val(5);
                    $('.spinner button.btn:first-of-type').trigger('click');

                    expect($('input.quantity').first().val()).toEqual('6');
                });

                it('should not increment quantity once reached to max value', function () {
                    BasketPage.onReady();

                    $('input.quantity').first().val(10);
                    $('.spinner button.btn:first-of-type').trigger('click');
                    expect($('input.quantity').first().val()).toEqual('10');
                });

                it('should decrement basket quantity on clicking down arrow', function () {
                    BasketPage.onReady();

                    $('input.quantity').first().val(5);
                    $('.spinner button.btn:last-of-type').trigger('click');

                    expect($('input.quantity').first().val()).toEqual('4');
                });

                it('should not decrement quantity once reached to min value', function () {
                    var $quantity = $('input.quantity');
                    BasketPage.onReady();

                    $quantity.first().val(1);
                    $('.spinner button.btn:last-of-type').trigger('click');
                    expect($quantity.first().val()).toEqual('1');
                });

                it('should recognize the credit card', function () {
                    var validCardList = [
                            {'number': '378282246310005', 'name': 'amex'},
                            {'number': '6011111111111117', 'name': 'discover'},
                            {'number': '5105105105105100', 'name': 'mastercard'},
                            {'number': '4111111111111111', 'name': 'visa'}
                        ],
                        cardNumberSelector = '#card-number',
                        $cardNumber = $(cardNumberSelector),
                        $cardTypeIcon = $('.card-type-icon');

                    spyOnEvent($cardNumber, 'cardType:detected');
                    BasketPage.onReady();

                    $cardNumber.trigger('input');
                    expect($cardTypeIcon.attr('src')).toEqual('');

                    $cardNumber.val('123123123123123').trigger('input');
                    expect($cardTypeIcon.attr('src')).toEqual('');

                    _.each(validCardList, function (card) {
                        var expectedImage = '/static/images/credit_cards/' + card.name + '.png';

                        $cardNumber.val(card.number).trigger('input');
                        expect($cardTypeIcon.attr('src')).toEqual(expectedImage);
                        expect('cardType:detected').toHaveBeenTriggeredOnAndWith(cardNumberSelector, {type: card.name});
                    });
                });

                it('should determine if credit card type is supported', function () {
                    var validCardTypes = ['amex', 'discover', 'mastercard', 'visa'],
                        invalidCardTypes = ['diners', 'jcb', 'maestro'];

                    _.each(validCardTypes, function (cardType) {
                        expect(BasketPage.isCardTypeSupported(cardType)).toBeTruthy();
                    });

                    _.each(invalidCardTypes, function (cardType) {
                        expect(BasketPage.isCardTypeSupported(cardType)).toBeFalsy();
                    });
                });
            });

            describe('clientSideCheckoutValidation', function () {
                var cc_expiry_months = {
                    JAN: '01',
                    FEB: '02',
                    MAR: '03',
                    APR: '04',
                    MAY: '05',
                    JUN: '06',
                    JUL: '07',
                    AUG: '08',
                    SEP: '09',
                    OCT: '10',
                    NOV: '11',
                    DEC: '12'
                };


                beforeEach(function () {
                    loadFixtures('client-side-checkout-validation.html');

                    $('#card-expiry-month').append(
                        _.reduce(_.toArray(cc_expiry_months), function (memo, value) {
                            return memo + '<option value="' + value + '">' + value + '</option>';
                        }, '')
                    );

                    $('input[name=first_name]').val('Joey');
                    $('input[name=last_name]').val('Tribbiani');
                    $('input[name=address_line1]').val('Central Park');
                    $('input[name=city]').val('New York City');
                    $('select[name=country]').val('US');
                    $('select[name=state]').val('NY');

                    BasketPage.onReady();
                });

                describe('cardHolderInformationValidation', function () {
                    it('should validate required fields', function () {
                        var requiredFields = [
                            'input[name=first_name]',
                            'input[name=last_name]',
                            'input[name=address_line1]',
                            'input[name=city]',
                            'select[name=country]'
                        ];

                        _.each(requiredFields, function (field) {
                            $(field).val('');
                            $('#payment-button').click();

                            expect(
                                $(field).parentsUntil(
                                    'form-item'
                                ).find('~.help-block span').text()
                            ).toEqual('This field is required');
                        });
                    });

                    it('should validate state field', function () {
                        $('select[name=country]').val('US').trigger('change');
                        $('select[name=state]').val('');
                        $('#payment-button').click();
                        expect(
                            $('select[name=state]').parentsUntil(
                                'form-item'
                            ).find('~.help-block span').text()
                        ).toEqual('This field is required');
                    });

                    it('should perform the SDN check', function () {
                        var first_name = 'Darth',
                            last_name = 'Vader',
                            country = 'DS',
                            args,
                            ajaxData,
                            event = $.Event('click'),
                            data = {'hits': 1};

                        $('input[name=first_name]').val(first_name);
                        $('input[name=last_name]').val(last_name);
                        $('select[name=country]').val(country);
                        $('input[name=sdn-check]').val('enabled');

                        spyOn(Utils, 'redirect');
                        spyOn(event, 'preventDefault');
                        spyOn($, 'ajax').and.callFake(function (options) {
                            options.success(data);
                        });
                        BasketPage.sdnCheck(event);

                        expect($.ajax).toHaveBeenCalled();
                        expect(event.preventDefault).toHaveBeenCalled();
                        expect(Utils.redirect).toHaveBeenCalled();
                        args = $.ajax.calls.argsFor(0)[0];
                        ajaxData = JSON.parse(args.data);
                        expect(args.method).toEqual('POST');
                        expect(args.url).toEqual('/api/v2/sdn/search/');
                        expect(args.contentType).toEqual('application/json; charset=utf-8');
                        expect(ajaxData.name).toEqual('Darth Vader');
                        expect(ajaxData.country).toEqual(country);
                    });
                });

                describe('cardInfoValidation', function () {
                    var validCardNumber = '378282246310005',  // AMEX (CVN length 4)
                        validCvn = '1234',
                        enRouteCardNumber = '201401173701274', // Unsupported type (Dec, 2016)
                        today = moment(),
                        cardExpirationMonth = 'FEB',  // Card Expires in February
                        thisMonth = moment().month('MAR').month(); // Let's say this month is March

                    beforeEach(function () {
                        $('#card-expiry-year').append('<option value="' +
                            today.year() + '">' + today.year() + '</option>'
                        );
                        // Freeze month to March.
                        // We are using moment here to get number of month instead of
                        // hard coding it, so that it conforms to js date time style.
                        spyOn(Date.prototype, 'getMonth').and.returnValue(thisMonth);
                    });

                    it('should validate card number', function () {
                        $('#card-number').val('123invalid456');
                        $('#payment-button').click();
                        expect($('#card-number ~ .help-block span').text()).toEqual('Invalid card number');

                        $('#card-number').val(validCardNumber);
                        $('#payment-button').click();
                        expect($('#card-number ~ .help-block').has('span').length).toEqual(0);
                    });

                    it('should validate card type', function () {
                        $('#card-number').val(enRouteCardNumber);
                        $('#payment-button').click();
                        expect($('#card-number~.help-block span').text()).toEqual('Unsupported card type');

                        $('#card-number').val(validCardNumber);
                        $('#payment-button').click();
                        expect($('#card-number ~ .help-block').has('span').length).toEqual(0);
                    });

                    it('should validate CVN number', function () {
                        var amexCardNumber = '378282246310005',
                            $number = $('#card-number'),
                            $cvn = $('#card-cvn'),
                            $paymentBtn = $('#payment-button');

                        $number.val(amexCardNumber);

                        // American Express cards have a four-digit CVN
                        $cvn.val('123');
                        $paymentBtn.click();
                        expect($cvn.find('~.help-block span').text()).toEqual('Invalid security number');

                        $cvn.val('123b');
                        $paymentBtn.click();
                        expect($cvn.find('~.help-block span').text()).toEqual('Invalid security number');

                        $cvn.val(validCvn);
                        $paymentBtn.click();
                        expect($number.find('~ .help-block').has('span').length).toEqual(0);
                    });

                    it('should validate expiry month', function () {
                        $('#card-number').val(validCardNumber);
                        $('#card-cvn').val(validCvn);
                        $('#card-expiry-month').val('99');
                        $('#payment-button').click();
                        expect($('#card-expiry-month~.help-block span').text()).toEqual('Invalid month');

                        $('#card-expiry-month').val('12');
                        $('#payment-button').click();
                        expect($('#card-expiry-month ~ .help-block').has('span').length).toEqual(0);
                    });

                    it('should validate expiry year', function () {
                        $('#card-number').val(validCardNumber);
                        $('#card-cvn').val(validCvn);
                        $('#card-expiry-month').val('12');
                        $('#card-expiry-year').val('2015');
                        $('#payment-button').click();
                        expect($('#card-expiry-year ~ .help-block span').text()).toEqual('Invalid year');

                        $('#card-expiry-year').val(today.year());
                        $('#payment-button').click();
                        expect($('#card-expiry-year ~ .help-block').has('span').length).toEqual(0);
                    });

                    it('should validate card expiration', function () {
                        $('#card-number').val(validCardNumber);
                        $('#card-cvn').val(validCvn);
                        $('#card-expiry-month').val(cc_expiry_months[cardExpirationMonth]);
                        $('#card-expiry-year').val(today.year());
                        $('#payment-button').click();
                        expect($('#card-expiry-month ~ .help-block span').text()).toEqual('Card expired');

                        $('#card-expiry-month').val('12');
                        $('#card-expiry-year').val(today.year());
                        $('#payment-button').click();
                        expect($('#card-expiry-month ~ .help-block').has('span').length).toEqual(0);
                    });
                });
            });

            describe('onFail', function () {
                it('should report error to message div element', function () {
                    $('<div id="messages"></div>').appendTo('body');
                    var error_messages_div = $('#messages');
                    BasketPage.onFail();
                    expect(error_messages_div.text()).toEqual(
                        'Problem occurred during checkout. Please contact support'
                    );
                });
            });

            describe('checkoutPayment', function () {
                it('should POST to the checkout endpoint', function () {
                    var args,
                        cookie = 'checkout-payment-test';

                    spyOn($, 'ajax');
                    Cookies.set('ecommerce_csrftoken', cookie);

                    BasketPage.checkoutPayment(data);

                    // $.ajax should have been called
                    expect($.ajax).toHaveBeenCalled();

                    // Ensure the data was POSTed to the correct endpoint
                    args = $.ajax.calls.argsFor(0)[0];
                    expect(args.method).toEqual('POST');
                    expect(args.url).toEqual('/api/v2/checkout/');
                    expect(args.contentType).toEqual('application/json; charset=utf-8');
                    expect(args.headers).toEqual({'X-CSRFToken': cookie});
                    expect(JSON.parse(args.data)).toEqual(data);
                });
            });

            describe('Analytics', function () {
                beforeEach(function () {
                    spyOn(TrackingModel.prototype, 'isTracking').and.callFake(function () {
                        return true;
                    });
                    spyOn(AnalyticsView.prototype, 'track');
                    AnalyticsUtils.analyticsSetUp();
                    BasketPage.onReady();
                    spyOn(window.analytics, 'page');
                });

                it('should trigger voucher applied analytics event', function () {
                    $('button.apply_voucher').trigger('click');
                    expect(AnalyticsView.prototype.track).toHaveBeenCalledWith(
                        'edx.bi.ecommerce.basket.voucher_applied',
                        {type: 'click'}
                    );
                });

                it('should trigger checkout analytics event', function () {
                    $('button.payment-button').trigger('click');
                    expect(AnalyticsView.prototype.track).toHaveBeenCalledWith(
                        'edx.bi.ecommerce.basket.payment_selected',
                        {category: 'cybersource', type: 'click'}
                    );
                });

                it('should trigger page load analytics event', function () {
                    $('<script type="text/javascript">var initModelData = {"course": {"courseId": "a/b/c"}};</script>')
                        .appendTo('body');
                    AnalyticsUtils.analyticsSetUp();
                    expect(window.analytics.page).toHaveBeenCalled();
                });
            });
        });
    }
);
