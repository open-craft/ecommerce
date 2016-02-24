/**
 * Basket page scripts.
 **/

define([
        'jquery',
        'underscore',
        'underscore.string',
        'utils/utils',
        'jquery-cookie'
    ],
    function ($,
              _,
              _s,
              Utils) {
        'use strict';

        var createForm = function(data) {
            var $form = $('<form />', {
                class: 'hidden',
                action: data.payment_page_url,
                method: 'POST',
                'accept-method': 'UTF-8'
            });
            return $form;
        },
        populateForm = function(data, $form){

            for(var prop in data.payment_form_data){
                if(typeof prop === 'string'){
                    var $input = $('<input />').attr({
                        type: 'text',
                        name: prop,
                        value: data.payment_form_data[prop]
                    });
                    $form.append($input);
                }
            }

            return $form;
        },
        checkoutPayment = function(data) {
            $.ajax({
                url: '/api/v2/checkout/',
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                headers: {
                    'X-CSRFToken': $.cookie('ecommerce_csrftoken')
                },
                data: JSON.stringify(data),
                success: onSuccess,
                error: onFail
            });
        },
        hideVoucherForm = function() {
            $('#voucher_form_container').hide();
            $('#voucher_form_link').show();
        },
        onFail = function(){
            var message = gettext('Problem occurred during checkout. Please contact support');
            $('#messages').empty().append(
                _s.sprintf('<div class="error">%s</div>', message)
            );
        },
        submitForm = function($form){
            $form.submit();
        },
        onSuccess = function (data) {
            var $form = createForm(data);
            $form = populateForm(data, $form);
            $('body').append($form);
            submitForm($form);
        },
        onReady = function() {
            var $paymentButtons = $('.payment-buttons'),
                basketId = $paymentButtons.data('basket-id');

            window.onbeforeunload = function(){};

            $('#voucher_form_link a').on('click', function(event) {
                event.preventDefault();
                showVoucherForm();
            });

            $('#voucher_form_cancel').on('click', function(event) {
                event.preventDefault();
                hideVoucherForm();
            });

            $paymentButtons.find('.payment-button').click(function (e) {
                var $btn = $(e.target),
                    deferred = new $.Deferred(),
                    promise = deferred.promise(),
                    paymentProcessor = $btn.val(),
                    data = {
                        basket_id: basketId,
                        payment_processor: paymentProcessor
                    };

                Utils.disableElementWhileRunning($btn, function() { return promise; });
                checkoutPayment(data);
            });
        },
        showVoucherForm = function() {
            $('#voucher_form_container').show();
            $('#voucher_form_link').hide();
            $('#id_code').focus();
        };

        return {
            createForm: createForm,
            populateForm: populateForm,
            checkoutPayment: checkoutPayment,
            hideVoucherForm: hideVoucherForm,
            onSuccess: onSuccess,
            onFail: onFail,
            onReady: onReady,
            showVoucherForm: showVoucherForm,
            submitForm: submitForm
        };
    }
);
