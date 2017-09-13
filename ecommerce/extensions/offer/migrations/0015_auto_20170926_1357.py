# -*- coding: utf-8 -*-
# Generated by Django 1.10.7 on 2017-09-26 17:57
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('offer', '0014_conditionaloffer_site'),
    ]

    operations = [
        migrations.AddField(
            model_name='condition',
            name='enterprise_customer_catalog_uuid',
            field=models.UUIDField(blank=True, null=True, verbose_name='EnterpriseCustomerCatalog UUID'),
        ),
        migrations.AddField(
            model_name='condition',
            name='enterprise_customer_uuid',
            field=models.UUIDField(blank=True, null=True, verbose_name='EnterpriseCustomer UUID'),
        ),
    ]
