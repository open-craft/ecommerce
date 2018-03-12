require([
    'jquery'
],
    function($) {
        'use strict';
        $('.user-dropdown').click(
            function() {
                $('.user-dropdown-menu').toggleClass('expanded');
            }
        )
    }
);
